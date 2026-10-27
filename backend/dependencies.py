
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt.exceptions import InvalidTokenError

from backend.auth import JWT_SECRET_KEY, JWT_ALGORITHM
from backend.database import get_connection

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_employee(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret is not configured",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        employee_id = payload.get("sub")
        role = payload.get("role")

        if employee_id is None or role not in ("employee", "admin"):
            raise InvalidTokenError("Invalid token payload")

        employee_id_int = int(employee_id)

    except (InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify employee exists in database
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, full_name, email, role, created_at
                FROM employees
                WHERE id = %s
                """,
                (employee_id_int,),
            )
            row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee not found or account deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "id": row[0],
        "full_name": row[1],
        "email": row[2],
        "role": row[3],
        "created_at": row[4],
    }


def require_admin(
    current_employee: dict = Depends(get_current_employee),
) -> dict:
    if current_employee.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required for this action",
        )
    return current_employee

