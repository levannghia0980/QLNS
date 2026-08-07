"""
Root database_utils module forwarding to db.database_utils.
"""
from db.database_utils import db_execute, db_commit

__all__ = ["db_execute", "db_commit"]
