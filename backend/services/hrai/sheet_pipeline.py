import os
import io
import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel

try:
    from google import genai
except ImportError:
    genai = None

from services.hrai.config import get_settings
from services.hrai.google_sheets import (
    read_google_sheet,
    read_google_sheet_raw_values
)


logger = logging.getLogger(__name__)

SUMMARY_EXACT_KEYWORDS = {
    "tổng cộng", "tổng", "total", "grand total", "cộng chung", 
    "tổng số", "tổng số buổi", "tổng buổi", "cộng", "tổng số lượt",
    "tổng công", "tổng số công", "thống kê", "subtotal"
}

SUMMARY_PREFIXES = (
    "tổng cộng", "tổng:", "tổng ", "total:", "total ", 
    "grand total", "cộng chung", "tổng số", "cộng:"
)


def is_summary_row(row: list) -> bool:
    """Kiểm tra xem một hàng trong sheet có phải là hàng tổng cộng/thống kê hay không."""
    if not row:
        return True
    
    for cell in row:
        if cell is None:
            continue
        val = str(cell).strip().lower()
        if not val:
            continue
        if val in SUMMARY_EXACT_KEYWORDS:
            return True
        if any(val.startswith(pfx) for pfx in SUMMARY_PREFIXES):
            return True

    return False


class ColumnSpec(BaseModel):
    column_index: int
    field_name: str
    header_components: List[str]


class SheetStructureAnalysis(BaseModel):
    header_start_row: int
    is_multi_header: bool
    combined_columns: List[ColumnSpec]
    sections: List[Dict[str, Any]]
    sample_data: List[Dict[str, Any]]


def preprocess_2d_raw_data(all_values: List[List[str]], sheet_title: str, tab_name: str) -> Dict[str, Any]:
    if not all_values:
        return {
            "sheet_title": sheet_title,
            "tab_name": tab_name,
            "columns": [],
            "sections": [],
            "rows": [],
            "total_rows": 0,
            "is_multi_header": False,
            "start_data_idx": 1,
            "all_values": []
        }

    header_start_idx = 0
    for r_idx, row in enumerate(all_values[:5]):
        row_str = " ".join([str(c).lower() for c in row if str(c).strip()])
        if "stt" in row_str or "họ và tên" in row_str or "mã nv" in row_str or "role" in row_str:
            header_start_idx = r_idx
            break

    h_row1 = all_values[header_start_idx] if header_start_idx < len(all_values) else []
    h_row2 = all_values[header_start_idx + 1] if (header_start_idx + 1) < len(all_values) else []

    is_multi_header = False
    if h_row2:
        h2_str = " ".join([str(c).lower() for c in h_row2 if str(c).strip()])
        if any(kw in h2_str for kw in ["thứ 2", "thứ 3", "thứ 4", "thứ 5", "thứ 6", "thứ 7", "cn", "tháng 1", "tháng 2", "tháng 3", "học việc", "đánh giá", "lộ trình"]):
            is_multi_header = True

    combined_columns = []
    max_cols = max(len(h_row1), len(h_row2))

    last_h1 = ""
    for idx in range(max_cols):
        h1 = str(h_row1[idx]).strip() if idx < len(h_row1) else ""
        if h1:
            last_h1 = h1
        else:
            h1 = last_h1 if is_multi_header else ""

        h2 = str(h_row2[idx]).strip() if (is_multi_header and idx < len(h_row2)) else ""

        if is_multi_header and h2 and h1 and h1 != h2:
            full_col_name = f"{h1} | {h2}"
        else:
            full_col_name = h1 or h2 or f"Cột_{idx+1}"

        if not h1 and not h2 and idx > 15:
            continue

        combined_columns.append({
            "column_index": idx,
            "field_name": full_col_name,
            "header_components": [h1, h2] if (is_multi_header and h2) else [h1]
        })

    start_data_idx = header_start_idx + (2 if is_multi_header else 1)
    data_rows = all_values[start_data_idx:]

    sections = []
    valid_data_rows = []
    for r_offset, row in enumerate(data_rows):
        actual_row_num = start_data_idx + r_offset + 1
        non_empty = [str(c).strip() for c in row if str(c).strip()]

        if not non_empty:
            continue

        # Skip summary rows (TỔNG CỘNG...)
        if is_summary_row(row):
            continue

        first_val = non_empty[0]
        is_date_str = bool(re.search(r'^\d{4}-\d{2}-\d{2}', first_val) or re.search(r'^\d{1,2}/\d{1,2}/\d{2,4}', first_val))
        is_single_cell = (len(non_empty) <= 3 and len(first_val) < 80 and not first_val.isdigit() and not is_date_str and len(non_empty) < max(2, len(combined_columns) // 3))
        is_known_divider = any(kw in first_val.lower() for kw in ["mượn", "mượn người", "tạm nghỉ", "lên chính thức", "đã nghỉ", "học việc"]) and len(non_empty) <= 5 and not is_date_str

        if is_single_cell or is_known_divider:
            sections.append({
                "row": actual_row_num,
                "text": first_val,
                "style": {"bold": True, "type": "section_divider"}
            })
        else:
            valid_data_rows.append(row)

    for col in combined_columns:
        c_idx = col["column_index"]
        samples = []
        for row in valid_data_rows:
            if c_idx < len(row) and str(row[c_idx]).strip():
                if len([c for c in row if str(c).strip()]) == 1 and str(row[c_idx]).strip() in [s["text"] for s in sections]:
                    continue
                samples.append(str(row[c_idx]).strip())
                if len(samples) >= 3:
                    break
        col["sample_values"] = samples

    return {
        "sheet_title": sheet_title,
        "tab_name": tab_name,
        "is_multi_header": is_multi_header,
        "columns": combined_columns,
        "sections": sections,
        "total_rows": len(valid_data_rows),
        "start_data_idx": start_data_idx,
        "all_values": [[str(c) if c is not None else "" for c in row] for row in all_values],
    }


def fetch_google_sheet_data(sheet_url: str, tab_name: Optional[str] = None) -> Tuple[List[List[str]], str, str]:
    """Fetch 2D raw values from a Google Sheet URL (via connected Google Account, CSV export, or gspread)."""
    import csv
    import urllib.request
    import urllib.parse
    
    match_id = re.search(r'/d/([a-zA-Z0-9-_]+)', sheet_url)
    if not match_id:
        raise ValueError(f"URL Google Sheet không hợp lệ (không tìm thấy Spreadsheet ID): {sheet_url}")
    
    spreadsheet_id = match_id.group(1)
    gid = "0"
    match_gid = re.search(r'[#&?]gid=([0-9]+)', sheet_url)
    if match_gid:
        gid = match_gid.group(1)

    # Attempt 1: Try using connected Google Account (GoogleSheetsService credentials)
    try:
        from services.google_sheets_service import GoogleSheetsService
        creds, _ = GoogleSheetsService.get_credentials()
        if creds:
            from googleapiclient.discovery import build
            service = build('sheets', 'v4', credentials=creds)
            sheet_meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
            sheet_title = sheet_meta.get('properties', {}).get('title', 'Google Sheet')
            sheets = sheet_meta.get('sheets', [])
            target_sheet = sheets[0] if sheets else {}
            if tab_name:
                for s in sheets:
                    if s.get('properties', {}).get('title') == tab_name:
                        target_sheet = s
                        break
            
            ws_title = target_sheet.get('properties', {}).get('title', 'Sheet1')
            result = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id, 
                range=ws_title
            ).execute()
            all_values = result.get('values', [])
            if all_values:
                return all_values, sheet_title, ws_title
    except Exception as e_gg:
        logger.warning("GoogleSheetsService credential fetch warning: %s. Trying direct CSV export...", e_gg)
        
    # Attempt 1: Export as CSV via public Google Sheets URL (requires no API credentials!)
    export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}"
    try:
        req = urllib.request.Request(
            export_url, 
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode('utf-8-sig', errors='replace')
            reader = csv.reader(io.StringIO(content))
            all_values = [list(row) for row in reader]
            if all_values:
                title = tab_name or f"Sheet_{spreadsheet_id[:8]}"
                return all_values, title, title
    except Exception as e:
        logger.warning("Direct CSV export failed for sheet %s: %s. Trying gspread fallback...", spreadsheet_id, e)
        
    # Attempt 2: Fallback via gspread if service account json exists
    try:
        import gspread
        creds_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "config", "google_oauth.json"))
        if not os.path.exists(creds_file):
            creds_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "config", "credentials.json"))
            
        if os.path.exists(creds_file):
            gc = gspread.service_account(filename=creds_file)
            sh = gc.open_by_key(spreadsheet_id)
            ws = sh.get_worksheet(0)
            return ws.get_all_values(), sh.title, ws.title
    except Exception as e2:
        logger.error("gspread fallback failed: %s", e2)
        
    raise ValueError(
        f"Không thể tải dữ liệu từ Google Sheet. Vui lòng đảm bảo link đã được bật chế độ 'Bất kỳ ai có liên kết đều có thể xem'."
    )


def preprocess_sheet_raw_data(sheet_url: str, tab_name: Optional[str] = None) -> Dict[str, Any]:
    all_values, sheet_title, worksheet_title = fetch_google_sheet_data(sheet_url, tab_name)
    return preprocess_2d_raw_data(all_values, sheet_title, tab_name or worksheet_title)


def preprocess_excel_raw_data(file_bytes: bytes, filename: str, sheet_name: Optional[str] = None) -> Dict[str, Any]:
    import io
    all_values = []
    target_sheet_name = sheet_name or "Sheet1"

    # Attempt 1: openpyxl
    try:
        import openpyxl
        wb = openpyxl.load_workbook(filename=io.BytesIO(file_bytes), data_only=True)
        target_sheet_name = sheet_name if (sheet_name and sheet_name in wb.sheetnames) else wb.sheetnames[0]
        ws = wb[target_sheet_name]

        for row in ws.iter_rows(values_only=True):
            row_vals = []
            for cell in row:
                if cell is None:
                    row_vals.append("")
                elif hasattr(cell, "strftime"):
                    row_vals.append(cell.strftime("%Y-%m-%d"))
                else:
                    row_vals.append(str(cell).strip())
            all_values.append(row_vals)
    except Exception as e1:
        logger.warning("openpyxl parse failed for %s: %s. Trying pandas fallback...", filename, e1)
        try:
            import pandas as pd
            df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet_name or 0, header=None)
            df = df.fillna("")
            all_values = df.astype(str).values.tolist()
            target_sheet_name = sheet_name or "Sheet1"
        except Exception as e2:
            logger.error("pandas parse also failed: %s", e2)
            raise ValueError(f"Không thể đọc file Excel '{filename}'. Vui lòng kiểm tra file hoặc lưu ở định dạng .xlsx tiêu chuẩn. Lỗi: {str(e1)}")

    clean_filename = re.sub(r'\.(xlsx|xls)$', '', filename, flags=re.IGNORECASE)
    return preprocess_2d_raw_data(all_values, clean_filename, target_sheet_name)


def analyze_sheet_structure_dynamic(all_values: List[List[str]]) -> SheetStructureAnalysis:
    if not all_values:
        return SheetStructureAnalysis(
            header_start_row=1,
            is_multi_header=False,
            combined_columns=[],
            sections=[],
            sample_data=[]
        )

    header_start_idx = 0
    for r_idx, row in enumerate(all_values[:10]):
        non_empty = [c.strip() for c in row if c.strip()]
        if len(non_empty) >= 3:
            header_start_idx = r_idx
            break

    h_row1 = all_values[header_start_idx] if header_start_idx < len(all_values) else []
    h_row2 = all_values[header_start_idx + 1] if (header_start_idx + 1) < len(all_values) else []

    is_multi_header = False
    if h_row2:
        non_empty_h1 = [c.strip() for c in h_row1 if c.strip()]
        non_empty_h2 = [c.strip() for c in h_row2 if c.strip()]
        if len(non_empty_h2) >= 3 and len(non_empty_h1) >= 1:
            is_multi_header = True

    combined_columns = []
    max_cols = max(len(h_row1), len(h_row2))

    last_h1 = ""
    for idx in range(max_cols):
        h1 = h_row1[idx].strip() if idx < len(h_row1) else ""
        if h1:
            last_h1 = h1
        else:
            h1 = last_h1 if is_multi_header else ""

        h2 = h_row2[idx].strip() if (is_multi_header and idx < len(h_row2)) else ""

        if is_multi_header and h2 and h1 and h1 != h2:
            full_col_name = f"{h1} | {h2}"
        else:
            full_col_name = h1 or h2 or f"Cột_{idx+1}"

        if not h1 and not h2 and idx > 20:
            continue

        combined_columns.append(ColumnSpec(
            column_index=idx,
            field_name=full_col_name,
            header_components=[h1, h2] if (is_multi_header and h2) else [h1]
        ))

    start_data_idx = header_start_idx + (2 if is_multi_header else 1)
    data_rows = all_values[start_data_idx:]

    sections = []
    for r_offset, row in enumerate(data_rows):
        actual_row_num = start_data_idx + r_offset + 1
        non_empty = [c.strip() for c in row if c.strip()]

        if non_empty:
            first_val = non_empty[0]
            is_section_divider = (1 <= len(non_empty) <= 3 and not first_val.replace('.', '').isdigit() and len(first_val) < 80)

            if is_section_divider and len(non_empty) < (len(combined_columns) // 2):
                sections.append({
                    "row": actual_row_num,
                    "text": first_val,
                    "style": {"bold": True, "type": "section_divider"}
                })

    sample_data = []
    for row in data_rows[:5]:
        row_dict = {}
        has_content = False
        for col in combined_columns:
            c_idx = col.column_index
            val = row[c_idx].strip() if c_idx < len(row) else ""
            row_dict[col.field_name] = val
            if val:
                has_content = True
        if has_content:
            sample_data.append(row_dict)

    return SheetStructureAnalysis(
        header_start_row=header_start_idx + 1,
        is_multi_header=is_multi_header,
        combined_columns=combined_columns,
        sections=sections,
        sample_data=sample_data
    )


async def analyze_columns_with_gemini_stage1(columns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        return [
            {
                "column_index": c["column_index"],
                "field_name": c["field_name"],
                "description": f"Trường {c['field_name']}",
                "data_type": "TEXT",
                "semantic_features": {
                    "key_traits": ["Dữ liệu dạng văn bản"],
                    "search_keywords": [c["field_name"]]
                },
                "sample_values": c.get("sample_values", [])
            }
            for c in columns
        ]

    client = None
    if genai is not None:
        try:
            if hasattr(genai, "Client"):
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
            else:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                client = genai
        except Exception:
            client = None

    def col_to_letter(col_idx):
        result = ""
        while col_idx >= 0:
            result = chr(col_idx % 26 + 65) + result
            col_idx = col_idx // 26 - 1
        return result

    formatted_columns = []
    for c in columns:
        col_letter = col_to_letter(c["column_index"])
        formatted_columns.append({
            "column_letter": col_letter,
            "column_index": c["column_index"],
            "field_name": c["field_name"],
            "header_components": c.get("header_components", []),
            "sample_values": c.get("sample_values", [])
        })

    prompt = f"""
    Bạn là chuyên gia phân tích CSDL. Hãy phân tích danh sách các cột dưới đây.
    RÀNG BUỘC CỰC KỲ QUAN TRỌNG VỀ TÊN CỘT:
    1. Giữ nguyên 100% giá trị 'field_name', KHÔNG ĐƯỢC ĐỔI TÊN, DỊCH TÊN HAY ĐỔI 'Lộ trình' THÀNH 'Lương'.
    2. Các cột chứa chữ 'Lộ trình' (như Tháng 1, Tháng 2, Tháng 3) là các bước trong Lộ trình học việc/chính thức, KHÔNG PHẢI LƯƠNG. Bắt buộc gom các trường này dưới nhóm ngữ nghĩa Lộ trình trong JSON.
    3. Trả về đúng tên cột 'field_name' ứng với từng 'column_letter'.
    4. Xác định kiểu dữ liệu 'data_type' (chọn 1 trong: TEXT, INTEGER, NUMERIC, DATE, BOOLEAN).
    5. Tạo mô tả 'description' SIÊU NGẮN và NỔI BẬT NHẤT về vai trò của cột.
    6. Trích xuất 'semantic_features' gồm:
       - 'key_traits': đặc điểm nổi bật của trường.
       - 'search_keywords': danh sách từ khóa tra cứu.
    DANH SÁCH CỘT GỐC (KÈM CHỮ CÁI CỘT A, B, C...):
    {json.dumps(formatted_columns, ensure_ascii=False, indent=2)}
    Trả về kết quả chuẩn JSON array có dạng:
    [
      {{
        "column_letter": "A",
        "field_name": "Tên cột gốc nguyên bản",
        "data_type": "TEXT",
        "description": "Mô tả siêu ngắn",
        "semantic_features": {{
           "key_traits": ["đặc điểm 1", "đặc điểm 2"],
           "search_keywords": ["từ khóa 1", "từ khóa 2"]
        }}
      }}
    ]
    """

    if client:
        try:
            model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"
            if hasattr(client, "models"):
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"temperature": 0.0, "response_mime_type": "application/json"}
                )
                content = resp.text
            else:
                gmodel = client.GenerativeModel(model_name=model_name)
                resp = gmodel.generate_content(prompt, generation_config={"temperature": 0.0, "response_mime_type": "application/json"})
                content = resp.text

            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                analyzed = json.loads(json_match.group(0))
                final_columns = []
                for idx, col in enumerate(columns):
                    fname = col["field_name"]
                    info = analyzed[idx] if idx < len(analyzed) else {}
                    if not isinstance(info, dict):
                        info = {}

                    inferred_type = info.get("data_type", "TEXT").upper()
                    fname_lower = fname.lower()

                    if "stt" in fname_lower or fname_lower == "id":
                        inferred_type = "INTEGER"
                    elif ("ngày" in fname_lower or "date" in fname_lower) and "lộ trình" not in fname_lower:
                        inferred_type = "DATE"

                    final_columns.append({
                        "column_index": col["column_index"],
                        "field_name": fname,
                        "description": info.get("description", f"Cột {fname}"),
                        "data_type": inferred_type,
                        "semantic_features": info.get("semantic_features", {
                            "key_traits": [f"Trường {fname}"],
                            "search_keywords": [fname]
                        }),
                        "sample_values": col.get("sample_values", [])
                    })
                return final_columns
        except Exception as e:
            logger.error(f"Lỗi Gemini Stage 1 Column Analysis: {e}")

    fallback_cols = []
    for c in columns:
        fname_lower = c["field_name"].lower()
        col_type = "TEXT"
        if "stt" in fname_lower or fname_lower == "id":
            col_type = "INTEGER"
        elif ("ngày" in fname_lower or "date" in fname_lower) and "lộ trình" not in fname_lower:
            col_type = "DATE"
        fallback_cols.append({
            "column_index": c["column_index"],
            "field_name": c["field_name"],
            "description": f"Trường {c['field_name']}",
            "data_type": col_type,
            "semantic_features": {
                "key_traits": [f"Dữ liệu kiểu {col_type}"],
                "search_keywords": [c["field_name"]]
            },
            "sample_values": c.get("sample_values", [])
        })
    return fallback_cols


async def analyze_sections_with_gemini_stage2(sections: List[Dict[str, Any]], sheet_title: str, tab_title: str = "") -> Dict[str, Any]:
    default_initial = "TTS" if ("tts" in sheet_title.lower() or "tts" in tab_title.lower()) else "Bình thường"
    sec_names = [s["text"] for s in sections if isinstance(s, dict) and "text" in s]

    if not sections:
        return {"has_proposal": False, "proposal": None}

    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        mapping = {"__default__": default_initial}
        for name in sec_names:
            mapping[name] = name
        return {
            "has_proposal": True,
            "proposal": {
                "field_name": "loai_nhan_su",
                "description": f"Phân loại nhóm nhân sự trong sheet '{sheet_title}'",
                "source": "section_header",
                "default_value": default_initial,
                "values": [default_initial, *sec_names],
                "mapping": mapping,
                "reason": f"Các tiêu đề phân nhóm biểu diễn trạng thái/nhóm nhân sự, phần đầu thuộc nhóm {default_initial}."
            }
        }

    client = None
    if genai is not None:
        try:
            if hasattr(genai, "Client"):
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
            else:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                client = genai
        except Exception:
            client = None

    prompt = f"""
    Bạn là chuyên gia thiết kế CSDL.
    File Sheet có tên: '{sheet_title}', Tab: '{tab_title}'.
    Sheet chứa các hàng tiêu đề phân nhóm màu đặc biệt dưới đây:
    {json.dumps(sections, ensure_ascii=False, indent=2)}
    NHIỆM VỤ:
    1. Xác định xem các tiêu đề phân nhóm này có nên tạo thành một Cột Suy Luận Mới (Inferred Field) trong CSDL hay không.
    2. Đề xuất tên trường dạng snake_case (VD: 'loai_nhan_su', 'trang_thai_nhan_su', 'nhom_du_an').
    3. DỰ A VÀO TÊN SHEET/TAB (VD: '{sheet_title}', '{tab_title}'), hãy suy luận giá trị mặc định 'default_value' dành cho nhóm hàng đầu tiên.
    4. Trả về bảng ánh xạ 'mapping' giữa tên tiêu đề và giá trị gán.
    Trả về chuẩn JSON format:
    {{
       "create_field": true,
       "proposal": {{
          "field_name": "loai_nhan_su",
          "description": "Phân loại nhóm nhân sự trong sheet",
          "source": "section_header",
          "default_value": "{default_initial}",
          "values": ["{default_initial}", "Mượn người", "Tạm nghỉ", "Lên chính thức", "Đã nghỉ"],
          "mapping": {{
             "__default__": "{default_initial}",
             "Mượn người": "Mượn người",
             "Tạm nghỉ": "Tạm nghỉ",
             "Lên chính thức": "Lên chính thức",
             "Đã nghỉ": "Đã nghỉ"
          }},
          "reason": "Các hàng tiêu đề biểu diễn nhóm nhân sự, còn phần đầu sheet thuộc nhóm {default_initial}."
       }}
    }}
    """

    if client:
        try:
            model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"
            if hasattr(client, "models"):
                resp = client.models.generate_content(model=model_name, contents=prompt, config={"temperature": 0.0, "response_mime_type": "application/json"})
                content = resp.text
            else:
                gmodel = client.GenerativeModel(model_name=model_name)
                resp = gmodel.generate_content(prompt, generation_config={"temperature": 0.0, "response_mime_type": "application/json"})
                content = resp.text

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
        except Exception as e:
            logger.error(f"Lỗi Gemini Stage 2 Generic Section Analysis: {e}")

    mapping = {"__default__": default_initial}
    for name in sec_names:
        mapping[name] = name

    return {
        "has_proposal": True,
        "proposal": {
            "field_name": "loai_nhan_su",
            "description": f"Phân loại nhóm nhân sự dựa trên các tiêu đề hàng và tên sheet '{sheet_title}'",
            "source": "section_header",
            "default_value": default_initial,
            "values": [default_initial, *sec_names],
            "mapping": mapping,
            "reason": f"Phát hiện các nhóm nhân sự phân chia bởi tiêu đề màu, phần đầu mặc định là {default_initial}."
        }
    }


def calculate_dynamic_section_ranges(sections: List[Dict[str, Any]], total_rows: int, start_data_row: int = 3) -> List[Dict[str, Any]]:
    if not sections:
        return []
    calculated_sections = []

    first_sec_row = sections[0]["row"]
    if first_sec_row > start_data_row:
        calculated_sections.append({
            "section_name": "Bình thường",
            "start_row": start_data_row,
            "end_row": first_sec_row - 1,
            "description": "Nhóm dữ liệu mặc định ban đầu"
        })

    for i in range(len(sections)):
        curr_sec = sections[i]
        curr_row = curr_sec["row"]
        next_row = sections[i+1]["row"] if i + 1 < len(sections) else (total_rows + 1)

        calculated_sections.append({
            "section_name": curr_sec["text"],
            "start_row": curr_row + 1,
            "end_row": next_row - 1,
            "description": f"Vùng thuộc nhóm {curr_sec['text']}"
        })
    return calculated_sections
