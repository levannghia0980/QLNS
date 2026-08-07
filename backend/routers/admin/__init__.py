"""
Admin routers package.
"""
from .admin_employees_router import router as admin_employees_router
from .admin_overtime_router import router as admin_overtime_router

__all__ = ["admin_employees_router", "admin_overtime_router"]
