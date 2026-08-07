import json
import re
import logging
import datetime
from typing import Dict, Any, List
from sqlalchemy import text
from database_utils import db_execute, db_commit
from services.hrai.sheet_pipeline import preprocess_sheet_raw_data, is_summary_row

logger = logging.getLogger(__name__)

def remove_vietnamese_accents(s: str) -> str:
    if not s:
        return ""
    s = str(s)
    accents = {
        'a': 'àáảãạăằắẳẵặâầấẩẫậ',
        'A': 'ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ',
        'd': 'đ',
        'D': 'Đ',
        'e': 'èéẻẽẹêềếểễệ',
        'E': 'ÈÉẺẼẸÊỀẾỂỄỆ',
        'i': 'ìíỉĩị',
        'I': 'ÌÍỈĨỊ',
        'o': 'òóỏõọôồốổỗộơờớởỡợ',
        'O': 'ÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ',
        'u': 'ùúủũụưừứửữự',
        'U': 'ÙÚỦŨỤƯỪỨỬỮỰ',
        'y': 'ỳýỷỹỵ',
        'Y': 'ỲÝỶỸỴ'
    }
    for char, accented_chars in accents.items():
        for ac in accented_chars:
            s = s.replace(ac, char)
    return s


def sanitize_column_name(col_name: str) -> str:
    if not col_name:
        return "col"
    clean = remove_vietnamese_accents(col_name)
    clean = re.sub(r'[^a-zA-Z0-9]', '_', clean).lower()
    clean = re.sub(r'_+', '_', clean).strip('_')
    return clean or "col"


def generate_clean_table_name(raw_title: str) -> str:
    if not raw_title:
        return "sheet_table"
    clean = remove_vietnamese_accents(raw_title)
    clean = re.sub(r'[^a-zA-Z0-9]', '_', clean).lower()
    clean = re.sub(r'_+', '_', clean).strip('_')
    if not clean.startswith("sheet_"):
        clean = f"sheet_{clean}"
    return clean or "sheet_table"


async def create_table_and_sync_sheet(request_data: Dict[str, Any], db: Any) -> Dict[str, Any]:
    sheet_url = request_data.get("sheet_url")
    tab_name = request_data.get("tab_name")
    excluded_columns = request_data.get("excluded_columns", [])
    accept_inferred = bool(request_data.get("accept_inferred_field", False))

    raw_info = preprocess_sheet_raw_data(sheet_url, tab_name)
    all_values = raw_info.get("all_values", [])
    if not all_values:
        raise ValueError("Sheet không có dữ liệu!")

    clean_table_name = generate_clean_table_name(raw_info.get("tab_name") or raw_info.get("sheet_title"))

    raw_columns = raw_info.get("columns", [])
    start_data_idx = raw_info.get("start_data_idx", 1)
    data_rows = all_values[start_data_idx:]
    sections = raw_info.get("sections", [])

    section_titles = [s["text"] for s in sections]

    headers = []
    seen_sql_names = set()

    for col in raw_columns:
        c_idx = col["column_index"]
        orig_name = col["field_name"]

        if str(c_idx) in excluded_columns or orig_name in excluded_columns:
            continue

        base_sql_name = sanitize_column_name(orig_name)
        sql_name = base_sql_name
        counter = 1
        while sql_name.lower() in seen_sql_names:
            sql_name = f"{base_sql_name}_{counter}"
            counter += 1
        seen_sql_names.add(sql_name.lower())

        col_type = "TEXT"
        fn_lower = orig_name.lower()
        if "stt" in fn_lower or fn_lower == "id":
            col_type = "INTEGER"

        headers.append({
            "idx": c_idx,
            "original_name": orig_name,
            "sql_name": sql_name,
            "type": col_type
        })

    inferred_proposal = request_data.get("inferred_proposal") or {}
    if not isinstance(inferred_proposal, dict):
        inferred_proposal = {}
    raw_inferred_name = inferred_proposal.get("field_name", "loai_nhan_su")
    inferred_field_name = sanitize_column_name(raw_inferred_name)
    default_val = inferred_proposal.get("default_value") or inferred_proposal.get("mapping", {}).get("__default__", "TTS")
    mapping = inferred_proposal.get("mapping", {})

    is_sqlite = "sqlite" in str(db.bind.url) if hasattr(db, "bind") and db.bind else True
    id_col_sql = "id INTEGER PRIMARY KEY AUTOINCREMENT" if is_sqlite else "id SERIAL PRIMARY KEY"

    columns_sql = [id_col_sql]
    for h in headers:
        columns_sql.append(f'"{h["sql_name"]}" {h["type"]}')

    if accept_inferred and inferred_field_name:
        columns_sql.append(f'"{inferred_field_name}" TEXT')

    drop_sql = f'DROP TABLE IF EXISTS "{clean_table_name}"' if is_sqlite else f'DROP TABLE IF EXISTS "{clean_table_name}" CASCADE'
    await db_execute(db, text(drop_sql))
    create_sql = f'CREATE TABLE "{clean_table_name}" ({", ".join(columns_sql)})'
    await db_execute(db, text(create_sql))

    curr_status = default_val
    inserted_count = 0

    for idx, r in enumerate(data_rows):
        non_empty = [str(c).strip() for c in r if str(c).strip()]
        if not non_empty:
            continue

        # Skip summary rows (e.g. TỔNG CỘNG...)
        if is_summary_row(r):
            continue

        if len(non_empty) == 1 and non_empty[0] in section_titles:
            sec_title = non_empty[0]
            curr_status = mapping.get(sec_title, sec_title)
            continue

        row_dict = {}
        for h in headers:
            val = r[h["idx"]].strip() if h["idx"] < len(r) else ""
            if h["type"] == "INTEGER":
                try:
                    val = int(val) if val else None
                except ValueError:
                    val = None
            row_dict[h["sql_name"]] = val

        if accept_inferred and inferred_field_name:
            row_dict[inferred_field_name] = curr_status

        col_names = ', '.join([f'"{k}"' for k in row_dict.keys()])
        val_placeholders = ', '.join([f':{k}' for k in row_dict.keys()])
        insert_sql = f'INSERT INTO "{clean_table_name}" ({col_names}) VALUES ({val_placeholders})'

        await db_execute(db, text(insert_sql), row_dict)
        inserted_count += 1

    meta_table_sql = """
    CREATE TABLE IF NOT EXISTS "_sheet_metadata" (
        table_name TEXT PRIMARY KEY,
        sheet_url TEXT,
        tab_name TEXT,
        excluded_columns TEXT,
        accept_inferred_field INTEGER,
        inferred_proposal TEXT,
        last_synced TEXT
    );
    """
    await db_execute(db, text(meta_table_sql))
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    upsert_sql = """
    INSERT INTO "_sheet_metadata" (table_name, sheet_url, tab_name, excluded_columns, accept_inferred_field, inferred_proposal, last_synced)
    VALUES (:table_name, :sheet_url, :tab_name, :excluded_columns, :accept_inferred_field, :inferred_proposal, :last_synced)
    ON CONFLICT(table_name) DO UPDATE SET
        sheet_url=excluded.sheet_url,
        tab_name=excluded.tab_name,
        excluded_columns=excluded.excluded_columns,
        accept_inferred_field=excluded.accept_inferred_field,
        inferred_proposal=excluded.inferred_proposal,
        last_synced=excluded.last_synced;
    """
    await db_execute(db, text(upsert_sql), {
        "table_name": clean_table_name,
        "sheet_url": sheet_url,
        "tab_name": raw_info["tab_name"],
        "excluded_columns": json.dumps(excluded_columns),
        "accept_inferred_field": 1 if accept_inferred else 0,
        "inferred_proposal": json.dumps(inferred_proposal),
        "last_synced": now_str
    })

    await db_commit(db)
    return {
        "table_name": clean_table_name,
        "row_count": inserted_count,
        "columns_count": len(headers),
        "last_synced": now_str
    }
