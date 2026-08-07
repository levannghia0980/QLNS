import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import text

from pydantic import BaseModel
from database_utils import db_execute
from services.hrai.query_planner_engine.query_planner import DynamicQuerySpec, DynamicFilterCondition

logger = logging.getLogger(__name__)

try:
    from rapidfuzz import process, fuzz
    HAS_RAPIDFUZZ = True
except ImportError:
    import difflib
    HAS_RAPIDFUZZ = False

# ─── Safety constants ────────────────────────────────────────────────────────
SAFETY_ROW_LIMIT = 500       # Absolute max rows from any single query
PREVIEW_ROW_LIMIT = 50       # Max rows to include in data_preview for LLM


# ─── Data Models ─────────────────────────────────────────────────────────────

class DynamicNameResolution(BaseModel):
    resolved_name: Optional[str] = None
    is_ambiguous: bool = False
    candidates: List[str] = []


# ─── Utility Functions ───────────────────────────────────────────────────────

def calculate_row_shift_hours(
    row_dict: Dict[str, Any],
    shift_rules: Dict[str, float]
) -> Tuple[float, Dict[str, int]]:
    total_hours = 0.0
    shift_counts = {}

    if not shift_rules:
        return 0.0, {}

    sorted_rules = sorted(shift_rules.items(), key=lambda x: len(str(x[0])), reverse=True)

    for col_k, col_v in row_dict.items():
        if not col_v:
            continue
        v_str = str(col_v).strip().upper()
        if not v_str:
            continue

        matched_rule_key = None
        matched_hours = 0.0

        for r_key, r_hours in sorted_rules:
            rk_str = str(r_key).strip().upper()
            if not rk_str:
                continue

            if v_str == rk_str or re.search(rf'\b{re.escape(rk_str)}\b', v_str):
                matched_rule_key = rk_str
                matched_hours = r_hours
                break

        if matched_rule_key and matched_hours > 0:
            total_hours += matched_hours
            shift_counts[matched_rule_key] = shift_counts.get(matched_rule_key, 0) + 1

    return total_hours, shift_counts


def parse_flexible_date(val_str: Any) -> Optional[datetime]:
    if not val_str:
        return None
    s = str(val_str).strip()

    m1 = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', s)
    if m1:
        try:
            return datetime(int(m1.group(1)), int(m1.group(2)), int(m1.group(3)))
        except ValueError:
            pass

    m2 = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', s)
    if m2:
        try:
            return datetime(int(m2.group(3)), int(m2.group(2)), int(m2.group(1)))
        except ValueError:
            pass

    m3 = re.search(r'(\d{2})[-/]?(\d{2})[-/]?(\d{4})', s)
    if m3:
        try:
            return datetime(int(m3.group(3)), int(m3.group(2)), int(m3.group(1)))
        except ValueError:
            pass

    return None


def resolve_person_name_dynamic(
    raw_name: Optional[str],
    all_names: List[str]
) -> DynamicNameResolution:
    if not raw_name or not all_names:
        return DynamicNameResolution(resolved_name=None, is_ambiguous=False, candidates=[])

    clean_q = raw_name.strip().lower()

    exact_matches = [n for n in all_names if n and clean_q in n.lower()]
    if len(exact_matches) == 1:
        return DynamicNameResolution(resolved_name=exact_matches[0], is_ambiguous=False, candidates=[])

    if HAS_RAPIDFUZZ:
        matches = process.extract(clean_q, all_names, scorer=fuzz.WRatio, limit=5)
        top = [m for m in matches if m[1] >= 75]
        if not top:
            if exact_matches:
                return DynamicNameResolution(resolved_name=exact_matches[0], is_ambiguous=False, candidates=[])
            return DynamicNameResolution(resolved_name=None, is_ambiguous=False, candidates=[])
        if len(top) == 1 or (top[0][1] - top[1][1] >= 10):
            return DynamicNameResolution(resolved_name=top[0][0], is_ambiguous=False, candidates=[])
        return DynamicNameResolution(resolved_name=None, is_ambiguous=True, candidates=[m[0] for m in top])
    else:
        matches = difflib.get_close_matches(clean_q, all_names, n=5, cutoff=0.6)
        if not matches:
            if exact_matches:
                return DynamicNameResolution(resolved_name=exact_matches[0], is_ambiguous=False, candidates=[])
            return DynamicNameResolution(resolved_name=None, is_ambiguous=False, candidates=[])
        if len(matches) == 1:
            return DynamicNameResolution(resolved_name=matches[0], is_ambiguous=False, candidates=[])
        return DynamicNameResolution(resolved_name=None, is_ambiguous=True, candidates=matches)


# ─── Schema Snapshot (compact, token-efficient) ──────────────────────────────

async def get_full_multi_table_schema_snapshot(
    db: Any
) -> Dict[str, Any]:
    tables_meta = []
    all_person_names = set()
    common_join_keys = set()

    is_sqlite = "sqlite" in str(db.bind.url) if hasattr(db, "bind") and db.bind else True
    if is_sqlite:
        query = text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'alembic_%' AND name NOT LIKE '_sheet_%';")
    else:
        query = text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE '_sheet_%';")

    try:
        res = await db_execute(db, query)
        table_names = [r[0] for r in res.fetchall()]
    except Exception as e:
        logger.error("Lỗi lấy danh sách bảng CSDL: %s", e)
        table_names = []

    for t in table_names:
        cols = []
        sample_rows = []
        enum_values = {}
        detected_name_col = None
        row_count = 0

        try:
            # Get row count
            cnt_res = await db_execute(db, text(f'SELECT COUNT(*) FROM "{t}";'))
            row_count = cnt_res.scalar() or 0

            # Get 2 sample rows (reduced from 3)
            r_sample = await db_execute(db, text(f'SELECT * FROM "{t}" LIMIT 2;'))
            cols = list(r_sample.keys()) if hasattr(r_sample, "keys") else []
            sample_rows = [dict(row._mapping) if hasattr(row, "_mapping") else dict(row) for row in r_sample.fetchall()]

            for c in cols:
                c_low = c.lower()
                if c_low not in ['id', 'stt', 'col']:
                    detected_name_col = c
                    common_join_keys.add(c)
                    break
            if not detected_name_col and len(cols) > 1:
                detected_name_col = cols[1]

            # Get all person names for fuzzy matching
            if detected_name_col:
                name_res = await db_execute(db, text(f'SELECT DISTINCT "{detected_name_col}" FROM "{t}" WHERE "{detected_name_col}" IS NOT NULL AND "{detected_name_col}" != \'\';'))
                for row in name_res.fetchall():
                    if row[0]:
                        all_person_names.add(str(row[0]).strip())

            # Get enum values for columns (compact)
            for col in cols[:12]:
                try:
                    enum_res = await db_execute(db, text(f'SELECT DISTINCT "{col}" FROM "{t}" WHERE "{col}" IS NOT NULL LIMIT 10;'))
                    vals = [r[0] for r in enum_res.fetchall() if r[0] is not None]
                    if 1 <= len(vals) <= 10:
                        enum_values[col] = vals
                except Exception:
                    continue
        except Exception as e:
            logger.error("Lỗi quét schema cho bảng %s: %s", t, e)

        clean_title = t.replace("sheet_", "").replace("_", " ").title()
        tables_meta.append({
            "table_name": t,
            "display_name": clean_title,
            "columns": cols,
            "row_count": row_count,
            "detected_name_col": detected_name_col,
            "sample_rows": sample_rows,
            "enum_values": enum_values
        })

    return {
        "tables": tables_meta,
        "all_person_names": sorted(list(all_person_names)),
        "common_join_keys": sorted(list(common_join_keys))
    }


# ─── Row Filter (exact word boundaries) ─────────────────────────────────────

def filter_rows_exact_word_boundaries(rows: List[Dict[str, Any]], spec: DynamicQuerySpec) -> List[Dict[str, Any]]:
    if not rows or not spec.filter_conditions:
        return rows

    filtered = []
    for r in rows:
        keep = True
        for cond in spec.filter_conditions:
            if not cond.column or cond.value is None:
                continue

            r_val = None
            for k, v in r.items():
                if k.lower() == cond.column.lower() or cond.column.lower() in k.lower():
                    r_val = v
                    break

            if r_val is not None:
                val_str = str(r_val).strip()
                cond_val = str(cond.value).strip()

                if not cond_val.startswith('%') and not cond_val.endswith('%') and cond.operator.upper() in ['=', 'LIKE']:
                    clean_pattern = re.escape(cond_val)
                    if not re.search(rf'\b{clean_pattern}\b', val_str, re.IGNORECASE):
                        keep = False
                        break
        if keep:
            filtered.append(r)
    return filtered


# ─── Main Execution Engine ───────────────────────────────────────────────────

def _build_fallback_sql(spec: DynamicQuerySpec, table_name: str, detected_name_col: str, name_res: DynamicNameResolution, target_person_name: Optional[str]) -> Tuple[str, Dict[str, Any]]:
    """Build a fallback SQL when LLM didn't generate one."""
    sql = f'SELECT * FROM "{table_name}"'
    params = {}
    if name_res.resolved_name:
        sql += f' WHERE "{detected_name_col}" = :resolved_name'
        params["resolved_name"] = name_res.resolved_name
    elif target_person_name:
        sql += f' WHERE LOWER("{detected_name_col}") LIKE :fuzzy_name'
        params["fuzzy_name"] = f"%{target_person_name.lower().strip()}%"
    sql += f" LIMIT {SAFETY_ROW_LIMIT};"
    return sql, params


def _compact_result(rows: List[Dict[str, Any]], total_in_db: Optional[int] = None) -> Dict[str, Any]:
    """Build a compact result dict with preview and summary stats."""
    result = {
        "row_count": len(rows),
        "data_preview": rows[:PREVIEW_ROW_LIMIT],
    }
    if total_in_db is not None:
        result["total_in_db"] = total_in_db
    if len(rows) > PREVIEW_ROW_LIMIT:
        result["truncated_note"] = f"Kết quả SQL trả về {len(rows)} rows, chỉ hiển thị {PREVIEW_ROW_LIMIT} rows đầu."
    return result


async def execute_multi_table_query_and_compute(
    spec: DynamicQuerySpec,
    multi_schema_snapshot: Dict[str, Any],
    db: Any
) -> Tuple[Dict[str, Any], str, DynamicNameResolution]:
    tables = multi_schema_snapshot.get("tables", [])
    if not tables:
        return {"row_count": 0}, "", DynamicNameResolution()

    target_table_names = spec.selected_tables or [tables[0]["table_name"]]
    selected_meta_list = [t for t in tables if t["table_name"] in target_table_names]
    if not selected_meta_list:
        selected_meta_list = [tables[0]]

    primary_meta = selected_meta_list[0]
    table_name = primary_meta["table_name"]
    detected_name_col = primary_meta["detected_name_col"] or "Họ và tên"
    all_names = multi_schema_snapshot.get("all_person_names", [])

    # ── Detect date column ──
    dob_col = None
    for m in selected_meta_list:
        for r in m.get("sample_rows", []):
            for col_k, col_v in r.items():
                if parse_flexible_date(col_v):
                    dob_col = col_k
                    break
            if dob_col:
                break

    # ── Shift rules from question ──
    shift_rules = {}
    if spec.in_question_rules:
        for k, v in spec.in_question_rules.items():
            try:
                shift_rules[str(k).strip().upper()] = float(v)
            except (ValueError, TypeError):
                pass

    # ── Name resolution ──
    names_to_lookup = spec.extracted_person_names or ([spec.extracted_person_name] if spec.extracted_person_name else [])
    target_person_name = names_to_lookup[0] if names_to_lookup else spec.extracted_person_name
    name_res = resolve_person_name_dynamic(target_person_name, all_names)

    # ═══════════════════════════════════════════════════════════════════════════
    # BRANCH 1: Comparison between 2+ named people (needs Python date math)
    # ═══════════════════════════════════════════════════════════════════════════
    if spec.intent_type == "comparison" or (len(names_to_lookup) >= 2 and spec.calc_type == "compare_dates"):
        resolved_persons = []
        for raw_n in names_to_lookup:
            res_n = resolve_person_name_dynamic(raw_n, all_names)
            if res_n.resolved_name and res_n.resolved_name not in resolved_persons:
                resolved_persons.append(res_n.resolved_name)

        if len(resolved_persons) >= 2:
            param_clause = ", ".join([f":p_{i}" for i in range(len(resolved_persons))])
            sql = f'SELECT * FROM "{table_name}" WHERE "{detected_name_col}" IN ({param_clause});'
            params = {f"p_{i}": p for i, p in enumerate(resolved_persons)}
            try:
                res_db = await db_execute(db, text(sql), params)
                person_rows = [dict(r._mapping) if hasattr(r, "_mapping") else dict(r) for r in res_db.fetchall()]
            except Exception:
                person_rows = []

            parsed_comparison = []
            today = date.today()
            for r in person_rows:
                p_name = r.get(detected_name_col, "")
                dob_val = r.get(dob_col) if dob_col else None
                dt = parse_flexible_date(dob_val)
                if dt:
                    age_years = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
                    total_months = (today.year - dt.year) * 12 + (today.month - dt.month)
                    parsed_comparison.append({
                        "name": p_name,
                        "dob_str": dt.strftime("%d/%m/%Y"),
                        "dob_date": dt,
                        "age_years": age_years,
                        "total_months": total_months,
                        "raw_row": r
                    })

            if len(parsed_comparison) >= 2:
                parsed_comparison.sort(key=lambda x: x["dob_date"])
                earlier = parsed_comparison[0]
                later = parsed_comparison[1]

                diff_days = (later["dob_date"] - earlier["dob_date"]).days
                diff_months = (later["dob_date"].year - earlier["dob_date"].year) * 12 + (later["dob_date"].month - earlier["dob_date"].month)

                computed = {
                    "row_count": len(person_rows),
                    "comparison_type": "birthdate_comparison",
                    "comparison_result": {
                        "winner_born_earlier": earlier["name"],
                        "earlier_dob": earlier["dob_str"],
                        "earlier_age": earlier["age_years"],
                        "later_person": later["name"],
                        "later_dob": later["dob_str"],
                        "later_age": later["age_years"],
                        "summary": f"Giữa {earlier['name']} và {later['name']}, bạn {earlier['name']} sinh trước (sinh ngày {earlier['dob_str']}, {earlier['age_years']} tuổi), lớn hơn {later['name']} (sinh ngày {later['dob_str']}, {later['age_years']} tuổi) khoảng {diff_months} tháng ({diff_days} ngày)."
                    },
                    "data_preview": person_rows
                }
                return computed, sql, DynamicNameResolution()

    # ═══════════════════════════════════════════════════════════════════════════
    # BRANCH 2: Work hours calculation (needs Python shift rules)
    # ═══════════════════════════════════════════════════════════════════════════
    if spec.calc_type == "map_sum" or (shift_rules and spec.in_question_rules):
        # Determine which table to query for shifts
        if spec.need_join and len(selected_meta_list) >= 2:
            join_col = spec.join_on_column or detected_name_col
            t1 = selected_meta_list[0]["table_name"]
            t2 = selected_meta_list[1]["table_name"]
            sql = f'SELECT t1.*, t2.* FROM "{t1}" t1 INNER JOIN "{t2}" t2 ON t1."{join_col}" = t2."{join_col}"'
            params = {}
            if name_res.resolved_name:
                sql += f' WHERE t1."{join_col}" = :resolved_name'
                params["resolved_name"] = name_res.resolved_name
            sql += f" LIMIT {SAFETY_ROW_LIMIT};"
        else:
            shift_table_name = selected_meta_list[0]["table_name"]
            sql = f'SELECT * FROM "{shift_table_name}"'
            params = {}
            if name_res.resolved_name:
                sql += f' WHERE "{detected_name_col}" = :resolved_name'
                params["resolved_name"] = name_res.resolved_name
            sql += ";"

        try:
            res = await db_execute(db, text(sql), params)
            rows = [dict(r._mapping) if hasattr(r, "_mapping") else dict(r) for r in res.fetchall()]
        except Exception as e:
            logger.error("Error fetching shift data: %s", e)
            rows = []

        rows = filter_rows_exact_word_boundaries(rows, spec)

        grand_total_hours = 0.0
        shift_counts = {}
        matched_names = []
        person_breakdown = []

        for r in rows:
            p_name = r.get(detected_name_col, "N/A")
            if p_name and p_name not in matched_names:
                matched_names.append(p_name)

            p_hours, p_shifts = calculate_row_shift_hours(r, shift_rules)
            grand_total_hours += p_hours

            for sk, sc in p_shifts.items():
                shift_counts[sk] = shift_counts.get(sk, 0) + sc

            if p_hours > 0:
                person_breakdown.append({
                    "Họ và tên": p_name,
                    "Tổng số giờ làm": p_hours,
                    "Chi tiết ca": p_shifts
                })

        computed = {
            "row_count": len(rows),
            "matched_people_count": len(matched_names),
            "matched_people_list": matched_names[:PREVIEW_ROW_LIMIT],
            "target_person": name_res.resolved_name or target_person_name,
            "grand_total_hours": grand_total_hours,
            "shift_counts_breakdown": shift_counts,
            "person_breakdown": person_breakdown[:PREVIEW_ROW_LIMIT],
            "summary_facts": f"Tìm thấy chính xác {len(matched_names)} nhân sự khớp điều kiện. Tổng toàn bộ giờ làm: {grand_total_hours:,.1f} giờ.",
            "data_preview": rows[:PREVIEW_ROW_LIMIT]
        }
        return computed, sql, name_res

    # ═══════════════════════════════════════════════════════════════════════════
    # BRANCH 3: LLM-generated SQL (NEW — the core upgrade)
    # ═══════════════════════════════════════════════════════════════════════════
    if spec.generated_sql:
        sql = spec.generated_sql.strip().rstrip(";") + ";"
        logger.info("Executing LLM-generated SQL: %s", sql[:200])

        # Inject name resolution into SQL if person name was extracted
        params = {}
        if name_res.resolved_name and spec.extracted_person_name:
            # Replace fuzzy name in SQL with resolved name
            original_name = spec.extracted_person_name.lower()
            if f"%{original_name}%" in sql.lower():
                sql = re.sub(
                    rf"%{re.escape(original_name)}%",
                    f"%{name_res.resolved_name}%",
                    sql,
                    flags=re.IGNORECASE
                )

        try:
            from services.hrai.ai_pipeline.execution_engine import validate_sql
            sql_err = validate_sql(sql)
            if sql_err:
                logger.error("Generated SQL failed safety validation: %s", sql_err)
                # Fall through to fallback
            else:
                res = await db_execute(db, text(sql), params)
                rows = [dict(r._mapping) if hasattr(r, "_mapping") else dict(r) for r in res.fetchall()]

                # Enrich with age calculation if this is an age query
                if spec.calc_type in ["age", "min_date", "max_date"] and dob_col:
                    today = date.today()
                    for r in rows:
                        dob_val = r.get(dob_col)
                        dt = parse_flexible_date(dob_val)
                        if dt:
                            age = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
                            r["_computed_age"] = age
                            r["_dob_formatted"] = dt.strftime("%d/%m/%Y")

                # Get total row count for context
                total_in_db = None
                if len(selected_meta_list) == 1:
                    total_in_db = selected_meta_list[0].get("row_count")

                computed = _compact_result(rows, total_in_db)
                computed["executed_sql"] = sql

                # Add person info if single person lookup
                if len(rows) == 1 and name_res.resolved_name:
                    target_row = rows[0]
                    person_name = target_row.get(detected_name_col, name_res.resolved_name or "")
                    dob_val = target_row.get(dob_col) if dob_col else None
                    parsed_dt = parse_flexible_date(dob_val)

                    if parsed_dt:
                        today = date.today()
                        years = today.year - parsed_dt.year - ((today.month, today.day) < (parsed_dt.month, parsed_dt.day))
                        total_months = (today.year - parsed_dt.year) * 12 + (today.month - parsed_dt.month)
                        if today.day < parsed_dt.day:
                            total_months -= 1
                        total_days = (today - parsed_dt.date()).days

                        computed["exact_age_detail"] = {
                            "birth_date_formatted": parsed_dt.strftime("%d/%m/%Y"),
                            "years": years,
                            "total_months": total_months,
                            "total_days": total_days,
                            "summary": f"Sinh ngày {parsed_dt.strftime('%d/%m/%Y')}. Hiện tại được {years} tuổi ({total_months} tháng, {total_days:,} ngày)."
                        }
                    computed["person_info"] = {
                        "Họ và tên": person_name,
                        "Chi tiết bản ghi": target_row
                    }

                return computed, sql, name_res

        except Exception as e:
            logger.error("Error executing LLM-generated SQL: %s | SQL: %s", e, sql[:200])
            # Fall through to fallback below

    # ═══════════════════════════════════════════════════════════════════════════
    # BRANCH 4: Ranking (oldest/youngest — needs Python date parsing)
    # ═══════════════════════════════════════════════════════════════════════════
    if spec.intent_type == "ranking" or spec.calc_type in ["min_date", "max_date"]:
        target_info_table = table_name
        sql = f'SELECT * FROM "{target_info_table}" WHERE "{dob_col}" IS NOT NULL AND "{dob_col}" != \'\';'
        try:
            res = await db_execute(db, text(sql))
            rows = [dict(r._mapping) if hasattr(r, "_mapping") else dict(r) for r in res.fetchall()]
        except Exception:
            rows = []

        parsed_rows = []
        for r in rows:
            dt = parse_flexible_date(r.get(dob_col))
            if dt:
                parsed_rows.append((dt, r))

        if parsed_rows:
            parsed_rows.sort(key=lambda x: x[0], reverse=(spec.calc_type == "max_date"))
            top_dt, top_row = parsed_rows[0]
            name_val = top_row.get(detected_name_col, "N/A")
            age_val = date.today().year - top_dt.year - ((date.today().month, date.today().day) < (top_dt.month, top_dt.day))

            computed = {
                "row_count": len(parsed_rows),
                "total_in_db": primary_meta.get("row_count"),
                "ranking_type": "oldest_person" if spec.calc_type == "min_date" else "youngest_person",
                "result_summary": f"Người sinh sớm nhất là {name_val}, sinh ngày {top_dt.strftime('%d/%m/%Y')} ({age_val} tuổi).",
                "person_details": {
                    "Họ và tên": name_val,
                    "Ngày sinh": top_dt.strftime("%d/%m/%Y"),
                    "Số tuổi": age_val,
                    "Chi tiết bản ghi": top_row
                },
                "data_preview": [top_row]
            }
            return computed, f'SELECT * FROM "{target_info_table}" ORDER BY "{dob_col}" ASC;', DynamicNameResolution()

    # ═══════════════════════════════════════════════════════════════════════════
    # BRANCH 5: JOIN query (when LLM didn't generate SQL)
    # ═══════════════════════════════════════════════════════════════════════════
    if (spec.need_join or len(selected_meta_list) >= 2 or spec.filter_conditions) and len(tables) >= 2:
        join_col = spec.join_on_column or detected_name_col
        t1 = selected_meta_list[0]["table_name"]
        t2 = selected_meta_list[1]["table_name"] if len(selected_meta_list) > 1 else ([t["table_name"] for t in tables if t["table_name"] != t1] or [t1])[0]

        t1_cols = next((t["columns"] for t in tables if t["table_name"] == t1), [])
        t2_cols = next((t["columns"] for t in tables if t["table_name"] == t2), [])

        where_clauses = []
        params = {}

        if name_res.resolved_name:
            where_clauses.append(f't1."{join_col}" = :resolved_name')
            params["resolved_name"] = name_res.resolved_name

        for idx, cond in enumerate(spec.filter_conditions):
            if cond.column:
                param_key = f"p_{idx}"
                t_prefix = "t1" if cond.column in t1_cols else ("t2" if cond.column in t2_cols else "t1")
                val_str = str(cond.value).strip()
                if cond.operator.upper() == "LIKE":
                    where_clauses.append(f'LOWER({t_prefix}."{cond.column}") LIKE :{param_key}')
                    if val_str.startswith("%") or val_str.endswith("%"):
                        params[param_key] = val_str.lower()
                    else:
                        params[param_key] = f"%{val_str.lower()}%"
                else:
                    where_clauses.append(f'{t_prefix}."{cond.column}" = :{param_key}')
                    params[param_key] = cond.value

        sql = f'SELECT t1.*, t2.* FROM "{t1}" t1 INNER JOIN "{t2}" t2 ON t1."{join_col}" = t2."{join_col}"'
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)
        sql += f" LIMIT {SAFETY_ROW_LIMIT};"

        rows = []
        try:
            res = await db_execute(db, text(sql), params)
            rows = [dict(r._mapping) if hasattr(r, "_mapping") else dict(r) for r in res.fetchall()]
        except Exception as e:
            logger.error("Error executing JOIN query: %s | SQL: %s", e, sql)
            rows = []

        rows = filter_rows_exact_word_boundaries(rows, spec)

        grand_total_hours = 0.0
        shift_counts = {}
        matched_names = []
        person_breakdown = []

        for r in rows:
            p_name = r.get(detected_name_col, "")
            if p_name and p_name not in matched_names:
                matched_names.append(p_name)

            p_hours, p_shifts = calculate_row_shift_hours(r, shift_rules)
            grand_total_hours += p_hours

            for sk, sc in p_shifts.items():
                shift_counts[sk] = shift_counts.get(sk, 0) + sc

            person_breakdown.append({
                "Họ và tên": p_name,
                "Tổng số giờ làm": p_hours,
                "Chi tiết ca": p_shifts
            })

        computed = {
            "row_count": len(rows),
            "matched_people_count": len(matched_names),
            "matched_people_list": matched_names[:PREVIEW_ROW_LIMIT],
            "target_person": name_res.resolved_name or target_person_name,
            "grand_total_hours": grand_total_hours,
            "shift_counts_breakdown": shift_counts,
            "person_breakdown": person_breakdown[:PREVIEW_ROW_LIMIT],
            "summary_facts": f"Tìm thấy {len(matched_names)} nhân sự khớp điều kiện. Tổng giờ làm: {grand_total_hours:,.1f} giờ.",
            "data_preview": rows[:PREVIEW_ROW_LIMIT]
        }
        if rows:
            computed["person_info"] = rows[0]
        return computed, sql, name_res

    # ═══════════════════════════════════════════════════════════════════════════
    # BRANCH 6: Fallback — simple single-table query (NO more LIMIT 100!)
    # ═══════════════════════════════════════════════════════════════════════════
    sql, params = _build_fallback_sql(spec, table_name, detected_name_col, name_res, target_person_name)

    rows = []
    try:
        res = await db_execute(db, text(sql), params)
        rows = [dict(r._mapping) if hasattr(r, "_mapping") else dict(r) for r in res.fetchall()]
    except Exception as e:
        logger.error("Error executing single table query: %s | SQL: %s", e, sql)
        rows = []

    rows = filter_rows_exact_word_boundaries(rows, spec)

    computed = {
        "row_count": len(rows),
        "total_in_db": primary_meta.get("row_count"),
        "target_person": name_res.resolved_name or target_person_name,
        "is_name_ambiguous": name_res.is_ambiguous,
        "name_candidates": name_res.candidates,
        "data_preview": rows[:PREVIEW_ROW_LIMIT]
    }

    if rows:
        target_row = rows[0]
        person_name = target_row.get(detected_name_col, name_res.resolved_name or "")
        dob_val = target_row.get(dob_col) if dob_col else None

        parsed_dt = parse_flexible_date(dob_val)
        today = date.today()

        if parsed_dt:
            years = today.year - parsed_dt.year - ((today.month, today.day) < (parsed_dt.month, parsed_dt.day))
            total_months = (today.year - parsed_dt.year) * 12 + (today.month - parsed_dt.month)
            if today.day < parsed_dt.day:
                total_months -= 1
            total_days = (today - parsed_dt.date()).days

            computed["exact_age_detail"] = {
                "birth_date_formatted": parsed_dt.strftime("%d/%m/%Y"),
                "years": years,
                "total_months": total_months,
                "total_days": total_days,
                "summary": f"Sinh ngày {parsed_dt.strftime('%d/%m/%Y')}. Hiện tại được {years} tuổi (hoặc {total_months} tháng, tương đương {total_days:,} ngày từ lúc sinh)."
            }
            computed["person_info"] = {
                "Họ và tên": person_name,
                "Ngày sinh": parsed_dt.strftime("%d/%m/%Y"),
                "Số tuổi": years,
                "Chi tiết bản ghi": target_row
            }
        else:
            computed["person_info"] = {
                "Họ và tên": person_name,
                "Chi tiết bản ghi": target_row
            }

    return computed, sql, name_res
