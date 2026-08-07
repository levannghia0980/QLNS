import inspect
from typing import Any, Dict, Optional

async def db_execute(db: Any, statement: Any, params: Optional[Dict[str, Any]] = None) -> Any:
    """
    Execute SQL statement seamlessly whether `db` is a synchronous SQLAlchemy Session
    or an AsyncSession.
    """
    if params is not None:
        res = db.execute(statement, params)
    else:
        res = db.execute(statement)

    if inspect.isawaitable(res):
        res = await res
    return res


async def db_commit(db: Any) -> None:
    """
    Commit transaction seamlessly whether `db` is a synchronous Session or AsyncSession.
    """
    res = db.commit()
    if inspect.isawaitable(res):
        await res
