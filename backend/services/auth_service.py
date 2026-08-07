from fastapi import HTTPException
from sqlalchemy.orm import Session
import models
import schemas
import auth

class AuthService:
    @staticmethod
    def login(req: schemas.LoginRequest, db: Session) -> schemas.TokenResponse:
        account = db.query(models.Account).filter(models.Account.username == req.username).first()
        if not account or not auth.verify_password(req.password, account.password):
            raise HTTPException(status_code=401, detail="Sai tài khoản hoặc mật khẩu")
        user = account.user
        if user.account_status == 0:
            raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")
        token = auth.create_access_token({"sub": str(user.id)})
        return schemas.TokenResponse(
            access_token=token,
            token_type="bearer",
            role=user.role,
            user_type=user.user_type or "intern",
            full_name=user.full_name,
            user_id=user.id,
        )

    @staticmethod
    def change_password(req: schemas.ChangePasswordRequest, current_user: models.User, db: Session) -> dict:
        account = current_user.account
        if not account or not auth.verify_password(req.old_password, account.password):
            raise HTTPException(status_code=400, detail="Mật khẩu cũ không đúng")
        account.password = auth.hash_password(req.new_password)
        db.commit()
        return {"message": "Đổi mật khẩu thành công"}
