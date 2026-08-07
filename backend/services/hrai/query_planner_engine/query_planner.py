import json
import logging
import os
import re
from datetime import date
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field

try:
    from google import genai
except ImportError:
    try:
        import google.generativeai as genai
    except ImportError:
        genai = None

from services.hrai.config import get_settings

logger = logging.getLogger(__name__)


# ─── Data Models ─────────────────────────────────────────────────────────────

class DynamicFilterCondition(BaseModel):
    column: str
    operator: str = "="
    value: Any = None


class DynamicQuerySpec(BaseModel):
    intent_type: str = "record_lookup"
    selected_tables: List[str] = Field(default_factory=list)
    need_join: bool = False
    join_on_column: Optional[str] = None
    extracted_person_name: Optional[str] = None
    extracted_person_names: List[str] = Field(default_factory=list)
    target_columns: List[str] = Field(default_factory=list)
    filter_conditions: List[DynamicFilterCondition] = Field(default_factory=list)
    in_question_rules: Dict[str, Any] = Field(default_factory=dict)
    date_hint: Optional[str] = None
    calc_type: str = "none"
    reasoning: Optional[str] = None
    # ── NEW: LLM-generated SQL ──
    generated_sql: Optional[str] = None


# ─── Gemini Client ───────────────────────────────────────────────────────────

_client: Any = None


def _get_genai_client() -> Any:
    global _client
    if genai is None:
        raise ImportError("google-genai library not installed.")
    settings = get_settings()
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "Chưa cấu hình Gemini API Key! Vui lòng vào trang Cài đặt để nhập API Key hợp lệ."
        )
    if _client is None or getattr(_client, "_cached_api_key", None) != api_key:
        if hasattr(genai, "Client"):
            _client = genai.Client(api_key=api_key)
        else:
            genai.configure(api_key=api_key)
            _client = genai
        setattr(_client, "_cached_api_key", api_key)
    return _client


# ─── System Prompts ──────────────────────────────────────────────────────────

PLAN_SYSTEM_PROMPT = """Bạn là bộ phân tích truy vấn HR chuyên nghiệp, trả về JSON duy nhất.

NHIỆM VỤ: Phân tích câu hỏi, xem SCHEMA CÁC BẢNG CSDL và sinh ra:
1. Đặc tả ý định (intent_type, selected_tables, ...)
2. MỘT CÂU LỆNH SQL SELECT DUY NHẤT thực thi được, để truy vấn chính xác dữ liệu cần thiết.

SCHEMA CÁC BẢNG SẼ ĐƯỢC CUNG CẤP với: tên bảng, tên cột, kiểu dữ liệu, số lượng rows, giá trị enum mẫu, và 2 sample rows.

OUTPUT FORMAT (JSON):
{
  "intent_type": "record_lookup | statistics | age_calculation | work_hours | ranking | comparison | attendance_today | general",
  "selected_tables": ["bảng_cần_query"],
  "need_join": false,
  "join_on_column": null,
  "extracted_person_name": "tên người (hoặc null)",
  "extracted_person_names": [],
  "target_columns": [],
  "filter_conditions": [],
  "in_question_rules": {},
  "date_hint": null,
  "calc_type": "none | age | map_sum | min_date | max_date | compare_dates | count | avg | group_stats | find_duplicates",
  "reasoning": "Lý do chọn bảng và viết SQL",
  "generated_sql": "SELECT ..."
}

QUY TẮC VIẾT SQL:
1. CHỈ VIẾT SELECT. TUYỆT ĐỐI KHÔNG viết INSERT/UPDATE/DELETE/DROP/ALTER.
2. Tên bảng và cột PHẢI đặt trong dấu ngoặc kép: "table_name", "column_name".
3. CƠ SỞ DỮ LIỆU LÀ SQLite — dùng cú pháp SQLite:
   - Dùng GROUP_CONCAT() thay vì STRING_AGG().
   - Dùng strftime() cho xử lý ngày tháng.
   - Dùng LIKE cho tìm kiếm text.
   - Không có ILIKE, dùng LOWER() + LIKE.
4. QUY TẮC CHUẨN HÓA CHỮ HOA/THƯỜNG KHI THỐNG KÊ (CỰC KỲ QUAN TRỌNG):
   - Khi GROUP BY theo cột dạng chuỗi (vị trí, dự án, trạng thái...), LUÔN DÙNG `UPPER(TRIM("column_name"))` hoặc `COALESCE(NULLIF(UPPER(TRIM("column_name")), ''), 'Chưa cập nhật')` để không bị tách rời chữ hoa chữ thường (VD: 'Dev' và 'DEV' phải gom thành 1 nhóm).
   - Ví dụ thống kê vị trí: SELECT COALESCE(NULLIF(UPPER(TRIM("position")), ''), 'Chưa cập nhật vị trí') AS position, COUNT(*) AS count FROM "users" GROUP BY COALESCE(NULLIF(UPPER(TRIM("position")), ''), 'Chưa cập nhật vị trí') ORDER BY count DESC;
5. Khi câu hỏi YÊU CẦU THỐNG KÊ/TỔNG HỢP (đếm, nhóm, trùng lặp, tổng, trung bình):
   - PHẢI dùng GROUP BY, COUNT(*), SUM(), AVG(), HAVING.
   - KHÔNG BAO GIỜ dùng SELECT * LIMIT 100 cho câu hỏi thống kê.
   - Ví dụ trùng chính xác cả ngày/tháng/năm: SELECT "birthday", GROUP_CONCAT("full_name") as names, COUNT(*) as cnt FROM "users" WHERE "birthday" IS NOT NULL AND "birthday" != '' GROUP BY "birthday" HAVING COUNT(*) > 1;
   - Ví dụ cùng ngày/tháng sinh (không phân biệt năm sinh): SELECT strftime('%d/%m', "birthday") as day_month, GROUP_CONCAT("full_name" || ' (' || strftime('%Y', "birthday") || ')') as names, COUNT(*) as cnt FROM "users" WHERE "birthday" IS NOT NULL AND "birthday" != '' GROUP BY strftime('%d/%m', "birthday") HAVING COUNT(*) > 1;
6. Khi câu hỏi TÌM KIẾM CÁ NHÂN (tìm info 1 người):
   - Dùng WHERE với LIKE hoặc = để lọc chính xác (chú ý gọt khoảng trắng LOWER(TRIM("full_name"))).
7. Khi câu hỏi xếp hạng/top N:
   - Dùng ORDER BY + LIMIT phù hợp.
8. Khi CẦN JOIN 2 bảng:
   - Tìm cột chung (thường là cột tên) rồi dùng INNER JOIN.
9. Khi câu hỏi LIỆT KÊ TẤT CẢ (danh sách):
   - Dùng SELECT với ORDER BY, KHÔNG giới hạn LIMIT trừ khi user yêu cầu.
"""

SYNTHESIZE_SYSTEM_PROMPT = """Bạn là Trợ lý AI HR thông minh, chuyên nghiệp và chính xác của Viettel Software.
NHIỆM VỤ CỦA BẠN:
Đọc CÂU HỎI NGƯỜI DÙNG và DỮ LIỆU THẬT ĐÃ ĐƯỢC TRÍCH XUẤT TỪ CSDL HỆ THỐNG để trả lời trực tiếp câu hỏi bằng tiếng Việt tự nhiên.

QUY TẮC THỰC THI (RẤT QUAN TRỌNG):
1. CHỈ DỰA TRÊN DỮ LIỆU ĐƯỢC CUNG CẤP trong phần "DỮ LIỆU THẬT TỪ CSDL". Không tự bịa thông tin không có trong dữ liệu.
2. CHUẨN HÓA VÀ GOM NHÓM DỮ LIỆU HỢP LÝ:
   - Gom các giá trị giống nhau chỉ khác chữ hoa/thường (VD: "Dev" và "DEV" là cùng vị trí Dev).
   - Nếu tổng số bản ghi trong CSDL lớn hơn số bản ghi có thông tin (VD: tổng 233 nhân sự nhưng chỉ 21 nhân sự có điền vị trí), hãy nêu rõ số nhân sự theo vị trí và giải thích số còn lại chưa cập nhật thông tin vị trí trong sơ yếu lý lịch để người dùng hiểu rõ.
3. HỖ TRỢ TẠO FILE EXCEL:
   - Hệ thống AI HR Viettel CÓ HỖ TRỢ TỰ ĐỘNG XUẤT FILE EXCEL (.xlsx).
   - TUYỆT ĐỐI KHÔNG trả lời rằng "Hệ thống chưa hỗ trợ tạo file Excel" hoặc "Khuyên người dùng copy thủ công"!
   - Hãy khẳng định: "Hệ thống đã tổng hợp số liệu và sẵn sàng xuất file Excel báo cáo cho bạn (bấm nút Tải File Excel bên dưới)."
4. Trả lời rõ ràng, định dạng danh sách có gạch đầu dòng ngắn gọn, chuyên nghiệp.
"""


# ─── Helper Functions ────────────────────────────────────────────────────────

def resolve_column_name_fuzzy(col_name: str, valid_columns: List[str]) -> Optional[str]:
    if not col_name or not valid_columns:
        return None

    if col_name in valid_columns:
        return col_name

    c_low = col_name.strip().lower().replace("_", " ")

    for valid_col in valid_columns:
        v_low = valid_col.strip().lower().replace("_", " ")
        if c_low == v_low:
            return valid_col
        if c_low in v_low or v_low.startswith(c_low):
            return valid_col

        v_clean = re.sub(r'\bvd\b.*', '', v_low).strip()
        if c_low in v_clean or v_clean in c_low:
            return valid_col

    return None


def validate_and_fix_spec_data(spec_data: Dict[str, Any], all_valid_columns: List[str]) -> Tuple[DynamicQuerySpec, Optional[str]]:
    target_cols = spec_data.get("target_columns", [])
    fixed_target_cols = []
    for col in target_cols:
        resolved = resolve_column_name_fuzzy(str(col), all_valid_columns)
        if resolved and resolved not in fixed_target_cols:
            fixed_target_cols.append(resolved)

    fixed_conditions = []
    invalid_cols = []
    raw_conds = spec_data.get("filter_conditions", [])

    for cond in raw_conds:
        if isinstance(cond, dict):
            c_col = cond.get("column", "")
            resolved = resolve_column_name_fuzzy(str(c_col), all_valid_columns)
            if resolved:
                cond["column"] = resolved
                fixed_conditions.append(DynamicFilterCondition(**cond))
            else:
                invalid_cols.append(c_col)
        elif isinstance(cond, str):
            m = re.search(r'([^\s=<>!]+)\s*(=|LIKE|>|<)\s*[\'"]?([^\'"]+)[\'"]?', cond)
            if m:
                col_name, op, val = m.group(1), m.group(2), m.group(3)
                resolved = resolve_column_name_fuzzy(col_name, all_valid_columns)
                if resolved:
                    fixed_conditions.append(DynamicFilterCondition(column=resolved, operator=op, value=val))

    person_name = spec_data.get("extracted_person_name")
    person_names = spec_data.get("extracted_person_names", [])

    if person_name and not person_names:
        person_names = [person_name]

    spec_data["target_columns"] = fixed_target_cols
    spec_data["filter_conditions"] = fixed_conditions
    spec_data["extracted_person_name"] = person_name
    spec_data["extracted_person_names"] = person_names

    if not isinstance(spec_data.get("in_question_rules"), dict):
        spec_data["in_question_rules"] = {}

    # Ensure generated_sql is present
    if "generated_sql" not in spec_data or not spec_data["generated_sql"]:
        spec_data["generated_sql"] = None

    spec = DynamicQuerySpec(**spec_data)
    if invalid_cols:
        return spec, f"Các cột {invalid_cols} không tồn tại trong CSDL. Danh sách cột hợp lệ: {all_valid_columns}"
    return spec, None


def _call_gemini_generate(client: Any, system: str, prompt: str, is_json: bool = False) -> str:
    settings = get_settings()
    model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"

    config = {
        "system_instruction": system,
        "temperature": 0.0,
    }
    if is_json:
        config["response_mime_type"] = "application/json"

    try:
        if hasattr(client, "models"):
            resp = client.models.generate_content(model=model_name, contents=prompt, config=config)
            return resp.text.strip()
        else:
            gmodel = client.GenerativeModel(model_name=model_name, system_instruction=system)
            resp = gmodel.generate_content(prompt, generation_config=config)
            return resp.text.strip()
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
            logger.error("Gemini API 429 Quota Exceeded on model %s", model_name)
            raise ValueError(
                f"⚠️ Gemini API Key hoặc Model '{model_name}' hiện tại đã HẾT HẠN NGẠCH (429 Quota Exceeded). "
                f"Vui lòng vào phần Cài đặt để cập nhật API Key mới hoặc chọn Model khác nhé!"
            )
        raise e


# ─── Request 1: Extract Spec + Generate SQL ──────────────────────────────────

def _build_compact_schema_prompt(multi_schema_snapshot: Dict[str, Any]) -> str:
    """Build a token-efficient schema description for the LLM prompt."""
    lines = []
    for t_info in multi_schema_snapshot.get("tables", []):
        t_name = t_info["table_name"]
        cols = t_info.get("columns", [])
        row_count = t_info.get("row_count", "?")
        enum_vals = t_info.get("enum_values", {})

        lines.append(f'### Bảng "{t_name}" ({row_count} rows)')
        lines.append(f'  Cột: {", ".join(cols)}')

        # Show enum values (compact)
        if enum_vals:
            enum_parts = []
            for col, vals in enum_vals.items():
                vals_str = ", ".join([str(v) for v in vals[:8]])
                enum_parts.append(f'    "{col}": [{vals_str}]')
            if enum_parts:
                lines.append("  Giá trị mẫu:")
                lines.extend(enum_parts)

        # Show 2 sample rows (compact)
        sample_rows = t_info.get("sample_rows", [])
        if sample_rows:
            lines.append(f"  Ví dụ {len(sample_rows)} rows:")
            for sr in sample_rows[:2]:
                # Truncate long values
                compact_row = {}
                for k, v in sr.items():
                    v_str = str(v) if v is not None else "NULL"
                    if len(v_str) > 40:
                        v_str = v_str[:37] + "..."
                    compact_row[k] = v_str
                lines.append(f"    {json.dumps(compact_row, ensure_ascii=False)}")

        lines.append("")

    return "\n".join(lines)


async def extract_dynamic_spec_llm(
    question: str,
    multi_schema_snapshot: Dict[str, Any],
    max_retries: int = 1
) -> DynamicQuerySpec:
    client = _get_genai_client()

    all_cols = []
    for t_info in multi_schema_snapshot.get("tables", []):
        all_cols.extend(t_info.get("columns", []))

    schema_text = _build_compact_schema_prompt(multi_schema_snapshot)

    feedback = ""
    for attempt in range(max_retries + 1):
        prompt = (
            f"SCHEMA CÁC BẢNG TRONG CSDL HỆ THỐNG:\n"
            f"{schema_text}\n"
            f"COMMON JOIN KEYS: {json.dumps(multi_schema_snapshot.get('common_join_keys', []), ensure_ascii=False)}\n\n"
            f"CÂU HỎI NGƯỜI DÙNG: {question}\n"
            + (f"\n[LƯU Ý LỖI CẦN SỬA Ở LẦN THỬ TRƯỚC]: {feedback}\n" if feedback else "")
        )

        try:
            raw_text = _call_gemini_generate(client, PLAN_SYSTEM_PROMPT, prompt, is_json=True)
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            spec_data = json.loads(raw_text)
            fixed_spec, err = validate_and_fix_spec_data(spec_data, all_cols)

            # Validate the generated SQL
            if fixed_spec.generated_sql:
                from services.hrai.ai_pipeline.execution_engine import validate_sql
                sql_err = validate_sql(fixed_spec.generated_sql)
                if sql_err:
                    logger.warning("Attempt %d: Generated SQL failed validation: %s", attempt + 1, sql_err)
                    feedback = f"SQL bạn sinh ra không hợp lệ: {sql_err}. Hãy sửa lại SQL cho đúng."
                    continue

            if err is None or not all_cols:
                return fixed_spec

            logger.warning("Attempt %d: Column spec validation issue (%s). Retrying...", attempt + 1, err)
            feedback = err
        except ValueError as val_err:
            raise val_err
        except Exception as e:
            logger.warning("Attempt %d: Error generating dynamic spec: %s", attempt + 1, e)
            feedback = str(e)

    return DynamicQuerySpec(
        intent_type="general",
        selected_tables=[multi_schema_snapshot["tables"][0]["table_name"]] if multi_schema_snapshot.get("tables") else [],
        need_join=False,
        extracted_person_name=None,
        extracted_person_names=[],
        target_columns=[],
        calc_type="none",
        reasoning="Fallback spec parsing"
    )


# ─── Request 2: Synthesize Natural Language Response ─────────────────────────

MAX_PREVIEW_ROWS_FOR_LLM = 50

def format_fallback_response(question: str, computed_result: Dict[str, Any]) -> str:
    """Tự động định dạng dữ liệu CSDL tìm thấy thành giao diện văn bản Markdown cực kỳ đẹp mắt & rõ ràng."""
    rows = computed_result.get("rows", [])
    if not rows and "data_preview" in computed_result:
        rows = computed_result.get("data_preview", [])
        
    row_cnt = computed_result.get("row_count", len(rows))
    
    if not rows or row_cnt == 0:
        return "Không tìm thấy dữ liệu phù hợp trong CSDL."
    
    lines = [f"Đã tìm thấy **{row_cnt} kết quả** phù hợp trong CSDL:\n"]
    
    for idx, row in enumerate(rows[:50], 1):
        if not isinstance(row, dict):
            lines.append(f"{idx}. {row}")
            continue
            
        code = row.get("employee_code") or row.get("Mã NV") or row.get("user_code") or ""
        name = row.get("full_name") or row.get("Họ và tên") or row.get("user_name") or ""
        shift = row.get("shift") or row.get("ca") or ""
        work_day = row.get("work_day") or row.get("ngày") or ""
        project = row.get("project") or row.get("dự án") or ""
        phone = row.get("phone") or row.get("sđt") or ""
        status = row.get("working_status") or row.get("trạng thái") or ""
        
        item_parts = []
        if name:
            name_str = f"**{name}**"
            if code:
                name_str += f" (`{code}`)"
            item_parts.append(name_str)
        elif code:
            item_parts.append(f"Mã: `{code}`")
            
        if shift:
            s_up = str(shift).upper()
            shift_label = "Cả ngày (SC)" if s_up == "SC" else ("Ca sáng (S)" if s_up == "S" else ("Ca chiều (C)" if s_up == "C" else shift))
            item_parts.append(f"Ca làm: **{shift_label}**")
        if work_day:
            item_parts.append(f"Ngày: `{work_day}`")
        if project:
            item_parts.append(f"Dự án: `{project}`")
        if phone:
            item_parts.append(f"SĐT: `{phone}`")
        if status:
            item_parts.append(f"Trạng thái: `{status}`")
            
        if item_parts:
            lines.append(f"{idx}. " + " — ".join(item_parts))
        else:
            # Fallback formatting for arbitrary dictionary key-values
            kv_pairs = [f"{k}: **{v}**" for k, v in row.items() if v is not None and k != "id"]
            lines.append(f"{idx}. " + " | ".join(kv_pairs[:5]))
            
    if row_cnt > 50:
        lines.append(f"\n*(Đã ẩn {row_cnt - 50} kết quả còn lại để tối ưu hiển thị)*")
        
    return "\n".join(lines)


async def synthesize_answer_llm(
    question: str,
    computed_result: Dict[str, Any],
    client: Any,
    today_str: str,
) -> str:
    compact = {}
    for k, v in computed_result.items():
        if k == "rows" and isinstance(v, list):
            rows = v
            if len(rows) > MAX_PREVIEW_ROWS_FOR_LLM:
                compact["data_preview"] = rows[:MAX_PREVIEW_ROWS_FOR_LLM]
                compact["data_preview_note"] = f"Hiển thị {MAX_PREVIEW_ROWS_FOR_LLM}/{len(rows)} bản ghi. Tổng thực tế: {len(rows)} bản ghi."
            else:
                compact["data_preview"] = rows
        elif k == "person_breakdown" and isinstance(v, list) and len(v) > MAX_PREVIEW_ROWS_FOR_LLM:
            compact[k] = v[:MAX_PREVIEW_ROWS_FOR_LLM]
            compact["person_breakdown_note"] = f"Hiển thị {MAX_PREVIEW_ROWS_FOR_LLM}/{len(v)} người. Tổng thực tế: {len(v)} người."
        else:
            compact[k] = v

    prompt = (
        f"CÂU HỎI NGƯỜI DÙNG: \"{question}\"\n\n"
        f"THỜI HẠN MÁY CHỦ HỆ THỐNG HIỆN TẠI (TODAY): {today_str}\n\n"
        f"DỮ LIỆU THẬT ĐÃ TRÍCH XUẤT TỪ CSDL HỆ THỐNG:\n"
        f"{json.dumps(compact, ensure_ascii=False, indent=2)}\n\n"
        f"HÃY DỰA TRÊN DỮ LIỆU THẬT TRÊN ĐỂ SUY LUẬN LOGIC VÀ TRẢ LỜI CÂU HỎI MỘT CÁCH CHÍNH XÁC VÀ TỰ NHIÊN:"
    )

    try:
        return _call_gemini_generate(client, SYNTHESIZE_SYSTEM_PROMPT, prompt, is_json=False)
    except ValueError as val_err:
        return str(val_err)
    except Exception as e:
        logger.error("Error synthesizing response LLM: %s", e)
        return format_fallback_response(question, computed_result)


async def synthesize_dynamic_response_llm(
    question: str,
    computed_result: Dict[str, Any]
) -> str:
    try:
        client = _get_genai_client()
    except Exception as e:
        logger.error("Failed to get genai client for synthesis: %s", e)
        return format_fallback_response(question, computed_result)

    today_str = date.today().strftime('%d/%m/%Y')
    return await synthesize_answer_llm(question, computed_result, client, today_str)
