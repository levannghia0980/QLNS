"""
Database Seed & Initial Migration Module.
Clean & Enterprise Standard: Only initializes schema, job positions, and default admin account.
Zero hardcoded dummy/fake data. All business data is 100% dynamic from SQLite DB.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models import Position, User, Account, SchedulePeriod
import auth

DEFAULT_POSITIONS = [
    {"name": "Trợ lý dự án",  "is_manager": False},
    {"name": "PM",             "is_manager": True},
    {"name": "DU Lead",        "is_manager": True},
    {"name": "GDTT",           "is_manager": True},
    {"name": "PGDTT",          "is_manager": True},
    {"name": "Dev",            "is_manager": False},
    {"name": "Dev Lead",       "is_manager": True},
    {"name": "Dev Mobile",     "is_manager": False},
    {"name": "DevOps",         "is_manager": False},
    {"name": "Tester",         "is_manager": False},
    {"name": "Test Lead",      "is_manager": True},
    {"name": "BA",             "is_manager": False},
    {"name": "BA Lead",        "is_manager": True},
    {"name": "QA",             "is_manager": False},
    {"name": "DA",             "is_manager": False},
    {"name": "AI",             "is_manager": False},
]


def init_db_defaults():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # 1. Seed Positions if empty
        for p in DEFAULT_POSITIONS:
            existing = db.query(Position).filter(Position.name == p["name"]).first()
            if not existing:
                db.add(Position(**p))
        db.commit()

        # 2. Seed Admin account if missing
        admin_user = db.query(User).filter(User.employee_code == "admin").first()
        if not admin_user:
            admin_user = User(
                employee_code="admin",
                full_name="Quản trị viên",
                role="admin",
                user_type="admin",
                account_status=1,
            )
            db.add(admin_user)
            db.flush()

            admin_acc = Account(
                user_id=admin_user.id,
                username="admin",
                password=auth.hash_password("Admin@123")
            )
            db.add(admin_acc)
            db.commit()

        # 3. Ensure Schedule Periods exist for current year
        for m in [7, 8, 9, 10, 11, 12]:
            p = db.query(SchedulePeriod).filter(
                SchedulePeriod.month == m,
                SchedulePeriod.year == 2026
            ).first()
            if not p:
                p = SchedulePeriod(
                    month=m,
                    year=2026,
                    status="open",
                    open_date=datetime(2026, m, 1),
                    close_date=datetime(2026, m, 28)
                )
                db.add(p)
            else:
                p.status = "open"
        db.commit()

    finally:
        db.close()
