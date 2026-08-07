import re
from io import BytesIO
from typing import List, Optional
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth
from services.admin.admin_employee_service import AdminEmployeeService
from services.admin.admin_schedule_service import AdminScheduleService
from services.google_sheets_service import GoogleSheetsService

router = APIRouter(tags=["Admin - Employees, Interns & Schedules"])


# ── Danh sách nhân sự & Thực tập sinh ──────────────────────────────────────────
@router.get("/employees/", response_model=List[schemas.UserResponse])
def list_employees(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.list_employees(db)


@router.get("/admin/interns", response_model=List[schemas.UserResponse])
@router.get("/admin/users", response_model=List[schemas.UserResponse])
def list_interns(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.list_interns(db)


@router.post("/employees/", response_model=schemas.UserResponse)
@router.post("/admin/users", response_model=schemas.UserResponse)
def create_employee_or_intern(
    data: schemas.UserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.create_user(data, db)


@router.put("/employees/{user_id}", response_model=schemas.UserResponse)
@router.put("/admin/users/{user_id}", response_model=schemas.UserResponse)
def update_employee_or_intern(
    user_id: int,
    data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.update_user(user_id, data, db)


@router.delete("/employees/{user_id}")
@router.delete("/admin/users/{user_id}")
def delete_employee_or_intern(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.delete_user(user_id, admin, db)


# ── Quản lý Tài khoản Đăng nhập ───────────────────────────────────────────────
@router.get("/admin/accounts")
def list_accounts(
    user_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.list_accounts(user_type, db)


@router.post("/admin/accounts/{user_id}/reset-password")
def reset_password(
    user_id: int,
    body: schemas.AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.reset_password(user_id, body, db)


@router.patch("/admin/accounts/{user_id}/toggle-status")
def toggle_account_status(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.toggle_account_status(user_id, db)


# ── Vị trí công việc (Positions) ──────────────────────────────────────────────
@router.get("/positions/")
def list_positions(db: Session = Depends(get_db)):
    return db.query(models.Position).all()


# ── Lịch làm việc Thực tập sinh (Schedules Matrix & Export) ───────────────────
@router.get("/admin/schedule")
def get_admin_schedule(
    month: int = Query(8),
    year: int = Query(2026),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminScheduleService.get_schedule(month, year, db)


@router.get("/admin/schedule/export")
def export_admin_schedule(
    month: int = Query(8),
    year: int = Query(2026),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminScheduleService.export_schedule(month, year, db)


@router.post("/admin/schedule/open")
def open_schedule_period(
    body: schemas.SchedulePeriodOpen,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminScheduleService.open_period(body, db)


@router.post("/admin/schedule/close")
def close_schedule_period(
    month: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminScheduleService.close_period(month, year, db)


# ── Đồng bộ Google Sheets cho Lịch Thực tập sinh ─────────────────────────────
@router.post("/admin/schedule/auto-create-sheet")
def auto_create_schedule_sheet(
    body: dict = {},
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    month = body.get("month", 8)
    year = body.get("year", 2026)
    target_url = body.get("target_sheet_url")
    return GoogleSheetsService.auto_create_schedule_sheet(month, year, db, target_sheet_url=target_url)


@router.post("/admin/schedule/import-link")
@router.post("/admin/schedule/sync-sheet")
def sync_schedule_from_link(
    body: dict,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    url = body.get("url", "")
    month = body.get("month", 8)
    year = body.get("year", 2026)
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    if not match:
        raise HTTPException(status_code=400, detail="Đường dẫn Google Sheets không hợp lệ. Vui lòng kiểm tra lại link!")
    sheet_id = match.group(1)
    rows = GoogleSheetsService.read_sheet_values(sheet_id)
    if not rows:
        raise HTTPException(status_code=400, detail="Không thể đọc dữ liệu từ Google Sheet. Vui lòng kiểm tra lại quyền truy cập!")
    return GoogleSheetsService.process_import_schedule_generic(rows, month, year, db)


@router.post("/admin/schedule/import")
async def import_schedule_excel(
    month: int = Query(8),
    year: int = Query(2026),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    contents = await file.read()
    wb = openpyxl.load_workbook(BytesIO(contents), data_only=True)
    ws = wb.active
    rows = []
    for r in ws.iter_rows(values_only=True):
        rows.append(list(r))
    return GoogleSheetsService.process_import_schedule_generic(rows, month, year, db)


# ── Đồng bộ Google Sheets & Excel cho Danh sách TTS ──────────────────────────
@router.post("/admin/users/auto-create-sheet")
def auto_create_interns_sheet(
    body: dict = {},
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    target_url = body.get("target_sheet_url")
    return GoogleSheetsService.auto_create_interns_sheet(db, target_sheet_url=target_url)


@router.post("/admin/users/sync-sheet")
@router.post("/admin/users/import-link")
def sync_interns_from_link(
    body: dict,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    url = body.get("url", "")
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    if not match:
        raise HTTPException(status_code=400, detail="Đường dẫn Google Sheets không hợp lệ")
    sheet_id = match.group(1)
    rows = GoogleSheetsService.read_sheet_values(sheet_id)
    if not rows:
        raise HTTPException(status_code=400, detail="Không thể đọc dữ liệu từ Google Sheet. Vui lòng kiểm tra quyền chia sẻ!")
    return GoogleSheetsService.process_import_interns_generic(rows, db)


@router.get("/admin/users/template")
def download_interns_template(
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.download_intern_template()


@router.get("/admin/users/export")
def export_interns_excel(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    from routers.google_router import export_interns_excel_internal
    return export_interns_excel_internal(db)


@router.post("/admin/users/import")
async def import_interns_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    contents = await file.read()
    wb = openpyxl.load_workbook(BytesIO(contents), data_only=True)
    ws = wb.active
    rows = []
    for r in ws.iter_rows(values_only=True):
        rows.append(list(r))
    return GoogleSheetsService.process_import_interns_generic(rows, db)
