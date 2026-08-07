import re
import urllib.request
from io import BytesIO
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import auth
from services.google_sheets_service import GoogleSheetsService
from services.admin_service import AdminService

router = APIRouter(prefix="/api/google", tags=["Unified Google Integration Pipeline"])


@router.get("/status")
def get_google_status():
    """Kiểm tra trạng thái kết nối Google OAuth / Service Account"""
    creds, email = GoogleSheetsService.get_credentials()
    info = GoogleSheetsService.get_credentials_info()
    return {
        "connected": creds is not None,
        "email": email or info.get("client_email", ""),
        "drive_folder_id": info.get("drive_folder_id", ""),
        "drive_sheet_url": info.get("drive_sheet_url", "")
    }


# =========================================================================
# UNIFIED PIPELINE API: 1 LUỒNG DÙNG CHUNG CHO CHO TẤT CẢ (SCHEDULE / TTS / AIHR / EMPLOYEES)
# =========================================================================

@router.post("/create-sheet")
def generic_create_sheet(
    data: dict,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    """
    API Tạo Google Sheet Dùng Chung cho tất cả các tính năng:
    - type: "schedule" | "interns" | "aihr" | "employees"
    - month, year: truyền khi type="schedule"
    - target_sheet_url: truyền khi muốn cập nhật đè lên Sheet hiện có
    """
    sheet_type = data.get("type", "schedule")
    month = data.get("month", 8)
    year = data.get("year", 2026)
    target_url = data.get("target_sheet_url")

    if sheet_type == "schedule":
        return GoogleSheetsService.auto_create_schedule_sheet(month, year, db, target_sheet_url=target_url)
    elif sheet_type == "interns" or sheet_type == "aihr":
        return GoogleSheetsService.auto_create_interns_sheet(db, target_sheet_url=target_url)
    else:
        return GoogleSheetsService.auto_create_schedule_sheet(month, year, db, target_sheet_url=target_url)


@router.post("/sync-sheet")
def generic_sync_sheet(
    data: dict,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    """
    API Đồng Bộ Google Sheet Dùng Chung cho tất cả các tính năng:
    - type: "schedule" | "interns" | "aihr" | "employees"
    - url: đường dẫn Google Sheet cần đọc
    - month, year: truyền khi type="schedule"
    """
    sheet_type = data.get("type", "schedule")
    url = data.get("url", "")
    month = data.get("month", 8)
    year = data.get("year", 2026)

    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    if not match:
        raise HTTPException(status_code=400, detail="Đường dẫn Google Sheets không hợp lệ")
    sheet_id = match.group(1)

    rows = GoogleSheetsService.read_sheet_values(sheet_id)
    if not rows:
        raise HTTPException(status_code=400, detail="Không thể đọc dữ liệu từ Google Sheet. Vui lòng kiểm tra lại quyền truy cập!")

    if sheet_type == "schedule":
        return AdminService.process_import_schedule(rows, month, year, db)
    elif sheet_type in ("interns", "aihr", "employees"):
        return GoogleSheetsService.process_import_interns_generic(rows, db)
    else:
        return AdminService.process_import_schedule(rows, month, year, db)


@router.get("/export-excel")
def generic_export_excel(
    type: str = Query("schedule"),
    month: int = Query(8),
    year: int = Query(2026),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    """
    API Xuất Excel Dùng Chung:
    - type: "schedule" | "interns" | "aihr"
    """
    if type == "schedule":
        return AdminService.export_schedule(month, year, db)
    elif type in ("interns", "aihr"):
        from routers.google_router import export_interns_excel_internal
        return export_interns_excel_internal(db)
    else:
        return AdminService.export_schedule(month, year, db)


def export_interns_excel_internal(db: Session):
    interns = (
        db.query(models.User)
        .filter(models.User.user_type == "intern")
        .order_by(models.User.employee_code)
        .all()
    )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Danh Sách TTS"

    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    title_font = Font(name="Calibri", size=14, bold=True, color="1E3A5F")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    title_fill = PatternFill(start_color="E8F0FE", end_color="E8F0FE", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin', color='CCCCCC'),
        right=Side(style='thin', color='CCCCCC'),
        top=Side(style='thin', color='CCCCCC'),
        bottom=Side(style='thin', color='CCCCCC')
    )
    center_align = Alignment(horizontal='center', vertical='center')
    left_align = Alignment(horizontal='left', vertical='center')

    headers = [
        "STT", "Mã NV", "Họ và tên", "Vị trí / Role", "Giới tính",
        "Email Viettel", "Số điện thoại", "Quê quán", "Ngân hàng",
        "Số tài khoản", "Dự án", "Trạng thái"
    ]

    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    title_cell = ws.cell(row=1, column=1, value="DANH SÁCH THỰC TẬP SINH – VIETTEL SOFTWARE")
    title_cell.font = title_font
    title_cell.fill = title_fill
    title_cell.alignment = center_align

    for c_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=2, column=c_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border

    for r_idx, i in enumerate(interns, start=3):
        row_vals = [
            r_idx - 2, i.employee_code or "", i.full_name or "", i.role or "", i.gender or "",
            i.viettel_email or "", i.phone or "", i.hometown or "", i.bank_name or "",
            i.bank_account or "", i.project or "", i.working_status or "Working"
        ]
        for c_idx, val in enumerate(row_vals, start=1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = thin_border
            cell.alignment = center_align if c_idx in (1, 2, 5, 12) else left_align

    col_widths = [6, 12, 22, 16, 10, 25, 14, 16, 16, 18, 18, 12]
    for idx, width in enumerate(col_widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(idx)
        ws.column_dimensions[col_letter].width = width

    buf = BytesIO()
    wb.save(buf); buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Danh_Sach_Thuc_Tap_Sinh_Viettel.xlsx"}
    )
