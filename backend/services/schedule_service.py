from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
import schemas

class ScheduleService:
    @staticmethod
    def get_open_periods(db: Session) -> List[dict]:
        periods = db.query(models.SchedulePeriod).order_by(
            models.SchedulePeriod.year.desc(), models.SchedulePeriod.month.desc()
        ).all()
        return [
            {
                "id": p.id,
                "month": p.month,
                "year": p.year,
                "status": p.status,
                "open_date": str(p.open_date) if p.open_date else None,
                "close_date": str(p.close_date) if p.close_date else None,
            }
            for p in periods
        ]

    @staticmethod
    def get_my_schedule(period_id: int, current_user: models.User, db: Session) -> List[dict]:
        schedules = (
            db.query(models.Schedule)
            .filter(
                models.Schedule.period_id == period_id,
                models.Schedule.user_id == current_user.id,
            )
            .all()
        )
        return [
            {"id": s.id, "work_day": str(s.work_day), "shift": s.shift}
            for s in schedules
        ]

    @staticmethod
    def submit_schedule(data: schemas.ScheduleSubmit, current_user: models.User, db: Session) -> dict:
        period = db.query(models.SchedulePeriod).filter(models.SchedulePeriod.id == data.period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Không tìm thấy kỳ đăng ký")
        if period.status != "open":
            raise HTTPException(status_code=400, detail="Kỳ đăng ký đã đóng")

        db.query(models.Schedule).filter(
            models.Schedule.period_id == data.period_id,
            models.Schedule.user_id == current_user.id,
        ).delete()

        for entry in data.entries:
            if entry.shift in ("S", "C", "SC"):
                s = models.Schedule(
                    period_id=data.period_id,
                    user_id=current_user.id,
                    work_day=entry.work_day,
                    shift=entry.shift,
                )
                db.add(s)
        db.commit()
        return {"message": "Đăng ký lịch thành công"}
