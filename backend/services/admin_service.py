from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from io import BytesIO
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import calendar
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
def natural_sort_key(u):
    code = getattr(u, 'employee_code', '') or ''
    match = re.search(r'\d+', str(code))
    if match:
        prefix = str(code)[:match.start()].lower()
        num = int(match.group(0))
        return (prefix, num, str(code).lower())
    return (str(code).lower(), 0, str(code).lower())


class AdminService:
    @staticmethod
    def list_interns(db: Session) -> List[models.User]:
        return db.query(models.User).filter(
            models.User.user_type == "intern"
        ).order_by(models.User.created_at.desc()).all()

    @staticmethod
    def create_intern(data: schemas.UserCreate, db: Session) -> models.User:
        existing = db.query(models.User).filter(models.User.employee_code == data.employee_code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Mã nhân viên đã tồn tại")

        user_data = data.model_dump()
        user_data["user_type"] = "intern"
        user_data["role"] = "user" if data.role not in ("admin",) else data.role

        user = models.User(**user_data)
        db.add(user)
        db.flush()
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
        db.delete(user)
        db.commit()
        return {"message": f"Đã xóa tài khoản {user.full_name}"}

    @staticmethod
    def download_intern_template() -> StreamingResponse:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Danh sách Thực tập sinh"

        headers = [
            "HỌ VÀ TÊN (*)", "MÃ NV (*)", "ROLE (VD: Dev, Test, BA, PM, Admin)",
            "GIỚI TÍNH", "DÂN TỘC", "EMAIL VIETTEL", "NGÀY SINH (DD/MM/YYYY)",
            "QUÊ QUÁN", "SỐ ĐIỆN THOẠI", "SỐ CCCD", "NGÂN HÀNG", "SỐ TÀI KHOẢN",
            "DỰ ÁN THAM GIA", "NGÀY VÀO LÀM (DD/MM/YYYY)", "TRỢ CẤP (Có/Không)",
            "LOẠI NHÂN SỰ (TTS Trung tâm/Đi mượn)", "TÌNH TRẠNG (Đang làm/Đã nghỉ/Lên chính thức)"
        ]

        sample_rows = [
            [
                "Nguyễn Văn Hoàng", "480598", "Dev", "Nam", "Kinh",
                "hoangnv48@viettel.com.vn", "22/01/2001", "Tuyên Quang",
                "0987654321", "001201012345", "MB Bank", "999988887777",
                "Dự án Quản lý TTS", "01/06/2024", "Có", "TTS Trung tâm", "Đang làm"
            ]
        ]

        header_font = Font(name="Calibri", size=11, bold=True, color="000000")
        header_fill = PatternFill("solid", fgColor="DDEEFF")
        center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left = Alignment(horizontal="left", vertical="center")

        for col_idx, header in enumerate(headers, start=1):
            c = ws.cell(1, col_idx, header)
            c.font = header_font
            c.fill = header_fill
            c.alignment = center

        for r_idx, s_row in enumerate(sample_rows, start=2):
            for col_idx, val in enumerate(s_row, start=1):
                c = ws.cell(r_idx, col_idx, val)
                c.alignment = left

        ws.row_dimensions[1].height = 28

        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 18)

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=template_import_tts.xlsx"},
        )

    @staticmethod
    def process_import_users(ws, db: Session):
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return {"message": "File Excel không có dữ liệu", "success": 0, "created": 0, "updated": 0}

        # If row 0 is a title row (e.g. DANH SÁCH THỰC TẬP SINH), skip to row 1 for header
        start_row_idx = 0
        if rows[0] and rows[0][0] and "danh sách" in str(rows[0][0]).lower():
            start_row_idx = 1

        if start_row_idx >= len(rows):
            return {"message": "File không có hàng tiêu đề hợp lệ", "success": 0, "created": 0, "updated": 0}

        header_row = [str(cell).strip().lower() if cell is not None else "" for cell in rows[start_row_idx]]

        col_map = {}
        for idx, h in enumerate(header_row):
            if not h:
                continue
            if "họ" in h or "tên" in h or "full_name" in h:
                col_map["full_name"] = idx
            elif "mã" in h or "code" in h:
                col_map["employee_code"] = idx
            elif "role" in h or "vị trí" in h:
                col_map["role"] = idx
            elif "giới tính" in h or "gender" in h:
                col_map["gender"] = idx
            elif "dân tộc" in h or "ethnicity" in h:
                col_map["ethnicity"] = idx
            elif "email" in h:
                col_map["viettel_email"] = idx
            elif "ngày sinh" in h or "birthday" in h:
                col_map["birthday"] = idx
            elif "quê quán" in h or "hometown" in h:
                col_map["hometown"] = idx
            elif "điện thoại" in h or "sđt" in h or "phone" in h:
                col_map["phone"] = idx
            elif "cccd" in h or "cmnd" in h:
                col_map["cccd"] = idx
            elif "ngân hàng" in h or "bank_name" in h:
                col_map["bank_name"] = idx
            elif "tài khoản" in h or "stk" in h or "bank_account" in h:
                col_map["bank_account"] = idx
            elif "dự án" in h or "project" in h:
                col_map["project"] = idx
            elif "ngày vào" in h or "join" in h:
                col_map["join_date"] = idx
            elif "trợ cấp" in h or "allowance" in h:
                col_map["allowance"] = idx
            elif "loại nhân sự" in h or "employee_type" in h:
                col_map["employee_type"] = idx
            elif "tình trạng" in h or "trạng thái" in h or "working_status" in h:
                col_map["working_status"] = idx

        def get_str(row, key, fallback_idx):
            idx = col_map.get(key, fallback_idx)
            if idx is not None and idx < len(row) and row[idx] is not None:
                v = str(row[idx]).strip()
                return v if v != "" else None
            return None

        def get_raw(row, key, fallback_idx):
            idx = col_map.get(key, fallback_idx)
            if idx is not None and idx < len(row):
                return row[idx]
            return None

        # Build existing user lookups by code and accent-stripped name
        users_all = db.query(models.User).all()
        users_by_code = {u.employee_code.strip().lower(): u for u in users_all if u.employee_code}
        users_by_name = {normalize_name(u.full_name): u for u in users_all if u.full_name}

        # Track max numeric suffix in TTS employee codes (TTS1, TTS2...)
        max_tts_num = 0
        for u in users_all:
            if u.employee_code:
                match = re.search(r'\d+', u.employee_code)
                if match:
                    num = int(match.group(0))
                    if num > max_tts_num:
                        max_tts_num = num

        created_count = 0
        updated_count = 0

        for row in rows[start_row_idx + 1:]:
            if not row:
                continue

            full_name = get_str(row, "full_name", 0)
            emp_code = get_str(row, "employee_code", 1)

            if not full_name:
                continue

            norm_n = normalize_name(full_name)
            existing = None
            if emp_code and emp_code.strip().lower() in users_by_code:
                existing = users_by_code[emp_code.strip().lower()]
            elif norm_n in users_by_name:
                existing = users_by_name[norm_n]

            # Auto-generate next TTS employee code if missing or new
            if not existing:
                if not emp_code:
                    max_tts_num += 1
                    emp_code = f"TTS{max_tts_num}"
                else:
                    code_norm = emp_code.strip().lower()
                    if code_norm in users_by_code:
                        max_tts_num += 1
                        emp_code = f"TTS{max_tts_num}"

            raw_role = get_str(row, "role", 2)
            role_str = "user"
            position_str = raw_role or "TTS"
            if raw_role:
                r_lower = raw_role.lower()
                if r_lower in ["admin", "quản trị viên", "quản trị"]:
                    role_str = "admin"
                    position_str = "Admin"

            gender = get_str(row, "gender", 3)
            ethnicity = get_str(row, "ethnicity", 4)
            viettel_email = get_str(row, "viettel_email", 5)

            raw_birthday = get_raw(row, "birthday", 6)
            birthday = parse_excel_date(raw_birthday)

            hometown = get_str(row, "hometown", 7)
            phone = get_str(row, "phone", 8)
            cccd = get_str(row, "cccd", 9)
            bank_name = get_str(row, "bank_name", 10)
            bank_account = get_str(row, "bank_account", 11)
            project = get_str(row, "project", 12)

            raw_join_date = get_raw(row, "join_date", 13)
            join_date = parse_excel_date(raw_join_date)

            raw_allowance = get_str(row, "allowance", 14)
            allowance = "Không"
            if raw_allowance and any(k in raw_allowance.lower() for k in ["có", "yes", "1", "co"]):
                allowance = "Có"

            raw_emp_type = get_str(row, "employee_type", 15)
            employee_type = "TTS Trung tâm"
            if raw_emp_type and "mượn" in raw_emp_type.lower():
                employee_type = "Đi mượn"

            raw_status = get_str(row, "working_status", 16)
            working_status = "Working"
            if raw_status:
                st_lower = raw_status.lower()
                if "nghỉ" in st_lower or "resigned" in st_lower:
                    working_status = "Resigned"
                elif "chính thức" in st_lower:
                    working_status = "Lên chính thức"
                elif "đang làm" in st_lower or "working" in st_lower:
                    working_status = "Working"
                else:
                    working_status = raw_status

            if existing:
                existing.full_name = full_name
                if gender: existing.gender = gender
                if ethnicity: existing.ethnicity = ethnicity
                if viettel_email: existing.viettel_email = viettel_email
                if birthday: existing.birthday = birthday
                if hometown: existing.hometown = hometown
                if phone: existing.phone = phone
                if cccd: existing.cccd = cccd
                if bank_name: existing.bank_name = bank_name
                if bank_account: existing.bank_account = bank_account
                if project: existing.project = project
                if position_str: existing.position = position_str
                if join_date: existing.join_date = join_date
                if allowance: existing.allowance = allowance
                if employee_type: existing.employee_type = employee_type
                if working_status: existing.working_status = working_status
                updated_count += 1
            else:
                new_user = models.User(
                    employee_code=emp_code,
                    full_name=full_name,
                    role=role_str,
                    user_type="intern",
                    gender=gender or "Nam",
                    ethnicity=ethnicity or "Kinh",
                    viettel_email=viettel_email,
                    birthday=birthday,
                    hometown=hometown,
                    phone=phone,
                    cccd=cccd,
                    bank_name=bank_name or "Viettel Money",
                    bank_account=bank_account,
                    project=project,
                    position=position_str,
                    join_date=join_date,
                    allowance=allowance,
                    employee_type=employee_type,
                    working_status=working_status,
                    account_status=1,
                )
                db.add(new_user)
                users_by_code[emp_code.strip().lower()] = new_user
                users_by_name[norm_n] = new_user
                created_count += 1

        db.commit()
        return {
            "message": f"Đồng bộ thành công! Thêm mới: {created_count} TTS, Cập nhật: {updated_count} TTS.",
            "success": 1,
            "created": created_count,
            "updated": updated_count,
        }

    @staticmethod
    def export_interns(db: Session):
        """Xuất danh sách Thực tập sinh ra file Excel (.xlsx)"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "DS Thực Tập Sinh"

        headers = [
            "Họ và tên (*)", "Mã NV (*)", "Vị trí / Role", "Giới tính", "Email Viettel",
            "Số điện thoại", "Quê quán", "Ngân hàng", "Số tài khoản", "Dự án tham gia",
            "Tình trạng"
        ]
        ws.append(headers)

        interns = db.query(models.User).filter(models.User.user_type == "intern").all()
        interns = sorted(interns, key=natural_sort_key)

        for i in interns:
            ws.append([
                i.full_name or "",
                i.employee_code or "",
                i.role or "user",
                i.gender or "Nam",
                i.viettel_email or "",
                i.phone or "",
                i.hometown or "",
                i.bank_name or "",
                i.bank_account or "",
                i.project or "",
                i.working_status or "Working"
            ])

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Danh_Sach_Thuc_Tap_Sinh.xlsx"}
        )

    @staticmethod
    def toggle_lock(user_id: int, db: Session) -> dict:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        user.account_status = 0 if user.account_status == 1 else 1
        db.commit()
        return {"account_status": user.account_status, "message": "Đã cập nhật trạng thái tài khoản"}

    @staticmethod
    def reset_password(user_id: int, db: Session) -> dict:
        account = db.query(models.Account).filter(models.Account.user_id == user_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản cho người dùng này")
        account.password = auth.hash_password("123456")
        db.commit()
        return {"message": f"Đã đặt lại mật khẩu về 123456 cho tài khoản {account.username}"}

    @staticmethod
    def list_accounts(user_type: str, db: Session) -> List[schemas.AdminAccountRow]:
        users = db.query(models.User).filter(models.User.user_type == user_type).order_by(models.User.created_at.desc()).all()
        results = []
        for u in users:
            results.append(schemas.AdminAccountRow(
                user_id=u.id,
                employee_code=u.employee_code,
                full_name=u.full_name,
                username=u.account.username if u.account else None,
                account_status=u.account_status,
            ))
        return results

    @staticmethod
    def export_accounts(user_type: str, db: Session) -> StreamingResponse:
        users = db.query(models.User).filter(models.User.user_type == user_type).order_by(models.User.full_name).all()

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Danh sach Tai khoan"

        header_font = Font(color="FFFFFF", bold=True)
        header_fill = PatternFill("solid", fgColor="1e3a5f")
        center = Alignment(horizontal="center", vertical="center")

        headers = ["STT", "Mã NV", "Họ tên", "Tên đăng nhập", "Trạng thái"]
        for col_idx, header in enumerate(headers, start=1):
            c = ws.cell(1, col_idx, header)
            c.font = header_font
            c.fill = header_fill
            c.alignment = center

        ws.column_dimensions["B"].width = 15
        ws.column_dimensions["C"].width = 25
        ws.column_dimensions["D"].width = 20
        ws.column_dimensions["E"].width = 15

        for row_idx, u in enumerate(users, start=2):
            ws.cell(row_idx, 1, row_idx - 1).alignment = center
            ws.cell(row_idx, 2, u.employee_code).alignment = center
            ws.cell(row_idx, 3, u.full_name)
            ws.cell(row_idx, 4, u.account.username if u.account else "N/A").alignment = center
            ws.cell(row_idx, 5, "Mở" if u.account_status == 1 else "Khóa").alignment = center

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=danh_sach_tai_khoan.xlsx"},
        )

    @staticmethod
    def get_stats(db: Session) -> dict:
        now = datetime.now()
        interns = db.query(models.User).filter(models.User.user_type == "intern").all()
        employees = db.query(models.User).filter(models.User.user_type == "employee").all()
        periods = db.query(models.SchedulePeriod).all()
        open_periods = [p for p in periods if p.status == "open"]
        working = [u for u in interns if (u.working_status or '').lower() == "working"]
        resigned = [u for u in interns if (u.working_status or '').lower() == "resigned"]
        fulltime = [u for u in interns if (u.employment_type or '').lower() == "fulltime"]
        parttime = [u for u in interns if (u.employment_type or '').lower() == "parttime"]
        intern_count = [u for u in interns if (u.employee_type or '').lower() in ["tts trung tâm", "intern", "thực tập"]]
        borrowed_count = [u for u in interns if (u.employee_type or '').lower() in ["đi mượn", "borrowed"]]

        emp_trung_tam = [u for u in employees if (u.staff_category or '').lower() in ["ns trung tâm", "nhân sự trung tâm"]]
        emp_cho_muon = [u for u in employees if (u.staff_category or '').lower() in ["cho mượn", "đi mượn"]]
        emp_onsite = [u for u in employees if (u.staff_category or '').lower() in ["onsite"]]

        today_date = now.date()
        today_schedules = (
            db.query(models.Schedule, models.User)
            .join(models.User, models.Schedule.user_id == models.User.id)
            .filter(models.Schedule.work_day == today_date)
            .all()
        )
        today_workers = [
            {"employee_code": u.employee_code, "full_name": u.full_name, "shift": s.shift}
            for s, u in today_schedules if s.shift in ("S", "C", "SC") and (u.working_status or '').lower() == "working"
        ]

        return {
            "total_interns": len(interns),
            "total_employees": len(employees),
            "working": len(working),
            "resigned": len(resigned),
            "fulltime": len(fulltime),
            "parttime": len(parttime),
            "intern_count": len(intern_count),
            "borrowed_count": len(borrowed_count),
            "emp_trung_tam": len(emp_trung_tam),
            "emp_cho_muon": len(emp_cho_muon),
            "emp_onsite": len(emp_onsite),
            "total_periods": len(periods),
            "open_periods": len(open_periods),
            "today_workers": today_workers,
        }

    @staticmethod
    def list_periods(db: Session) -> List[models.SchedulePeriod]:
        return db.query(models.SchedulePeriod).order_by(
            models.SchedulePeriod.year.desc(), models.SchedulePeriod.month.desc()
        ).all()

    @staticmethod
    def create_period(data: schemas.PeriodCreate, db: Session) -> models.SchedulePeriod:
        existing = db.query(models.SchedulePeriod).filter(
            models.SchedulePeriod.month == data.month,
            models.SchedulePeriod.year == data.year,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Kỳ đăng ký tháng này đã tồn tại")
        period = models.SchedulePeriod(**data.model_dump())
        db.add(period)
        db.commit()
        db.refresh(period)
        return period

    @staticmethod
    def update_period(period_id: int, data: schemas.PeriodUpdate, db: Session) -> models.SchedulePeriod:
        period = db.query(models.SchedulePeriod).filter(models.SchedulePeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Không tìm thấy kỳ đăng ký")
        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(period, field, val)
        db.commit()
        db.refresh(period)
        return period

    @staticmethod
    def delete_period(period_id: int, db: Session) -> dict:
        period = db.query(models.SchedulePeriod).filter(models.SchedulePeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Không tìm thấy kỳ đăng ký")
        db.query(models.Schedule).filter(models.Schedule.period_id == period_id).delete()
        db.delete(period)
        db.commit()
        return {"message": "Đã xóa kỳ đăng ký"}

    @staticmethod
    def admin_view_schedule(month: int, year: int, db: Session) -> dict:
        period = db.query(models.SchedulePeriod).filter(
            models.SchedulePeriod.month == month,
            models.SchedulePeriod.year == year,
        ).first()

        all_interns = db.query(models.User).filter(
            models.User.user_type == "intern",
            models.User.working_status == "Working",
        ).all()

        all_interns = sorted(all_interns, key=natural_sort_key)

        if not period:
            return {"period": None, "rows": []}

        schedules = (
            db.query(models.Schedule)
            .filter(models.Schedule.period_id == period.id)
            .all()
        )

        sched_by_user = {}
        for s in schedules:
            if s.user_id not in sched_by_user:
                sched_by_user[s.user_id] = []
            sched_by_user[s.user_id].append({
                "id": s.id,
                "work_day": str(s.work_day),
                "shift": s.shift,
            })

        result = []
        for user in all_interns:
            user_scheds = sched_by_user.get(user.id, [])
            total = sum(
                1 if s["shift"] == "SC" else 0.5 if s["shift"] in ("S", "C") else 0
                for s in user_scheds
            )
            result.append({
                "user_id": user.id,
                "employee_code": user.employee_code,
                "full_name": user.full_name,
                "project": user.project or "",
                "total_sessions": total,
                "schedules": user_scheds,
            })

        return {
            "period": {
                "id": period.id,
                "month": period.month,
                "year": period.year,
                "status": period.status,
                "open_date": str(period.open_date) if period.open_date else None,
                "close_date": str(period.close_date) if period.close_date else None,
            },
            "rows": result,
        }

    @staticmethod
    def export_schedule(month: int, year: int, db: Session) -> StreamingResponse:
        period = db.query(models.SchedulePeriod).filter(
            models.SchedulePeriod.month == month,
            models.SchedulePeriod.year == year,
        ).first()

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"Lịch T{month}-{year}"

        header_fill  = PatternFill("solid", fgColor="1e3a5f")
        header_font  = Font(color="FFFFFF", bold=True, name="Calibri", size=10)
        center       = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align   = Alignment(horizontal="left", vertical="center")
        thin         = Border(
            left=Side(style="thin"), right=Side(style="thin"),
            top=Side(style="thin"), bottom=Side(style="thin")
        )
        sc_fill      = PatternFill("solid", fgColor="C6EFCE")
        half_fill    = PatternFill("solid", fgColor="FFEB9C")
        total_fill   = PatternFill("solid", fgColor="DDEEFF")
        title_font   = Font(bold=True, size=13, name="Calibri")
        total_font   = Font(bold=True, name="Calibri")

        days_in_month = calendar.monthrange(year, month)[1]
        all_days  = [date(year, month, d) for d in range(1, days_in_month + 1)]
        DOW_VN    = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(all_days) + 3)
        title_cell = ws.cell(1, 1, f"BẢNG LỊCH THỰC TẬP – THÁNG {month}/{year}")
        title_cell.font = title_font
        title_cell.alignment = center
        title_cell.fill = PatternFill("solid", fgColor="E8F0FE")
        ws.row_dimensions[1].height = 24

        def hdr(row, col, val):
            c = ws.cell(row, col, val)
            c.font = header_font
            c.fill = header_fill
            c.alignment = center
            c.border = thin
            return c

        hdr(2, 1, "Mã NV")
        hdr(2, 2, "Họ và tên")
        for col_idx, d in enumerate(all_days, start=3):
            hdr(2, col_idx, f"{d.day}\n{DOW_VN[d.weekday()]}")
            ws.column_dimensions[ws.cell(2, col_idx).column_letter].width = 4.5
        hdr(2, len(all_days) + 3, "Tổng buổi")
        ws.row_dimensions[2].height = 32
        ws.column_dimensions["A"].width = 12
        ws.column_dimensions["B"].width = 24
        col_total_letter = ws.cell(2, len(all_days) + 3).column_letter
        ws.column_dimensions[col_total_letter].width = 10

        if not period:
            buf = BytesIO()
            wb.save(buf); buf.seek(0)
            return StreamingResponse(buf,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename=lich_t{month}_{year}.xlsx"})

        schedules = db.query(models.Schedule).filter(models.Schedule.period_id == period.id).all()
        users = (
            db.query(models.User)
            .filter(models.User.user_type == "intern", models.User.working_status == "Working")
            .all()
        )
        users = sorted(users, key=natural_sort_key)
        day_col = {d: i + 3 for i, d in enumerate(all_days)}

        workdays = all_days
        grand_total = 0
        for row_idx, user in enumerate(users, start=3):
            ws.cell(row_idx, 1, user.employee_code).border = thin
            ws.cell(row_idx, 1).alignment = center
            name_cell = ws.cell(row_idx, 2, user.full_name)
            name_cell.border = thin
            name_cell.alignment = left_align

            user_sched = {s.work_day: s.shift for s in schedules if s.user_id == user.id}
            total = 0
            for d in all_days:
                col = day_col[d]
                shift = user_sched.get(d, "")
                cell = ws.cell(row_idx, col, shift or "")
                cell.alignment = center
                cell.border = thin
                if shift == "SC":
                    cell.fill = sc_fill
                    cell.font = Font(bold=True, color="276221")
                    total += 1
                elif shift in ("S", "C"):
                    cell.fill = half_fill
                    cell.font = Font(bold=True, color="9C5700")
                    total += 0.5

            grand_total += total
            tc = ws.cell(row_idx, len(all_days) + 3, total)
            tc.alignment = center
            tc.border = thin
            tc.font = total_font
            tc.fill = total_fill

        if users:
            gr = len(users) + 3
            ws.cell(gr, 1, "TỔNG CỘNG").font = Font(bold=True, name="Calibri")
            ws.cell(gr, 1).alignment = center
            ws.cell(gr, 1).border = thin
            ws.merge_cells(start_row=gr, start_column=1, end_row=gr, end_column=len(all_days) + 2)
            for col in range(1, len(all_days) + 3):
                ws.cell(gr, col).fill = PatternFill("solid", fgColor="F2F2F2")
                ws.cell(gr, col).border = thin
            gtc = ws.cell(gr, len(all_days) + 3, grand_total)
            gtc.font = Font(bold=True, size=12, name="Calibri", color="C00000")
            gtc.alignment = center
            gtc.border = thin
            gtc.fill = PatternFill("solid", fgColor="FFE4E1")

        ws.freeze_panes = "C3"

        buf = BytesIO()
        wb.save(buf); buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=lich_t{month}_{year}.xlsx"},
        )

    @staticmethod
    def process_import_schedule(ws_or_rows, month: int, year: int, db: Session):
        if hasattr(ws_or_rows, 'iter_rows'):
            rows = list(ws_or_rows.iter_rows(values_only=True))
        elif isinstance(ws_or_rows, list):
            rows = ws_or_rows
        else:
            raise HTTPException(status_code=400, detail="Dữ liệu bảng không hợp lệ")

        if not rows:
            raise HTTPException(status_code=400, detail="File hoặc bảng dữ liệu không có thông tin")

        period = db.query(models.SchedulePeriod).filter(
            models.SchedulePeriod.month == month,
            models.SchedulePeriod.year == year
        ).first()
        if not period:
            period = models.SchedulePeriod(month=month, year=year, status="open")
            db.add(period)
            db.commit()
            db.refresh(period)

        # Smart Header Scanning (Scan top 5 rows for Header Row containing "Mã NV" or day numbers)
        code_idx = -1
        name_idx = -1
        day_cols = {}
        header_row_idx = 0

        for r_i, r in enumerate(rows[:5]):
            if not r:
                continue
            r_strs = [str(cell).strip().lower() if cell is not None else "" for cell in r]
            
            c_idx = -1
            n_idx = -1
            for idx, h in enumerate(r_strs):
                if "mã" in h or "code" in h or "mnv" in h:
                    c_idx = idx
                if "tên" in h or "họ" in h or "name" in h:
                    n_idx = idx

            d_cols = {}
            for idx, h in enumerate(r_strs):
                clean_h = h.split('\n')[0].strip()
                if clean_h.isdigit():
                    d_cols[int(clean_h)] = idx

            if c_idx != -1 or n_idx != -1 or len(d_cols) > 0:
                header_row_idx = r_i
                code_idx = c_idx if c_idx != -1 else 0
                name_idx = n_idx if n_idx != -1 else 1
                day_cols = d_cols
                break

        if code_idx == -1:
            code_idx = 0
        if name_idx == -1:
            name_idx = 1

        def norm_str(s):
            if not s:
                return ""
            return " ".join(str(s).strip().lower().split())

        def strip_accents(text):
            if not text:
                return ""
            import unicodedata
            text = unicodedata.normalize('NFD', str(text))
            text = ''.join(c for c in text if unicodedata.category(c) != 'MN')
            return unicodedata.normalize('NFC', text).replace('đ', 'd').replace('Đ', 'D').strip().lower()

        all_users = db.query(models.User).filter(models.User.user_type == "intern").all()
        users_by_name = {}
        users_by_code = {}
        for u in all_users:
            if u.full_name:
                users_by_name[norm_str(u.full_name)] = u
                users_by_name[strip_accents(u.full_name)] = u
            if u.employee_code:
                users_by_code[norm_str(u.employee_code)] = u

        count = 0
        from services.hrai.sheet_pipeline import is_summary_row
        for row in data_rows:
            if not row:
                continue

            emp_code = str(row[code_idx]).strip() if (code_idx < len(row) and row[code_idx] is not None) else ""
            emp_name = str(row[name_idx]).strip() if (name_idx < len(row) and row[name_idx] is not None) else ""

            if is_summary_row(row) or (emp_code and emp_code.lower().startswith("tổng")) or (emp_name and emp_name.lower().startswith("tổng")):
                continue

            user = None
            if emp_name:
                user = users_by_name.get(norm_str(emp_name)) or users_by_name.get(strip_accents(emp_name))
            if not user and emp_code:
                user = users_by_code.get(norm_str(emp_code))

            # Auto-create user if missing in DB
            if not user and (emp_name or emp_code):
                import time
                new_code = emp_code
                if not new_code or norm_str(new_code) in users_by_code:
                    new_code = f"TTS{int(time.time() * 1000)}"
                new_name = emp_name or f"TTS {new_code}"
                user = models.User(
                    employee_code=new_code,
                    full_name=new_name,
                    username=new_code.lower(),
                    password_hash=auth.get_password_hash("123456"),
                    user_type="intern",
                    working_status="Working"
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                users_by_name[norm_str(user.full_name)] = user
                users_by_name[strip_accents(user.full_name)] = user
                users_by_code[norm_str(user.employee_code)] = user
            elif user and emp_code and user.employee_code != emp_code:
                owner = users_by_code.get(norm_str(emp_code))
                if not owner:
                    if user.employee_code:
                        users_by_code.pop(norm_str(user.employee_code), None)
                    user.employee_code = emp_code
                    users_by_code[norm_str(emp_code)] = user
                    db.commit()

            if not user:
                continue

            for d, col_i in day_cols.items():
                val = ""
                if col_i < len(row) and row[col_i] is not None:
                    val = str(row[col_i]).strip().upper()

                try:
                    w_date = date(year, month, d)
                except ValueError:
                    continue

                existing = db.query(models.Schedule).filter(
                    models.Schedule.period_id == period.id,
                    models.Schedule.user_id == user.id,
                    models.Schedule.work_day == w_date
                ).first()

                # Normalize shift string
                clean_shift = ""
                if val in ("S", "C", "SC"):
                    clean_shift = val
                elif "SÁNG" in val:
                    clean_shift = "S"
                elif "CHIỀU" in val:
                    clean_shift = "C"
                elif "CẢ NGÀY" in val or "FULL" in val:
                    clean_shift = "SC"

                if clean_shift:
                    if existing:
                        existing.shift = clean_shift
                    else:
                        db.add(models.Schedule(
                            period_id=period.id,
                            user_id=user.id,
                            work_day=w_date,
                            shift=clean_shift
                        ))
                    count += 1
                else:
                    if existing:
                        db.delete(existing)
                        count += 1

        db.commit()
        return {"message": f"Đồng bộ thành công {count} thay đổi ca làm việc!", "count": count}



