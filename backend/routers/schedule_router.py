from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from services.schedule_service import ScheduleService

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("/periods")
def get_open_periods(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_user)):
    return ScheduleService.get_open_periods(db)


@router.get("/me")
def get_my_schedule(
    period_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return ScheduleService.get_my_schedule(period_id, current_user, db)


@router.post("/me")
def submit_schedule(
    data: schemas.ScheduleSubmit,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return ScheduleService.submit_schedule(data, current_user, db)
