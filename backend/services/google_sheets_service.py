import os
import calendar
import re
import json
from datetime import date
from typing import List, Dict
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session
import models

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "google_credentials.json")
OAUTH_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "google_oauth.json")


def natural_sort_key(u):
    code = getattr(u, 'employee_code', '') or ''
    match = re.search(r'\d+', code)
    if match:
        prefix = code[:match.start()].lower()
        num = int(match.group(0))
        return (prefix, num, code.lower())
    return (code.lower(), 0, code.lower())


class GoogleSheetsService:
    @staticmethod
    def get_credentials():
        """Get active Credentials (OAuth or Service Account)"""
        if os.path.exists(OAUTH_PATH):
            try:
                with open(OAUTH_PATH, 'r', encoding='utf-8') as f:
                    oa_data = json.load(f)
                if oa_data.get('access_token') or oa_data.get('refresh_token'):
                    return Credentials(
                        token=oa_data.get('access_token'),
                        refresh_token=oa_data.get('refresh_token'),
                        token_uri="https://oauth2.googleapis.com/token",
                        client_id=oa_data.get('client_id'),
                        client_secret=oa_data.get('client_secret'),
                        scopes=SCOPES
                    ), oa_data.get('email')
            except Exception as e:
                print("OAuth credentials load warning:", e)

        if os.path.exists(CREDENTIALS_PATH):
            try:
                creds = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPES)
                cfg = GoogleSheetsService.get_credentials_info()
                return creds, cfg.get('client_email', '')
            except Exception:
                pass

        return None, None

    @staticmethod
    def get_credentials_info() -> dict:
        if not os.path.exists(CREDENTIALS_PATH):
            return {}
        try:
            with open(CREDENTIALS_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}

    @staticmethod
    def save_credentials_info(info_dict: dict):
        try:
            cfg = GoogleSheetsService.get_credentials_info()
            cfg.update(info_dict)
            with open(CREDENTIALS_PATH, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print("Failed to save credentials info:", e)

    @staticmethod
    def read_sheet_values(sheet_id: str) -> list:
        """Đọc danh sách các dòng từ Google Sheet thông qua API"""
        creds, _ = GoogleSheetsService.get_credentials()
        if not creds:
            return None

        try:
            sheets_service = build('sheets', 'v4', credentials=creds)
            res = sheets_service.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range='A1:AZ200'
            ).execute()
            return res.get('values', [])
        except Exception as e:
            print("Error reading Google Sheet API:", e)
            return None

    @staticmethod
    def auto_create_schedule_sheet(month: int, year: int, db: Session, target_sheet_url: str = None, force_new: bool = False) -> dict:
        """Tự động tạo & định dạng Google Sheet y hệt file Excel xuất ra (Bao gồm TOÀN BỘ ngày 1..31)"""
        creds, oauth_email = GoogleSheetsService.get_credentials()

        if not creds:
            return {
                "success": False,
                "error": "missing_credentials",
                "message": "Chưa kết nối Google OAuth! Vui lòng bấm Đăng Nhập Bằng Google trước."
            }

        cfg_data = GoogleSheetsService.get_credentials_info()
        saved_folder_id = cfg_data.get('drive_folder_id', None)

        month_key = f"drive_sheet_url_{month}_{year}"
        effective_sheet_url = None if force_new else (target_sheet_url or cfg_data.get(month_key, None))

        try:
            sheets_service = build('sheets', 'v4', credentials=creds)
            drive_service = build('drive', 'v3', credentials=creds)

            # Query all active interns & schedules from SQLite DB
            period = db.query(models.SchedulePeriod).filter(
                models.SchedulePeriod.month == month,
                models.SchedulePeriod.year == year,
            ).first()

            interns = (
                db.query(models.User)
                .filter(models.User.user_type == "intern", models.User.working_status == "Working")
                .all()
            )
            interns = sorted(interns, key=natural_sort_key)

            sched_by_user = {}
            if period:
                schedules = db.query(models.Schedule).filter(models.Schedule.period_id == period.id).all()
                for s in schedules:
                    if s.user_id not in sched_by_user:
                        sched_by_user[s.user_id] = {}
                    sched_by_user[s.user_id][str(s.work_day)] = s.shift

            sheet_id = None
            sheet_url = effective_sheet_url

            # Extract sheet_id if effective_sheet_url provided
            if effective_sheet_url:
                match = re.search(r'/d/([a-zA-Z0-9-_]+)', effective_sheet_url)
                if match:
                    sheet_id = match.group(1)

            # Create new sheet if force_new or no valid sheet_id
            if not sheet_id:
                title = f"BẢNG LỊCH THỰC TẬP – THÁNG {month}/{year}"
                file_metadata = {
                    'name': title,
                    'mimeType': 'application/vnd.google-apps.spreadsheet'
                }
                
                if saved_folder_id:
                    file_metadata['parents'] = [saved_folder_id]

                file_res = drive_service.files().create(
                    body=file_metadata,
                    fields='id, webViewLink'
                ).execute()

                sheet_id = file_res.get('id')
                sheet_url = file_res.get('webViewLink')

                # Save month/year specific URL
                cfg_data[month_key] = sheet_url
                cfg_data['drive_sheet_url'] = sheet_url
                GoogleSheetsService.save_credentials_info(cfg_data)

                # Grant anyone edit permissions
                try:
                    drive_service.permissions().create(
                        fileId=sheet_id,
                        body={'type': 'anyone', 'role': 'writer'},
                        fields='id'
                    ).execute()
                except Exception:
                    pass

            # Calculate ALL days in month (1..31) - DO NOT EXCLUDE WEEKENDS SO DAYS 29, 30 ARE FULLY INCLUDED!
            days_in_month = calendar.monthrange(year, month)[1]
            all_days = [date(year, month, d) for d in range(1, days_in_month + 1)]
            DOW_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

            num_cols = len(all_days) + 3 # Mã NV, Họ tên + ALL 1..31 Days + Tổng buổi

            # Prepare Cell Values Grid
            rows_data = []

            # Row 1: Title
            title_row = [f"BẢNG LỊCH THỰC TẬP – THÁNG {month}/{year}"] + [""] * (num_cols - 1)
            rows_data.append(title_row)

            # Row 2: Header
            header_row = ["Mã NV", "Họ và tên"]
            for d in all_days:
                header_row.append(f"{d.day}\n{DOW_VN[d.weekday()]}")
            header_row.append("Tổng buổi")
            rows_data.append(header_row)

            # Data Rows
            grand_total = 0

            for intern in interns:
                row = [intern.employee_code or "", intern.full_name or ""]
                user_scheds = sched_by_user.get(intern.id, {})
                user_total = 0

                for d in all_days:
                    date_str = str(d)
                    shift = user_scheds.get(date_str, "")
                    row.append(shift)

                    if shift == "SC":
                        user_total += 1.0
                    elif shift in ("S", "C"):
                        user_total += 0.5

                grand_total += user_total
                total_disp = int(user_total) if user_total == int(user_total) else user_total
                row.append(total_disp)
                rows_data.append(row)

            # Footer Row: TỔNG CỘNG
            grand_disp = int(grand_total) if grand_total == int(grand_total) else grand_total
            footer_row = ["TỔNG CỘNG"] + [""] * (num_cols - 2) + [grand_disp]
            rows_data.append(footer_row)

            # Write values to Sheet
            sheets_service.spreadsheets().values().update(
                spreadsheetId=sheet_id,
                range='A1',
                valueInputOption='USER_ENTERED',
                body={'values': rows_data}
            ).execute()

            # BatchUpdate Styling Requests (Colors, Fonts, Merges, Alignment, Widths)
            requests = []

            # 0. Unmerge any existing merged cells to prevent HttpError 400 Invalid mergeCells
            requests.append({
                "unmergeCells": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 0,
                        "endRowIndex": 200,
                        "startColumnIndex": 0,
                        "endColumnIndex": 100
                    }
                }
            })

            # 1. Merge Title Row 1 (A1 to End)
            requests.append({
                "mergeCells": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": num_cols
                    },
                    "mergeType": "MERGE_ALL"
                }
            })

            # 2. Merge Footer Row (A{last}:X{last})
            footer_row_idx = len(rows_data) - 1
            requests.append({
                "mergeCells": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": footer_row_idx,
                        "endRowIndex": footer_row_idx + 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": num_cols - 1
                    },
                    "mergeType": "MERGE_ALL"
                }
            })

            # 3. Format Title Row 1 (#E8F0FE, Bold 13pt, Centered)
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": num_cols
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": {"red": 0.91, "green": 0.94, "blue": 0.99},
                            "textFormat": {"bold": True, "fontSize": 13, "foregroundColor": {"red": 0.1, "green": 0.2, "blue": 0.5}},
                            "horizontalAlignment": "CENTER",
                            "verticalAlignment": "MIDDLE"
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                }
            })

            # 4. Format Header Row 2 (#1E3A5F Navy, White Text Bold, Centered)
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 1,
                        "endRowIndex": 2,
                        "startColumnIndex": 0,
                        "endColumnIndex": num_cols
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": {"red": 0.117, "green": 0.227, "blue": 0.372},
                            "textFormat": {"bold": True, "fontSize": 10, "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}},
                            "horizontalAlignment": "CENTER",
                            "verticalAlignment": "MIDDLE",
                            "wrapStrategy": "WRAP"
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)"
                }
            })

            # 5. Format Data Rows & Shift Colors
            for r_idx, intern in enumerate(interns, start=2):
                user_scheds = sched_by_user.get(intern.id, {})
                
                # Format Col A (Mã NV) & Col B (Họ tên)
                requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": 0,
                            "startRowIndex": r_idx,
                            "endRowIndex": r_idx + 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": 1
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "textFormat": {"bold": True, "foregroundColor": {"red": 0.1, "green": 0.2, "blue": 0.4}},
                                "horizontalAlignment": "LEFT",
                                "verticalAlignment": "MIDDLE"
                            }
                        },
                        "fields": "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)"
                    }
                })

                requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": 0,
                            "startRowIndex": r_idx,
                            "endRowIndex": r_idx + 1,
                            "startColumnIndex": 1,
                            "endColumnIndex": 2
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "horizontalAlignment": "LEFT",
                                "verticalAlignment": "MIDDLE"
                            }
                        },
                        "fields": "userEnteredFormat(horizontalAlignment,verticalAlignment)"
                    }
                })

                # Format Day Cells (SC green, S/C yellow)
                for c_offset, d in enumerate(all_days):
                    c_idx = c_offset + 2
                    shift = user_scheds.get(str(d), "")

                    cell_fmt = {
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE"
                    }

                    if shift == "SC":
                        cell_fmt["backgroundColor"] = {"red": 0.776, "green": 0.937, "blue": 0.808} # #C6EFCE
                        cell_fmt["textFormat"] = {"bold": True, "foregroundColor": {"red": 0.0, "green": 0.38, "blue": 0.0}}
                    elif shift in ("S", "C"):
                        cell_fmt["backgroundColor"] = {"red": 1.0, "green": 0.92, "blue": 0.61} # #FFEB9C
                        cell_fmt["textFormat"] = {"bold": True, "foregroundColor": {"red": 0.61, "green": 0.39, "blue": 0.0}}

                    requests.append({
                        "repeatCell": {
                            "range": {
                                "sheetId": 0,
                                "startRowIndex": r_idx,
                                "endRowIndex": r_idx + 1,
                                "startColumnIndex": c_idx,
                                "endColumnIndex": c_idx + 1
                            },
                            "cell": {"userEnteredFormat": cell_fmt},
                            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                        }
                    })

                # Format Total Column (#DDEEFF, Bold)
                total_c_idx = num_cols - 1
                requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": 0,
                            "startRowIndex": r_idx,
                            "endRowIndex": r_idx + 1,
                            "startColumnIndex": total_c_idx,
                            "endColumnIndex": total_c_idx + 1
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {"red": 0.866, "green": 0.933, "blue": 1.0},
                                "textFormat": {"bold": True, "foregroundColor": {"red": 0.1, "green": 0.2, "blue": 0.5}},
                                "horizontalAlignment": "CENTER",
                                "verticalAlignment": "MIDDLE"
                            }
                        },
                        "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                    }
                })

            # 6. Format Footer Row "TỔNG CỘNG"
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": footer_row_idx,
                        "endRowIndex": footer_row_idx + 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": num_cols - 1
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {"bold": True, "fontSize": 11, "foregroundColor": {"red": 0.0, "green": 0.0, "blue": 0.0}},
                            "horizontalAlignment": "CENTER",
                            "verticalAlignment": "MIDDLE"
                        }
                    },
                    "fields": "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)"
                }
            })

            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": footer_row_idx,
                        "endRowIndex": footer_row_idx + 1,
                        "startColumnIndex": num_cols - 1,
                        "endColumnIndex": num_cols
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": {"red": 0.866, "green": 0.933, "blue": 1.0},
                            "textFormat": {"bold": True, "fontSize": 11, "foregroundColor": {"red": 0.75, "green": 0.0, "blue": 0.0}},
                            "horizontalAlignment": "CENTER",
                            "verticalAlignment": "MIDDLE"
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                }
            })

            # 7. Set Column Widths & Row Heights
            requests.append({"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 1}, "properties": {"pixelSize": 100}, "fields": "pixelSize"}})
            requests.append({"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 1, "endIndex": 2}, "properties": {"pixelSize": 180}, "fields": "pixelSize"}})
            requests.append({"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 2, "endIndex": num_cols - 1}, "properties": {"pixelSize": 45}, "fields": "pixelSize"}})
            requests.append({"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": num_cols - 1, "endIndex": num_cols}, "properties": {"pixelSize": 90}, "fields": "pixelSize"}})

            requests.append({"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "ROWS", "startIndex": 0, "endIndex": 1}, "properties": {"pixelSize": 36}, "fields": "pixelSize"}})
            requests.append({"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "ROWS", "startIndex": 1, "endIndex": 2}, "properties": {"pixelSize": 38}, "fields": "pixelSize"}})

            # Add Thin Grid Borders
            requests.append({
                "updateBorders": {
                    "range": {
                        "sheetId": 0,
                        "startRowIndex": 0,
                        "endRowIndex": len(rows_data),
                        "startColumnIndex": 0,
                        "endColumnIndex": num_cols
                    },
                    "top": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                    "bottom": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                    "left": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                    "right": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                    "innerHorizontal": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}},
                    "innerVertical": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}}
                }
            })

            # Execute all batchUpdate styling requests
            sheets_service.spreadsheets().batchUpdate(
                spreadsheetId=sheet_id,
                body={"requests": requests}
            ).execute()

            return {
                "success": True,
                "sheet_id": sheet_id,
                "sheet_url": sheet_url,
                "message": f"Tự động tạo & định dạng Google Sheet đầy đủ ngày 1..{days_in_month} cho Tháng {month}/{year}!"
            }

        except HttpError as err:
            err_str = str(err)
            if "SERVICE_DISABLED" in err_str or "has not been used in project" in err_str:
                match = re.search(r'https://console\.developers\.google\.com/apis/api/[^\s"]+', err_str)
                activation_url = match.group(0) if match else "https://console.cloud.google.com/apis/library/sheets.googleapis.com"
                return {
                    "success": False,
                    "error": "service_disabled",
                    "activation_url": activation_url,
                    "message": f"⚠️ Dịch vụ Google Sheets API chưa được Bật! Vui lòng mở: {activation_url}"
                }
            return {
                "success": False,
                "error": "api_error",
                "message": f"Lỗi Google API: {err_str}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": "general_error",
                "message": f"Lỗi hệ thống khi tạo Google Sheet: {str(e)}"
            }

    @staticmethod
    def auto_create_interns_sheet(db: Session, target_sheet_url: str = None) -> dict:
        """Tự động tạo & định dạng Google Sheet chứa danh sách Thực tập sinh Viettel"""
        creds, oauth_email = GoogleSheetsService.get_credentials()
        if not creds:
            return {
                "success": False,
                "error": "missing_credentials",
                "message": "Chưa kết nối Google OAuth! Vui lòng bấm Đăng Nhập Bằng Google trước."
            }

        cfg_data = GoogleSheetsService.get_credentials_info()
        saved_folder_id = cfg_data.get('drive_folder_id', None)
        saved_sheet_url = cfg_data.get('drive_sheet_url', None)

        effective_sheet_url = target_sheet_url or saved_sheet_url

        try:
            sheets_service = build('sheets', 'v4', credentials=creds)
            drive_service = build('drive', 'v3', credentials=creds)

            interns = (
                db.query(models.User)
                .filter(models.User.user_type == "intern")
                .all()
            )
            interns = sorted(interns, key=natural_sort_key)

            sheet_id = None
            sheet_url = effective_sheet_url

            if effective_sheet_url:
                match = re.search(r'/d/([a-zA-Z0-9-_]+)', effective_sheet_url)
                if match:
                    sheet_id = match.group(1)

            if not sheet_id:
                title = "DANH SÁCH THỰC TẬP SINH – VIETTEL SOFTWARE"
                file_metadata = {
                    'name': title,
                    'mimeType': 'application/vnd.google-apps.spreadsheet'
                }
                if saved_folder_id:
                    file_metadata['parents'] = [saved_folder_id]

                file_res = drive_service.files().create(
                    body=file_metadata,
                    fields='id, webViewLink'
                ).execute()

                sheet_id = file_res.get('id')
                sheet_url = file_res.get('webViewLink')

                try:
                    drive_service.permissions().create(
                        fileId=sheet_id,
                        body={'type': 'anyone', 'role': 'writer'},
                        fields='id'
                    ).execute()
                except Exception:
                    pass

            headers = [
                "Họ và tên (*)", "Mã NV (*)", "Vị trí / Role", "Giới tính", "Email Viettel",
                "Số điện thoại", "Quê quán", "Ngân hàng", "Số tài khoản", "Dự án tham gia",
                "Tình trạng"
            ]
            num_cols = len(headers)
            rows_data = []

            # Title Row
            rows_data.append(["DANH SÁCH THỰC TẬP SINH – VIETTEL SOFTWARE"] + [""] * (num_cols - 1))
            rows_data.append(headers)

            for i in interns:
                rows_data.append([
                    i.full_name or "",
                    i.employee_code or "",
                    i.role or "",
                    i.gender or "",
                    i.viettel_email or "",
                    i.phone or "",
                    i.hometown or "",
                    i.bank_name or "",
                    i.bank_account or "",
                    i.project or "",
                    i.working_status or "Working"
                ])

            sheets_service.spreadsheets().values().update(
                spreadsheetId=sheet_id,
                range='A1',
                valueInputOption='USER_ENTERED',
                body={'values': rows_data}
            ).execute()

            # Styling
            requests = [
                {"unmergeCells": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 200, "startColumnIndex": 0, "endColumnIndex": 100}}},
                {"mergeCells": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": num_cols}, "mergeType": "MERGE_ALL"}},
                {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": num_cols}, "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.91, "green": 0.94, "blue": 0.99}, "textFormat": {"bold": True, "fontSize": 13, "foregroundColor": {"red": 0.1, "green": 0.2, "blue": 0.5}}, "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE"}}, "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"}},
                {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 1, "endRowIndex": 2, "startColumnIndex": 0, "endColumnIndex": num_cols}, "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.117, "green": 0.227, "blue": 0.372}, "textFormat": {"bold": True, "fontSize": 10, "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}}, "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE"}}, "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"}},
                {"updateBorders": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": len(rows_data), "startColumnIndex": 0, "endColumnIndex": num_cols}, "top": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}}, "bottom": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}}, "left": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}}, "right": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}}, "innerHorizontal": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}}, "innerVertical": {"style": "SOLID", "color": {"red": 0.8, "green": 0.8, "blue": 0.8}}}}
            ]

            sheets_service.spreadsheets().batchUpdate(
                spreadsheetId=sheet_id,
                body={"requests": requests}
            ).execute()

            return {
                "success": True,
                "sheet_id": sheet_id,
                "sheet_url": sheet_url,
                "message": "Tự động tạo & nạp Google Sheet Danh sách Thực tập sinh thành công!"
            }
        except Exception as e:
            return {"success": False, "message": f"Lỗi tạo Sheet Thực tập sinh: {str(e)}"}

    @staticmethod
    def process_import_interns_generic(rows: list, db: Session) -> dict:
        """Hàm đồng bộ dữ liệu người dùng/thực tập sinh dùng chung từ danh sách dòng ô của Google Sheet"""
        if not rows:
            return {"message": "Dữ liệu rỗng", "count": 0}

        header_idx = -1
        code_col = -1
        name_col = -1

        for r_i, r in enumerate(rows[:5]):
            if not r:
                continue
            r_strs = [str(c).strip().lower() if c is not None else "" for c in r]
            for c_i, h in enumerate(r_strs):
                if "mã" in h or "code" in h:
                    code_col = c_i
                if "tên" in h or "name" in h:
                    name_col = c_i
            if code_col != -1 or name_col != -1:
                header_idx = r_i
                break

        if header_idx == -1:
            header_idx = 1

        data_rows = rows[header_idx + 1:]
        count = 0
        from services.hrai.sheet_pipeline import is_summary_row

        for r in data_rows:
            if not r or len(r) <= max(code_col, name_col, 0):
                continue
            
            full_name = str(r[name_col]).strip() if name_col != -1 and name_col < len(r) and r[name_col] else ""
            emp_code = str(r[code_col]).strip() if code_col != -1 and code_col < len(r) and r[code_col] else ""

            if not full_name and not emp_code:
                continue
            if is_summary_row(r) or emp_code.lower().startswith("tổng") or full_name.lower().startswith("tổng"):
                continue

            user = None
            if emp_code:
                user = db.query(models.User).filter(models.User.employee_code == emp_code).first()
            if not user and full_name:
                user = db.query(models.User).filter(models.User.full_name == full_name).first()

            if user:
                if full_name: user.full_name = full_name
                if len(r) > 2 and r[2]: user.role = str(r[2]).strip()
                if len(r) > 3 and r[3]: user.gender = str(r[3]).strip()
                if len(r) > 4 and r[4]: user.viettel_email = str(r[4]).strip()
                if len(r) > 5 and r[5]: user.phone = str(r[5]).strip()
                if len(r) > 6 and r[6]: user.hometown = str(r[6]).strip()
                if len(r) > 7 and r[7]: user.bank_name = str(r[7]).strip()
                if len(r) > 8 and r[8]: user.bank_account = str(r[8]).strip()
                if len(r) > 9 and r[9]: user.project = str(r[9]).strip()
                if len(r) > 10 and r[10]: user.working_status = str(r[10]).strip()
                count += 1
            else:
                new_user = models.User(
                    username=emp_code or f"user_{len(db.query(models.User).all())+1}",
                    full_name=full_name or emp_code,
                    employee_code=emp_code,
                    user_type="intern",
                    role=str(r[2]).strip() if len(r) > 2 and r[2] else "Intern",
                    gender=str(r[3]).strip() if len(r) > 3 and r[3] else None,
                    viettel_email=str(r[4]).strip() if len(r) > 4 and r[4] else None,
                    phone=str(r[5]).strip() if len(r) > 5 and r[5] else None,
                    hometown=str(r[6]).strip() if len(r) > 6 and r[6] else None,
                    bank_name=str(r[7]).strip() if len(r) > 7 and r[7] else None,
                    bank_account=str(r[8]).strip() if len(r) > 8 and r[8] else None,
                    project=str(r[9]).strip() if len(r) > 9 and r[9] else None,
                    working_status=str(r[10]).strip() if len(r) > 10 and r[10] else "Working"
                )
                db.add(new_user)
                count += 1

        db.commit()
        return {"message": f"Đồng bộ thành công {count} bản ghi từ Google Sheet!", "count": count}

    @staticmethod
    def auto_create_generic_table_sheet(title: str, headers: list, rows_data: list, target_sheet_url: str = None) -> dict:
        """Tự động tạo & định dạng Google Sheet cho bất kỳ bảng dữ liệu nào"""
        creds, oauth_email = GoogleSheetsService.get_credentials()
        if not creds:
            return {
                "success": False,
                "error": "missing_credentials",
                "message": "Chưa kết nối Google OAuth! Vui lòng bấm Đăng Nhập Bằng Google trước."
            }

        cfg_data = GoogleSheetsService.get_credentials_info()
        saved_folder_id = cfg_data.get('drive_folder_id', None)

        try:
            sheets_service = build('sheets', 'v4', credentials=creds)
            drive_service = build('drive', 'v3', credentials=creds)

            sheet_id = None
            sheet_url = target_sheet_url

            if target_sheet_url:
                match = re.search(r'/d/([a-zA-Z0-9-_]+)', target_sheet_url)
                if match:
                    sheet_id = match.group(1)

            if not sheet_id:
                file_title = f"{title.upper()} – VIETTEL SOFTWARE"
                file_metadata = {
                    'name': file_title,
                    'mimeType': 'application/vnd.google-apps.spreadsheet'
                }
                if saved_folder_id:
                    file_metadata['parents'] = [saved_folder_id]

                file_res = drive_service.files().create(
                    body=file_metadata,
                    fields='id, webViewLink'
                ).execute()

                sheet_id = file_res.get('id')
                sheet_url = file_res.get('webViewLink')

                try:
                    drive_service.permissions().create(
                        fileId=sheet_id,
                        body={'type': 'anyone', 'role': 'writer'},
                        fields='id'
                    ).execute()
                except Exception:
                    pass

            num_cols = len(headers) or 1
            full_rows_data = []

            # Title Row & Header Row
            full_rows_data.append([title.upper()] + [""] * (num_cols - 1))
            full_rows_data.append(headers)

            for r in rows_data:
                row_vals = []
                if isinstance(r, dict):
                    for h in headers:
                        row_vals.append("" if r.get(h) is None else str(r.get(h)))
                elif isinstance(r, (list, tuple)):
                    row_vals = [str(val or "") for val in r]
                full_rows_data.append(row_vals)

            sheets_service.spreadsheets().values().update(
                spreadsheetId=sheet_id,
                range='A1',
                valueInputOption='USER_ENTERED',
                body={'values': full_rows_data}
            ).execute()

            # Formatting
            requests = [
                {
                    "mergeCells": {
                        "range": {
                            "sheetId": 0,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": num_cols
                        },
                        "mergeType": "MERGE_ALL"
                    }
                },
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": 0,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": num_cols
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {"red": 0.93, "green": 0.0, "blue": 0.2},
                                "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}, "fontSize": 12},
                                "alignment": {"horizontal": "CENTER", "vertical": "MIDDLE"}
                            }
                        },
                        "fields": "userEnteredFormat(backgroundColor,textFormat,alignment)"
                    }
                },
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": 0,
                            "startRowIndex": 1,
                            "endRowIndex": 2,
                            "startColumnIndex": 0,
                            "endColumnIndex": num_cols
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {"red": 0.95, "green": 0.95, "blue": 0.95},
                                "textFormat": {"bold": True, "foregroundColor": {"red": 0.1, "green": 0.1, "blue": 0.1}, "fontSize": 10},
                                "alignment": {"horizontal": "CENTER", "vertical": "MIDDLE"}
                            }
                        },
                        "fields": "userEnteredFormat(backgroundColor,textFormat,alignment)"
                    }
                }
            ]

            try:
                sheets_service.spreadsheets().batchUpdate(
                    spreadsheetId=sheet_id,
                    body={"requests": requests}
                ).execute()
            except Exception:
                pass

            return {
                "success": True,
                "sheet_id": sheet_id,
                "sheet_url": sheet_url,
                "message": f"🎉 Tự động tạo Google Sheet '{title}' thành công!"
            }

        except Exception as e:
            return {
                "success": False,
                "error": "general_error",
                "message": f"Lỗi tạo Google Sheet: {str(e)}"
            }


