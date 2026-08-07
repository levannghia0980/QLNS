from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models
import schemas
import auth
from services.employee.employee_overtime_service import EmployeeOvertimeService

router = APIRouter(prefix="/overtime", tags=["Employee - Overtime Registration"])


@router.post("/")
def create_overtime(
    body: schemas.OvertimeCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return EmployeeOvertimeService.create_overtime(body, current_user, db)


@router.post("/preview")
def preview_overtime(body: schemas.OvertimePreviewRequest):
    return EmployeeOvertimeService.preview_overtime(body)


@router.get("/my")
def list_my_overtime(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return EmployeeOvertimeService.list_my_ot(month, year, current_user, db)


@router.get("/my/stats")
def get_my_overtime_stats(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return EmployeeOvertimeService.get_my_stats(month, year, current_user, db)


@router.put("/{ot_id}")
def update_my_overtime(
    ot_id: int,
    body: schemas.OvertimeUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return EmployeeOvertimeService.update_my_ot(ot_id, body, current_user, db)


@router.delete("/{ot_id}")
def delete_my_overtime(
    ot_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return EmployeeOvertimeService.delete_my_ot(ot_id, current_user, db)
