from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas, auth
from services.employee_service import EmployeeService

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/positions", response_model=List[schemas.PositionResponse])
def list_positions(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_current_user),
):
    return EmployeeService.list_positions(db)


@router.get("/managers", response_model=List[schemas.ManagerResponse])
def list_managers(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_current_user),
):
    return EmployeeService.list_managers(db)


@router.get("/", response_model=List[schemas.EmployeeResponse])
def list_employees(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    return EmployeeService.list_employees(db)


@router.post("/", response_model=schemas.EmployeeResponse)
def create_employee(
    data: schemas.EmployeeCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    return EmployeeService.create_employee(data, db)


@router.put("/{employee_id}", response_model=schemas.EmployeeResponse)
def update_employee(
    employee_id: int,
    data: schemas.EmployeeUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    return EmployeeService.update_employee(employee_id, data, db)


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    return EmployeeService.delete_employee(employee_id, current_user, db)


@router.get("/import-template")
def download_employee_template(
    _: models.User = Depends(auth.require_admin),
):
    return EmployeeService.download_template()


@router.post("/import", response_model=schemas.EmployeeImportResult)
def import_employees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_admin),
):
    contents = file.file.read()
    return EmployeeService.import_employees(contents, db)
