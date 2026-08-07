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
        saved_sheet_url = cfg_data.get('interns_sheet_url', None)

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

                cfg_data['interns_sheet_url'] = sheet_url
                GoogleSheetsService.save_credentials_info(cfg_data)

                try:
                    drive_service.permissions().create(
                        fileId=sheet_id,
                        body={'type': 'anyone', 'role': 'writer'},
                        fields='id'
                    ).execute()
                except Exception:
                    pass

            headers = [
                "STT", "Họ và tên (*)", "Role / Vị trí", "Giới tính", "Dân tộc", "Email Viettel",
                "Ngày sinh", "Quê quán", "Số điện thoại (dùng Zalo)", "Số CCCD",
                "Số tài khoản ngân hàng / Viettel Money", "Dự án tham gia",
                "Ngày vào làm việc", "Tổng thời gian thực tập", "Phụ cấp", "Trạng thái / Loại TTS", "Ghi chú"
            ]
            num_cols = len(headers)
            rows_data = []

            # Row 1: Title
            rows_data.append(["DANH SÁCH THỰC TẬP SINH – VIETTEL SOFTWARE"] + [""] * (num_cols - 1))
            # Row 2: Header
            rows_data.append(headers)

            today = date.today()
            for idx, i in enumerate(interns, start=1):
                # Calculate total internship duration
                duration_str = "—"
                if i.join_date:
                    try:
                        diff_days = (today - i.join_date).days
                        if diff_days >= 0:
                            months = diff_days // 30
                            days = diff_days % 30
                            if months > 0 and days > 0:
                                duration_str = f"{months} tháng {days} ngày"
                            elif months > 0:
                                duration_str = f"{months} tháng"
                            else:
                                duration_str = f"{days} ngày"
                    except Exception:
                        pass

                bday_str = i.birthday.strftime("%d/%m/%Y") if i.birthday else ""
                join_str = i.join_date.strftime("%d/%m/%Y") if i.join_date else ""
                
                # Protect leading zero for phone and cccd by prepending single quote for Google Sheets
                phone_val = f"'{i.phone}" if i.phone and str(i.phone).startswith("0") else (i.phone or "")
                cccd_val = f"'{i.cccd}" if i.cccd and str(i.cccd).startswith("0") else (i.cccd or "")

                rows_data.append([
                    idx,
                    i.full_name or "",
                    i.position or i.role or "Dev",
                    i.gender or "Nam",
                    i.ethnicity or "Kinh",
                    i.viettel_email or "",
                    bday_str,
                    i.hometown or "",
                    phone_val,
                    cccd_val,
                    i.bank_account or "",
                    i.project or "—",
                    join_str,
                    duration_str,
                    "Có" if i.allowance == "Có" else "Không",
                    i.employee_type or i.working_status or "Của công ty",
                    i.notes or ""
                ])

            # 1. Clear all old cells in sheet
            try:
                sheets_service.spreadsheets().values().clear(
                    spreadsheetId=sheet_id,
                    range='A1:ZZ500'
                ).execute()
            except Exception:
                pass

            # 2. Write 17 columns of clean profile data
            sheets_service.spreadsheets().values().update(
                spreadsheetId=sheet_id,
                range='A1',
                valueInputOption='USER_ENTERED',
                body={'values': rows_data}
            ).execute()

            # 3. Format with Viettel Corporate Theme
            requests = [
                {"unmergeCells": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 300, "startColumnIndex": 0, "endColumnIndex": 50}}},
                {"mergeCells": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": num_cols}, "mergeType": "MERGE_ALL"}},
                {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": num_cols}, "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.91, "green": 0.94, "blue": 0.99}, "textFormat": {"bold": True, "fontSize": 13, "foregroundColor": {"red": 0.1, "green": 0.2, "blue": 0.5}}, "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE"}}, "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"}},
                {"repeatCell": {"range": {"sheetId": 0, "startRowIndex": 1, "endRowIndex": 2, "startColumnIndex": 0, "endColumnIndex": num_cols}, "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.05, "green": 0.18, "blue": 0.35}, "textFormat": {"bold": True, "fontSize": 10, "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}}, "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE"}}, "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"}},
                # Set specific column widths
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 1}, "properties": {"pixelSize": 50}, "fields": "pixelSize"}},    # STT
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 1, "endIndex": 2}, "properties": {"pixelSize": 180}, "fields": "pixelSize"}},   # Họ tên
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 2, "endIndex": 5}, "properties": {"pixelSize": 90}, "fields": "pixelSize"}},    # Role, Giới tính, Dân tộc
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 5, "endIndex": 6}, "properties": {"pixelSize": 220}, "fields": "pixelSize"}},   # Email
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 6, "endIndex": 8}, "properties": {"pixelSize": 110}, "fields": "pixelSize"}},   # Ngày sinh, Quê
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 8, "endIndex": 10}, "properties": {"pixelSize": 130}, "fields": "pixelSize"}},  # SĐT, CCCD
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 10, "endIndex": 11}, "properties": {"pixelSize": 200}, "fields": "pixelSize"}}, # Số TK
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 11, "endIndex": 12}, "properties": {"pixelSize": 160}, "fields": "pixelSize"}}, # Dự án
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 12, "endIndex": 14}, "properties": {"pixelSize": 140}, "fields": "pixelSize"}}, # Ngày vào, Thời gian TT
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 14, "endIndex": 16}, "properties": {"pixelSize": 110}, "fields": "pixelSize"}}, # Phụ cấp, Trạng thái
                {"updateDimensionProperties": {"range": {"sheetId": 0, "dimension": "COLUMNS", "startIndex": 16, "endIndex": 17}, "properties": {"pixelSize": 200}, "fields": "pixelSize"}}, # Ghi chú
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
                "message": "🎉 Tự động tạo Google Sheet Chi tiết Thực tập sinh thành công (Đầy đủ trường Phụ cấp và Ghi chú riêng biệt)!"
            }
        except Exception as e:
            return {"success": False, "message": f"Lỗi tạo Sheet Thực tập sinh: {str(e)}"}

    @staticmethod
    def process_import_interns_generic(rows: list, db: Session) -> dict:
        """Hàm đồng bộ 2 chiều dữ liệu TTS từ Google Sheet hoặc Excel vào CSDL SQLite"""
        if not rows or len(rows) < 2:
            return {"message": "Dữ liệu rỗng", "count": 0}

        header_idx = -1
        col_map = {}

        for r_i, r in enumerate(rows[:5]):
            if not r:
                continue
            r_strs = [str(c).strip().lower() if c is not None else "" for c in r]
            for c_i, h in enumerate(r_strs):
                if "tên" in h or "name" in h or "họ" in h: col_map["full_name"] = c_i
                elif "mã" in h or "code" in h or "stt" in h: col_map["code"] = c_i
                elif "role" in h or "vị trí" in h or "position" in h: col_map["role"] = c_i
                elif "giới" in h or "gender" in h: col_map["gender"] = c_i
                elif "dân tộc" in h or "ethnicity" in h: col_map["ethnicity"] = c_i
                elif "email" in h: col_map["email"] = c_i
                elif "sinh" in h or "birth" in h: col_map["birthday"] = c_i
                elif "quê" in h or "hometown" in h: col_map["hometown"] = c_i
                elif "thoại" in h or "phone" in h or "sđt" in h: col_map["phone"] = c_i
                elif "cccd" in h or "cmnd" in h: col_map["cccd"] = c_i
                elif "khoản" in h or "bank" in h or "tk" in h: col_map["bank_account"] = c_i
                elif "dự án" in h or "project" in h: col_map["project"] = c_i
                elif "vào" in h or "join" in h: col_map["join_date"] = c_i
                elif "phụ cấp" in h or "allowance" in h: col_map["allowance"] = c_i
                elif "trạng thái" in h or "loại" in h or "status" in h: col_map["status"] = c_i
                elif "ghi chú" in h or "note" in h or "mô tả" in h: col_map["notes"] = c_i

            if "full_name" in col_map:
                header_idx = r_i
                break

        if header_idx == -1:
            header_idx = 1
            col_map = {
                "full_name": 1, "role": 2, "gender": 3, "ethnicity": 4, "email": 5,
                "birthday": 6, "hometown": 7, "phone": 8, "cccd": 9, "bank_account": 10,
                "project": 11, "join_date": 12, "allowance": 14, "status": 15, "notes": 16
            }

        data_rows = rows[header_idx + 1:]
        count = 0
        from services.hrai.sheet_pipeline import is_summary_row

        def parse_date_val(v):
            if not v:
                return None
            if isinstance(v, date):
                return v
            if isinstance(v, datetime):
                return v.date()
            v_str = str(v).strip().replace("'", "")
            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
                try:
                    return datetime.strptime(v_str, fmt).date()
                except Exception:
                    pass
            return None

        for r in data_rows:
            if not r:
                continue
            name_idx = col_map.get("full_name", 1)
            full_name = str(r[name_idx]).strip() if name_idx < len(r) and r[name_idx] is not None else ""
            if not full_name or is_summary_row(r) or full_name.lower().startswith("tổng"):
                continue

            # Format phone and cccd to preserve leading zeros
            raw_phone = str(r[col_map["phone"]]).strip().replace("'", "") if "phone" in col_map and col_map["phone"] < len(r) and r[col_map["phone"]] is not None else ""
            if raw_phone and raw_phone.isdigit() and len(raw_phone) == 9:
                raw_phone = "0" + raw_phone

            raw_cccd = str(r[col_map["cccd"]]).strip().replace("'", "") if "cccd" in col_map and col_map["cccd"] < len(r) and r[col_map["cccd"]] is not None else ""
            if raw_cccd and raw_cccd.isdigit() and len(raw_cccd) in (10, 11):
                raw_cccd = raw_cccd.zfill(12)

            role_val = str(r[col_map["role"]]).strip() if "role" in col_map and col_map["role"] < len(r) and r[col_map["role"]] else "Dev"
            gender_val = str(r[col_map["gender"]]).strip() if "gender" in col_map and col_map["gender"] < len(r) and r[col_map["gender"]] else "Nam"
            ethnicity_val = str(r[col_map["ethnicity"]]).strip() if "ethnicity" in col_map and col_map["ethnicity"] < len(r) and r[col_map["ethnicity"]] else "Kinh"
            email_val = str(r[col_map["email"]]).strip() if "email" in col_map and col_map["email"] < len(r) and r[col_map["email"]] else ""
            bday_val = parse_date_val(r[col_map["birthday"]]) if "birthday" in col_map and col_map["birthday"] < len(r) else None
            hometown_val = str(r[col_map["hometown"]]).strip() if "hometown" in col_map and col_map["hometown"] < len(r) and r[col_map["hometown"]] else ""
            bank_acc_val = str(r[col_map["bank_account"]]).strip() if "bank_account" in col_map and col_map["bank_account"] < len(r) and r[col_map["bank_account"]] else ""
            proj_val = str(r[col_map["project"]]).strip() if "project" in col_map and col_map["project"] < len(r) and r[col_map["project"]] else "—"
            join_date_val = parse_date_val(r[col_map["join_date"]]) if "join_date" in col_map and col_map["join_date"] < len(r) else None
            
            allowance_raw = str(r[col_map["allowance"]]).strip() if "allowance" in col_map and col_map["allowance"] < len(r) and r[col_map["allowance"]] else "Không"
            allowance_val = "Có" if "có" in allowance_raw.lower() or "yes" in allowance_raw.lower() else "Không"
            
            status_val = str(r[col_map["status"]]).strip() if "status" in col_map and col_map["status"] < len(r) and r[col_map["status"]] else "Của công ty"
            notes_val = str(r[col_map["notes"]]).strip() if "notes" in col_map and col_map["notes"] < len(r) and r[col_map["notes"]] else ""

            user = db.query(models.User).filter(
                models.User.full_name.ilike(full_name.strip()),
                models.User.user_type == "intern"
            ).first()

            if user:
                user.full_name = full_name
                if role_val: user.position = role_val; user.role = role_val
                if gender_val: user.gender = gender_val
                if ethnicity_val: user.ethnicity = ethnicity_val
                if email_val: user.viettel_email = email_val
                if bday_val: user.birthday = bday_val
                if hometown_val: user.hometown = hometown_val
                if raw_phone: user.phone = raw_phone
                if raw_cccd: user.cccd = raw_cccd
                if bank_acc_val: user.bank_account = bank_acc_val
                if proj_val: user.project = proj_val
                if join_date_val: user.join_date = join_date_val
                user.allowance = allowance_val
                if status_val: user.employee_type = status_val; user.working_status = status_val
                if notes_val: user.notes = notes_val
                count += 1
            else:
                new_idx = len(db.query(models.User).filter(models.User.user_type == "intern").all()) + 1
                new_user = models.User(
                    employee_code=f"TTS{new_idx}",
                    full_name=full_name,
                    role=role_val or "Dev",
                    position=role_val or "Dev",
                    user_type="intern",
                    gender=gender_val,
                    ethnicity=ethnicity_val,
                    viettel_email=email_val,
                    birthday=bday_val,
                    hometown=hometown_val,
                    phone=raw_phone,
                    cccd=raw_cccd,
                    bank_account=bank_acc_val,
                    project=proj_val,
                    join_date=join_date_val,
                    allowance=allowance_val,
                    notes=notes_val,
                    employee_type=status_val,
                    working_status=status_val,
                    account_status=1
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

    @staticmethod
    def process_import_schedule_generic(rows: list, month: int, year: int, db: Session) -> dict:
        """Hàm đồng bộ ma trận lịch trực TTS (1..31 ngày) từ Google Sheet hoặc Excel trực tiếp vào DB"""
        if not rows or len(rows) < 2:
            return {"message": "Dữ liệu Google Sheet rỗng", "count": 0}

        header_idx = -1
        day_cols = {}
        code_col = -1
        name_col = -1

        for r_i, r in enumerate(rows[:6]):
            if not r:
                continue
            found_days = {}
            for c_i, val in enumerate(r):
                if val is None:
                    continue
                val_str = str(val).strip()
                val_lower = val_str.lower()
                if "mã" in val_lower or "code" in val_lower or "mnv" in val_lower:
                    code_col = c_i
                if "tên" in val_lower or "name" in val_lower or "họ" in val_lower:
                    name_col = c_i
                
                # Check for day header e.g. "1\nT7", "01\nThứ 7", "1", "2"
                match = re.search(r'^\s*(\d{1,2})', val_str)
                if match:
                    d_num = int(match.group(1))
                    if 1 <= d_num <= 31:
                        found_days[c_i] = d_num

            if len(found_days) >= 4:
                header_idx = r_i
                day_cols = found_days
                break

        if header_idx == -1:
            header_idx = 1
            code_col = 0 if code_col == -1 else code_col
            name_col = 1 if name_col == -1 else name_col
            for c_i in range(2, min(len(rows[header_idx]), 35)):
                d = c_i - 1
                if 1 <= d <= 31:
                    day_cols[c_i] = d
        else:
            if code_col == -1: code_col = 0
            if name_col == -1: name_col = 1

        period = db.query(models.SchedulePeriod).filter(
            models.SchedulePeriod.month == month,
            models.SchedulePeriod.year == year
        ).first()
        if not period:
            period = models.SchedulePeriod(month=month, year=year, status="open")
            db.add(period)
            db.commit()
            db.refresh(period)

        # Xóa các ca trực cũ của kỳ này trước khi nạp từ Google Sheet để đảm bảo dữ liệu thật 100%, không bị lẫn dữ liệu ảo cũ
        db.query(models.Schedule).filter(models.Schedule.period_id == period.id).delete()
        db.commit()

        data_rows = rows[header_idx + 1:]
        count = 0

        for r in data_rows:
            if not r or len(r) <= max(code_col, name_col, 0):
                continue
            emp_code = str(r[code_col]).strip() if code_col < len(r) and r[code_col] is not None else ""
            full_name = str(r[name_col]).strip() if name_col < len(r) and r[name_col] is not None else ""
            if not emp_code and not full_name:
                continue
            if emp_code.lower().startswith("tổng") or full_name.lower().startswith("tổng") or emp_code.lower() == "stt":
                continue

            user = None
            if emp_code:
                user = db.query(models.User).filter(
                    models.User.employee_code.ilike(emp_code.strip())
                ).first()
            if not user and full_name:
                user = db.query(models.User).filter(
                    models.User.full_name.ilike(full_name.strip())
                ).first()

            if not user:
                # Nếu TTS chưa có trong DB thì tự động tạo mới vào bảng users!
                user = models.User(
                    employee_code=emp_code or f"TTS{len(db.query(models.User).filter(models.User.user_type == 'intern').all()) + 1}",
                    full_name=full_name or emp_code,
                    role="user",
                    user_type="intern",
                    position="TTS",
                    working_status="Working",
                    account_status=1
                )
                db.add(user)
                db.flush()
            else:
                if full_name:
                    user.full_name = full_name

            for col_i, day_num in day_cols.items():
                if col_i >= len(r):
                    continue
                raw_shift = str(r[col_i]).strip().upper() if r[col_i] is not None else ""
                shift_val = ""
                if "SC" in raw_shift:
                    shift_val = "SC"
                elif "S" in raw_shift:
                    shift_val = "S"
                elif "C" in raw_shift:
                    shift_val = "C"

                try:
                    w_date = date(year, month, day_num)
                except ValueError:
                    continue

                sched = db.query(models.Schedule).filter(
                    models.Schedule.user_id == user.id,
                    models.Schedule.work_day == w_date
                ).first()

                if sched:
                    if shift_val:
                        sched.shift = shift_val
                        sched.period_id = period.id
                    else:
                        db.delete(sched)
                else:
                    if shift_val:
                        sched = models.Schedule(
                            period_id=period.id,
                            user_id=user.id,
                            work_day=w_date,
                            shift=shift_val
                        )
                        db.add(sched)
                count += 1

        db.commit()
        return {"message": f"🎉 Đồng bộ thành công {count} ca trực từ Google Sheets vào CSDL!", "count": count}


