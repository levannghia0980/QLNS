from fastapi import HTTPException
from sqlalchemy.orm import Session
import models
import schemas


class EmployeeProfileService:
    @staticmethod
    def get_profile(current_user: models.User) -> models.User:
        return current_user

    @staticmethod
    def update_profile(data: schemas.UserUpdate, current_user: models.User, db: Session) -> models.User:
        # Allowed fields for employee self-update
        allowed = {
            "gender", "ethnicity", "viettel_email", "birthday", "hometown",
            "phone", "cccd", "bank_name", "bank_account"
        }
        for field, val in data.model_dump(exclude_unset=True).items():
            if field in allowed:
                setattr(current_user, field, val)

        db.commit()
        db.refresh(current_user)
        return current_user
