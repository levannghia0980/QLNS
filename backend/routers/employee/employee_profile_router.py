from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth
from services.employee.employee_profile_service import EmployeeProfileService

router = APIRouter(tags=["Employee - Profile"])


@router.get("/users/me", response_model=schemas.UserResponse)
def get_user_me(current_user: models.User = Depends(auth.get_current_user)):
    return EmployeeProfileService.get_profile(current_user)


@router.put("/users/me", response_model=schemas.UserResponse)
def update_user_me(
    data: schemas.UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return EmployeeProfileService.update_profile(data, current_user, db)


@router.get("/employees/me", response_model=schemas.UserResponse)
def get_employee_me(current_user: models.User = Depends(auth.get_current_user)):
    return EmployeeProfileService.get_profile(current_user)


@router.put("/employees/me", response_model=schemas.UserResponse)
def update_employee_me(
    data: schemas.UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return EmployeeProfileService.update_profile(data, current_user, db)
