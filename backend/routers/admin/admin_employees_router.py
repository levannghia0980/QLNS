from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models
import schemas
import auth
from services.admin.admin_employee_service import AdminEmployeeService

router = APIRouter(tags=["Admin - Employees & Accounts"])


# ── Danh sách nhân sự & Thực tập sinh ──────────────────────────────────────────
@router.get("/employees/", response_model=List[schemas.UserResponse])
def list_employees(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.list_employees(db)


@router.get("/admin/interns", response_model=List[schemas.UserResponse])
def list_interns(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.list_interns(db)


@router.post("/employees/", response_model=schemas.UserResponse)
def create_employee(
    data: schemas.UserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.create_user(data, db)


@router.put("/employees/{user_id}", response_model=schemas.UserResponse)
def update_employee(
    user_id: int,
    data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminEmployeeService.update_user(user_id, data, db)


@router.delete("/employees/{user_id}")
def delete_employee(
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
