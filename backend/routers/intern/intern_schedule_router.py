from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
import schemas
import auth
from services.intern.intern_schedule_service import InternScheduleService

router = APIRouter(prefix="/schedules", tags=["Intern - Schedule Registration"])


@router.get("/active-period", response_model=schemas.SchedulePeriodResponse)
def get_active_period(db: Session = Depends(get_db)):
    return InternScheduleService.get_active_period(db)


@router.post("/register")
def register_schedule(
    body: schemas.ScheduleRegistration,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return InternScheduleService.register_schedule(body, current_user, db)


@router.get("/my", response_model=List[schemas.ScheduleResponse])
def get_my_schedule(
    month: int = Query(...),
    year: int = Query(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return InternScheduleService.get_my_schedule(month, year, current_user, db)
