from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from io import BytesIO
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from datetime import date, datetime
import unicodedata
import re
import urllib.request

import models
import schemas
import auth


def remove_accents(input_str: str) -> str:
    s = input_str.replace('đ', 'd').replace('Đ', 'D')
    nfkd_form = unicodedata.normalize('NFKD', s)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


def normalize_name(name: str) -> str:
    if not name:
        return ""
    return remove_accents(str(name)).strip().lower()


def parse_excel_date(val):
    if not val:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        val_str = val.strip()
        if not val_str:
            return None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%y"):
            try:
                return datetime.strptime(val_str, fmt).date()
            except ValueError:
                pass
    return None


def natural_sort_key(u):
    code = getattr(u, 'employee_code', '') or ''
    match = re.search(r'\d+', str(code))
    if match:
        prefix = str(code)[:match.start()].lower()
        num = int(match.group(0))
        return (prefix, num, str(code).lower())
    return (str(code).lower(), 0, str(code).lower())


class AdminEmployeeService:
    @staticmethod
    def list_employees(db: Session) -> List[models.User]:
        return db.query(models.User).filter(
            models.User.user_type == "employee"
        ).order_by(models.User.created_at.desc()).all()

    @staticmethod
    def list_interns(db: Session) -> List[models.User]:
        return db.query(models.User).filter(
            models.User.user_type == "intern"
        ).order_by(models.User.created_at.desc()).all()

    @staticmethod
    def create_user(data: schemas.UserCreate, db: Session) -> models.User:
        existing = db.query(models.User).filter(models.User.employee_code == data.employee_code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Mã nhân viên đã tồn tại")

        user_data = data.model_dump()
        user = models.User(**user_data)
        db.add(user)
        db.flush()

        # Tạo tài khoản đăng nhập mặc định
        username = (user.viettel_email or f"{user.employee_code}@viettel.com.vn").strip()
        acc = models.Account(
            user_id=user.id,
            username=username,
            password=auth.hash_password("123456")
        )
        db.add(acc)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_user(user_id: int, data: schemas.UserUpdate, db: Session) -> models.User:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(user, field, val)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete_user(user_id: int, current_user: models.User, db: Session) -> dict:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        if user.id == current_user.id:
            raise HTTPException(status_code=400, detail="Không thể xóa tài khoản đang đăng nhập")
        db.query(models.Schedule).filter(models.Schedule.user_id == user_id).delete()
        db.query(models.OvertimeRequest).filter(models.OvertimeRequest.user_id == user_id).delete()
        db.delete(user)
        db.commit()
        return {"message": f"Đã xóa tài khoản {user.full_name}"}

    @staticmethod
    def list_accounts(user_type: Optional[str], db: Session):
        q = db.query(models.Account).join(models.User)
        if user_type:
            q = q.filter(models.User.user_type == user_type)
        accounts = q.order_by(models.User.created_at.desc()).all()
        return [
            {
                "id": a.id,
                "user_id": a.user_id,
                "username": a.username,
                "created_at": a.created_at,
                "user": a.user
            }
            for a in accounts
        ]

    @staticmethod
    def reset_password(user_id: int, body: schemas.AdminResetPasswordRequest, db: Session) -> dict:
        account = db.query(models.Account).filter(models.Account.user_id == user_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng")
        account.password = auth.hash_password(body.new_password)
        db.commit()
        return {"message": "Đặt lại mật khẩu thành công"}

    @staticmethod
    def toggle_account_status(user_id: int, db: Session) -> dict:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        user.account_status = 0 if user.account_status == 1 else 1
        db.commit()
        return {"account_status": user.account_status}
