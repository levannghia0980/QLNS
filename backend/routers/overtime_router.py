from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models, schemas, auth
from services.overtime_service import OvertimeService

router = APIRouter(prefix="/overtime", tags=["Overtime"])


@router.post("/")
def create_overtime(
    body: schemas.OvertimeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return OvertimeService.create_overtime(body, current_user, db)


@router.get("/my", response_model=List[schemas.OvertimeResponse])
def get_my_overtime(
    month: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return OvertimeService.get_my_overtime(month, year, current_user, db)


@router.get("/my/stats")
def get_my_ot_stats(
    month: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return OvertimeService.get_my_ot_stats(month, year, current_user, db)


@router.post("/preview")
def preview_ot_split(
    body: schemas.OvertimeCreate,
    _: models.User = Depends(auth.get_current_user),
):
    return OvertimeService.preview_ot_split(body)


@router.put("/{ot_id}", response_model=schemas.OvertimeResponse)
def update_overtime(
    ot_id: int,
    body: schemas.OvertimeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return OvertimeService.update_overtime(ot_id, body, current_user, db)


@router.delete("/{ot_id}")
def delete_overtime(
    ot_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return OvertimeService.delete_overtime(ot_id, current_user, db)


@router.get("/admin/list")
def admin_list_ot(
    month: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    project: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    employee_name: Optional[str] = Query(default=None),
    staff_category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    return OvertimeService.admin_list_ot(month, year, project, status, employee_name, staff_category, db)


@router.get("/admin/summary")
def admin_ot_summary(
    month: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    project: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    return OvertimeService.admin_ot_summary(month, year, project, db)


@router.post("/admin/{ot_id}/approve", response_model=schemas.OvertimeResponse)
def admin_approve_ot(
    ot_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    return OvertimeService.admin_approve_ot(ot_id, admin, db)


@router.post("/admin/{ot_id}/reject", response_model=schemas.OvertimeResponse)
def admin_reject_ot(
    ot_id: int,
    body: schemas.OvertimeApprove,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    return OvertimeService.admin_reject_ot(ot_id, body, admin, db)


@router.post("/admin/approve-selected")
def admin_approve_selected(
    body: schemas.OvertimeApproveSelected,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    return OvertimeService.admin_approve_selected(body, admin, db)


@router.post("/admin/approve-all-pending")
def admin_approve_all_pending(
    month: Optional[int] = Query(default=None),
    year: Optional[int] = Query(default=None),
    project: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    return OvertimeService.admin_approve_all_pending(month, year, project, admin, db)


@router.get("/admin/export")
def admin_export_excel(
    month: int = Query(...),
    year: int = Query(...),
    project: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    return OvertimeService.admin_export_excel(month, year, project, db)
