from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models
import schemas
import auth
from services.admin.admin_overtime_service import AdminOvertimeService

router = APIRouter(prefix="/overtime/admin", tags=["Admin - Overtime Management"])


@router.get("/list")
def admin_list_overtime(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    project: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    employee_name: Optional[str] = Query(None),
    staff_category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminOvertimeService.admin_list_ot(
        month, year, project, status, employee_name, staff_category, db
    )


@router.get("/summary")
def admin_overtime_summary(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    project: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminOvertimeService.admin_ot_summary(month, year, project, db)


@router.post("/{ot_id}/approve")
def admin_approve_overtime(
    ot_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminOvertimeService.admin_approve_ot(ot_id, admin, db)


@router.post("/{ot_id}/reject")
def admin_reject_overtime(
    ot_id: int,
    body: schemas.OvertimeApprove,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminOvertimeService.admin_reject_ot(ot_id, body, admin, db)


@router.post("/approve-all-pending")
def admin_approve_all_pending(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    project: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
):
    return AdminOvertimeService.admin_approve_all_pending(month, year, project, admin, db)


@router.get("/export")
def admin_export_excel(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    project: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin)
) -> StreamingResponse:
    return AdminOvertimeService.export_excel(month, year, project, db)
