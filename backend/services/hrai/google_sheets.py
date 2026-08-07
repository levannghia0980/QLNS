import os
import re
import logging
import urllib.request
from typing import Optional, List, Dict, Any
from googleapiclient.discovery import build
from services.google_sheets_service import GoogleSheetsService

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]


def parse_sheet_url_metadata(sheet_url: str) -> dict:
    file_id = None
    gid = None
    
    file_id_match = re.search(r'/d/([a-zA-Z0-9-_]+)', sheet_url)
    if file_id_match:
        file_id = file_id_match.group(1)
        
    gid_match = re.search(r'[#&?]gid=([0-9]+)', sheet_url)
    if gid_match:
        gid = gid_match.group(1)
        
    return {
        "spreadsheet_id": file_id,
        "gid": gid,
        "raw_url": sheet_url
    }


def read_google_sheet(sheet_url: str, tab_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Đọc dữ liệu từ Google Sheet bằng Google Sheets API chính thức"""
    meta = parse_sheet_url_metadata(sheet_url)
    sheet_id = meta.get("spreadsheet_id")
    if not sheet_id:
        raise ValueError(f"Không thể trích xuất ID từ URL Google Sheet: {sheet_url}")

    all_values = GoogleSheetsService.read_sheet_values(sheet_id)
    if not all_values:
        return []

    headers = [str(c).strip() for c in all_values[0]]
    records = []
    for row in all_values[1:]:
        row_dict = {}
        for idx, h in enumerate(headers):
            col_key = h or f"Cột_{idx+1}"
            row_dict[col_key] = str(row[idx]).strip() if idx < len(row) and row[idx] is not None else ""
        records.append(row_dict)

    return records


def read_google_sheet_raw_values(sheet_url: str) -> List[List[str]]:
    """Đọc toàn bộ mảng 2D các ô từ Google Sheet"""
    meta = parse_sheet_url_metadata(sheet_url)
    sheet_id = meta.get("spreadsheet_id")
    if not sheet_id:
        return []
    return GoogleSheetsService.read_sheet_values(sheet_id) or []


def append_row_to_sheet(sheet_url: str, row_data: list, tab_name: Optional[str] = None):
    """Ghi bổ sung 1 dòng vào Google Sheet"""
    meta = parse_sheet_url_metadata(sheet_url)
    sheet_id = meta.get("spreadsheet_id")
    if not sheet_id:
        return None

    creds, _ = GoogleSheetsService.get_credentials()
    if not creds:
        raise PermissionError("Chưa kết nối Google OAuth API")

    sheets_service = build('sheets', 'v4', credentials=creds)
    range_name = f"'{tab_name}'!A1" if tab_name else "A1"
    return sheets_service.spreadsheets().values().append(
        spreadsheetId=sheet_id,
        range=range_name,
        valueInputOption="USER_ENTERED",
        body={"values": [row_data]}
    ).execute()


def update_cell_in_sheet(sheet_url: str, row: int, col: int, value: str, tab_name: Optional[str] = None):
    """Cập nhật giá trị 1 ô trên Google Sheet"""
    meta = parse_sheet_url_metadata(sheet_url)
    sheet_id = meta.get("spreadsheet_id")
    if not sheet_id:
        return None

    creds, _ = GoogleSheetsService.get_credentials()
    if not creds:
        raise PermissionError("Chưa kết nối Google OAuth API")

    sheets_service = build('sheets', 'v4', credentials=creds)
    # Convert row/col to A1 notation
    col_letter = chr(64 + col) if 1 <= col <= 26 else "A"
    range_name = f"'{tab_name}'!{col_letter}{row}" if tab_name else f"{col_letter}{row}"

    return sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range=range_name,
        valueInputOption="USER_ENTERED",
        body={"values": [[value]]}
    ).execute()
