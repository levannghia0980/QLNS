from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Position(Base):
    """Bảng vị trí công việc"""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    is_manager = Column(Boolean, default=False)

    users = relationship("User", back_populates="position_rel")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    employee_code = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="user")           # admin / user
    user_type = Column(String, default="intern")    # intern / employee
    gender = Column(String, nullable=True)
    ethnicity = Column(String, nullable=True)
    viettel_email = Column(String, nullable=True)
    birthday = Column(Date, nullable=True)
    hometown = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    cccd = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    bank_account = Column(String, nullable=True)
    project = Column(String, nullable=True)
    position = Column(String, nullable=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    join_date = Column(Date, nullable=True)
    allowance = Column(String, default="Không")
    notes = Column(Text, nullable=True)
    employee_type = Column(String, default="TTS Trung tâm")
    working_status = Column(String, default="Working")
    employment_type = Column(String, default="Fulltime")

    # Employee-only fields
    direct_manager = Column(String, nullable=True)
    computer_serial = Column(String, nullable=True)
    employment_status = Column(String, default="Thử việc")
    use_company_mac = Column(String, default="Không")
    staff_category = Column(String, default="NS trung tâm")
    seat_position = Column(String, nullable=True)
    borrow_end_date = Column(Date, nullable=True)
    borrow_project = Column(String, nullable=True)
    borrow_pm = Column(String, nullable=True)
    borrow_center = Column(String, nullable=True)

    account_status = Column(Integer, default=1)
    created_at = Column(DateTime, default=func.now())

    schedules = relationship("Schedule", back_populates="user")
    account = relationship("Account", back_populates="user", uselist=False, cascade="all, delete-orphan")
    position_rel = relationship("Position", back_populates="users")
    overtime_requests = relationship("OvertimeRequest", back_populates="user", foreign_keys="OvertimeRequest.user_id")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    username = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="account")


class SchedulePeriod(Base):
    __tablename__ = "schedule_period"

    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    open_date = Column(DateTime, nullable=True)
    close_date = Column(DateTime, nullable=True)
    status = Column(String, default="closed")

    schedules = relationship("Schedule", back_populates="period")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    period_id = Column(Integer, ForeignKey("schedule_period.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    work_day = Column(Date, nullable=False)
    shift = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

    period = relationship("SchedulePeriod", back_populates="schedules")
    user = relationship("User", back_populates="schedules")


class OvertimeRequest(Base):
    """Bảng đăng ký OT của nhân sự Onsite"""
    __tablename__ = "overtime_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project = Column(String, nullable=True)
    work_date = Column(Date, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    raw_hours = Column(Float, nullable=False)
    factor = Column(Float, nullable=False)
    weighted_hours = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String, default="Pending")
    reject_reason = Column(Text, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="overtime_requests", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])
