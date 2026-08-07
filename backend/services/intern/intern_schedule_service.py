from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
import calendar
from typing import List

import models
import schemas


class InternScheduleService:
    @staticmethod
    def get_active_period(db: Session) -> models.SchedulePeriod:
        period = db.query(models.SchedulePeriod).filter(models.SchedulePeriod.status == "open").first()
        if not period:
            raise HTTPException(status_code=400, detail="Hiện tại chưa mở đợt đăng ký lịch thực tập.")
        return period

    @staticmethod
    def register_schedule(body: schemas.ScheduleRegistration, current_user: models.User, db: Session) -> dict:
        period = InternScheduleService.get_active_period(db)

        # Xóa các lịch đã đăng ký cũ trong đợt
        db.query(models.Schedule).filter(
            models.Schedule.period_id == period.id,
            models.Schedule.user_id == current_user.id
        ).delete()

        created = 0
        for item in body.items:
            s = models.Schedule(
                period_id=period.id,
                user_id=current_user.id,
                work_day=item.work_day,
                shift=item.shift
            )
            db.add(s)
            created += 1

        db.commit()
        return {"message": f"Đã đăng ký thành công {created} buổi thực tập."}

    @staticmethod
    def get_my_schedule(month: int, year: int, current_user: models.User, db: Session) -> List[models.Schedule]:
        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        return db.query(models.Schedule).filter(
            models.Schedule.user_id == current_user.id,
            models.Schedule.work_day >= first_day,
            models.Schedule.work_day <= last_day
        ).all()
