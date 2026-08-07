import calendar
from datetime import date, datetime
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

import models
import schemas


def parse_time_minutes(t_str: str) -> int:
    try:
        parts = t_str.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        raise HTTPException(status_code=400, detail="Định dạng giờ không hợp lệ. Dùng HH:MM")


def calc_raw_hours(start_min: int, end_min: int) -> float:
    return round((end_min - start_min) / 60.0, 2)


def get_ot_factor(is_holiday: bool, is_weekend: bool, before_22: bool) -> float:
    if is_holiday:
        return 3.0 if before_22 else 3.9
    if is_weekend:
        return 2.0 if before_22 else 2.7
    return 1.5 if before_22 else 2.1


def split_segments(start_min: int, end_min: int, is_holiday: bool, is_weekend: bool):
    split_min = 22 * 60
    if start_min < split_min and end_min > split_min:
        raw1 = calc_raw_hours(start_min, split_min)
        factor1 = get_ot_factor(is_holiday, is_weekend, before_22=True)
        seg1 = {
            "start_time": f"{start_min//60:02d}:{start_min%60:02d}",
            "end_time": "22:00",
            "raw_hours": raw1,
            "factor": factor1,
            "weighted_hours": round(raw1 * factor1, 2),
        }

        raw2 = calc_raw_hours(split_min, end_min)
        factor2 = get_ot_factor(is_holiday, is_weekend, before_22=False)
        seg2 = {
            "start_time": "22:00",
            "end_time": f"{end_min//60:02d}:{end_min%60:02d}",
            "raw_hours": raw2,
            "factor": factor2,
            "weighted_hours": round(raw2 * factor2, 2),
        }
        return [seg1, seg2]
    else:
        before_22 = end_min <= split_min
        raw = calc_raw_hours(start_min, end_min)
        factor = get_ot_factor(is_holiday, is_weekend, before_22=before_22)
        seg = {
            "start_time": f"{start_min//60:02d}:{start_min%60:02d}",
            "end_time": f"{end_min//60:02d}:{end_min%60:02d}",
            "raw_hours": raw,
            "factor": factor,
            "weighted_hours": round(raw * factor, 2),
        }
        return [seg]


def validate_ot_time(start_str: str, end_str: str, work_date: date):
    start_min = parse_time_minutes(start_str)
    end_min = parse_time_minutes(end_str)
    if work_date.weekday() in (0, 1, 2, 3, 4):
        if start_min < 18 * 60 + 30:
            raise HTTPException(
                status_code=400,
                detail="Thời gian bắt đầu OT các ngày từ Thứ 2 đến Thứ 6 phải từ 18:30 trở đi."
            )
    if end_min <= start_min:
        raise HTTPException(
            status_code=400,
            detail="Thời gian kết thúc phải lớn hơn thời gian bắt đầu."
        )
    raw = calc_raw_hours(start_min, end_min)
    if raw > 24:
        raise HTTPException(status_code=400, detail="OT không được quá 24 giờ.")
    return start_min, end_min, raw


def check_overlap(
    db: Session,
    user_id: int,
    work_date: date,
    start_min: int,
    end_min: int,
    exclude_ids: Optional[list] = None,
):
    existing_q = db.query(models.OvertimeRequest).filter(
        models.OvertimeRequest.user_id == user_id,
        models.OvertimeRequest.work_date == work_date,
        models.OvertimeRequest.status != "Rejected",
    )
    if exclude_ids:
        existing_q = existing_q.filter(
            models.OvertimeRequest.id.notin_(exclude_ids)
        )
    for ot in existing_q.all():
        ex_start = parse_time_minutes(ot.start_time)
        ex_end = parse_time_minutes(ot.end_time)
        if start_min < ex_end and end_min > ex_start:
            raise HTTPException(
                status_code=400,
                detail=f"Khoảng thời gian OT bị trùng với đăng ký đã có ({ot.start_time}–{ot.end_time})."
            )


def enrich_ot(ot: models.OvertimeRequest) -> dict:
    d = {c.name: getattr(ot, c.name) for c in ot.__table__.columns}
    if ot.user:
        d["employee_code"] = ot.user.employee_code
        d["full_name"] = ot.user.full_name
    return d


class EmployeeOvertimeService:
    @staticmethod
    def create_overtime(body: schemas.OvertimeCreate, current_user: models.User, db: Session) -> dict:
        if current_user.user_type != "employee":
            raise HTTPException(status_code=403, detail="Chỉ nhân sự mới được đăng ký OT.")
        if current_user.staff_category != "Onsite":
            raise HTTPException(status_code=403, detail="Bạn chưa được cấp quyền đăng ký OT. Vui lòng liên hệ quản trị viên.")
        if not current_user.project:
            raise HTTPException(status_code=403, detail="Bạn chưa được gán dự án. Vui lòng liên hệ quản trị viên.")
        if current_user.account_status != 1:
            raise HTTPException(status_code=403, detail="Tài khoản đang bị khóa.")

        start_min, end_min, _ = validate_ot_time(body.start_time, body.end_time, body.work_date)
        check_overlap(db, current_user.id, body.work_date, start_min, end_min)

        is_weekend = body.work_date.weekday() in (5, 6)
        segments = split_segments(start_min, end_min, body.is_holiday, is_weekend)

        created = []
        for seg in segments:
            ot = models.OvertimeRequest(
                user_id=current_user.id,
                project=current_user.project,
                work_date=body.work_date,
                start_time=seg["start_time"],
                end_time=seg["end_time"],
                raw_hours=seg["raw_hours"],
                factor=seg["factor"],
                weighted_hours=seg["weighted_hours"],
                reason=body.reason,
                status="Pending",
            )
            db.add(ot)
            created.append(ot)
        db.commit()
        for ot in created:
            db.refresh(ot)

        return {
            "message": f"Đăng ký OT thành công ({len(created)} bản ghi).",
            "segments": len(created),
            "records": [enrich_ot(r) for r in created],
        }

    @staticmethod
    def preview_overtime(body: schemas.OvertimePreviewRequest) -> dict:
        start_min, end_min, _ = validate_ot_time(body.start_time, body.end_time, body.work_date)
        is_weekend = body.work_date.weekday() in (5, 6)
        segments = split_segments(start_min, end_min, body.is_holiday, is_weekend)
        total_raw = round(sum(s["raw_hours"] for s in segments), 2)
        total_weighted = round(sum(s["weighted_hours"] for s in segments), 2)
        return {
            "segments": segments,
            "total_raw_hours": total_raw,
            "total_weighted_hours": total_weighted,
        }

    @staticmethod
    def list_my_ot(month: Optional[int], year: Optional[int], current_user: models.User, db: Session) -> List[dict]:
        now = datetime.now()
        m = month or now.month
        y = year or now.year
        first_day = date(y, m, 1)
        last_day = date(y, m, calendar.monthrange(y, m)[1])

        records = db.query(models.OvertimeRequest).filter(
            models.OvertimeRequest.user_id == current_user.id,
            models.OvertimeRequest.work_date >= first_day,
            models.OvertimeRequest.work_date <= last_day,
        ).order_by(models.OvertimeRequest.work_date.desc(), models.OvertimeRequest.start_time).all()
        return [enrich_ot(r) for r in records]

    @staticmethod
    def get_my_stats(month: Optional[int], year: Optional[int], current_user: models.User, db: Session) -> dict:
        now = datetime.now()
        m = month or now.month
        y = year or now.year
        first_day = date(y, m, 1)
        last_day = date(y, m, calendar.monthrange(y, m)[1])

        records = db.query(models.OvertimeRequest).filter(
            models.OvertimeRequest.user_id == current_user.id,
            models.OvertimeRequest.work_date >= first_day,
            models.OvertimeRequest.work_date <= last_day,
        ).all()

        approved = [r for r in records if r.status == "Approved"]
        total_raw = round(sum(r.raw_hours for r in approved), 2)
        total_weighted = round(sum(r.weighted_hours for r in approved), 2)
        pending_count = sum(1 for r in records if r.status == "Pending")
        approved_count = len(approved)
        rejected_count = sum(1 for r in records if r.status == "Rejected")

        is_onsite = current_user.staff_category == "Onsite"
        has_project = bool(current_user.project)

        return {
            "total_raw_hours": total_raw,
            "total_weighted_hours": total_weighted,
            "pending_count": pending_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "is_onsite": is_onsite,
            "has_project": has_project,
        }

    @staticmethod
    def update_my_ot(ot_id: int, body: schemas.OvertimeUpdate, current_user: models.User, db: Session) -> dict:
        ot = db.query(models.OvertimeRequest).filter(
            models.OvertimeRequest.id == ot_id,
            models.OvertimeRequest.user_id == current_user.id,
        ).first()
        if not ot:
            raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu OT.")
        if ot.status not in ("Pending", "Rejected"):
            raise HTTPException(status_code=400, detail="Chỉ sửa được OT đang ở trạng thái Pending hoặc Rejected.")

        start_min, end_min, raw = validate_ot_time(body.start_time, body.end_time, ot.work_date)
        check_overlap(db, current_user.id, ot.work_date, start_min, end_min, exclude_ids=[ot.id])

        is_weekend = ot.work_date.weekday() in (5, 6)
        before_22 = end_min <= 22 * 60
        factor = get_ot_factor(body.is_holiday, is_weekend, before_22=before_22)

        ot.start_time = body.start_time
        ot.end_time = body.end_time
        ot.raw_hours = raw
        ot.factor = factor
        ot.weighted_hours = round(raw * factor, 2)
        ot.reason = body.reason
        ot.status = "Pending"
        ot.reject_reason = None
        db.commit()
        db.refresh(ot)
        return enrich_ot(ot)

    @staticmethod
    def delete_my_ot(ot_id: int, current_user: models.User, db: Session) -> dict:
        ot = db.query(models.OvertimeRequest).filter(
            models.OvertimeRequest.id == ot_id,
            models.OvertimeRequest.user_id == current_user.id,
        ).first()
        if not ot:
            raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu OT.")
        if ot.status not in ("Pending", "Rejected"):
            raise HTTPException(status_code=400, detail="Chỉ xóa được OT đang ở trạng thái Pending hoặc Rejected.")
        db.delete(ot)
        db.commit()
        return {"message": "Đã xóa yêu cầu OT thành công."}
