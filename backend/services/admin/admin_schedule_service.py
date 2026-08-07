from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
import calendar
from typing import List

import models
import schemas


class AdminScheduleService:
    @staticmethod
    def get_period(month: int, year: int, db: Session) -> models.SchedulePeriod:
        period = db.query(models.SchedulePeriod).filter(
            models.SchedulePeriod.month == month,
            models.SchedulePeriod.year == year
        ).first()
        if not period:
            period = models.SchedulePeriod(month=month, year=year, status="closed")
            db.add(period)
            db.commit()
            db.refresh(period)
        return period

    @staticmethod
    def open_period(body: schemas.SchedulePeriodOpen, db: Session) -> models.SchedulePeriod:
        period = AdminScheduleService.get_period(body.month, body.year, db)
        period.status = "open"
        period.open_date = datetime.now()
        period.close_date = body.close_date
        db.commit()
        db.refresh(period)
        return period

    @staticmethod
    def close_period(month: int, year: int, db: Session) -> models.SchedulePeriod:
        period = AdminScheduleService.get_period(month, year, db)
        period.status = "closed"
        db.commit()
        db.refresh(period)
        return period
