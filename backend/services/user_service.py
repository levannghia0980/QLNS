from sqlalchemy.orm import Session
import models
import schemas

class UserService:
    @staticmethod
    def get_profile(current_user: models.User) -> models.User:
        return current_user

    @staticmethod
    def update_profile(data: schemas.UserUpdate, current_user: models.User, db: Session) -> models.User:
        allowed = [
            "gender", "ethnicity", "birthday", "hometown", "phone", "cccd",
            "bank_name", "bank_account", "viettel_email", "employment_type"
        ]
        for field in allowed:
            val = getattr(data, field, None)
            if val is not None:
                setattr(current_user, field, val)
        db.commit()
        db.refresh(current_user)
        return current_user
