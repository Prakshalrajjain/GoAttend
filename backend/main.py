from fastapi import Depends
from backend.dependencies import get_current_employee
from fastapi import HTTPException
from backend.schemas import EmployeeLogin
from backend.security import verify_password
from backend.auth import create_access_token
from fastapi import HTTPException
from backend.database import get_connection
from backend.schemas import EmployeeRegister
from backend.security import hash_password
from backend.database import get_connection
from fastapi import HTTPException
from backend.database import get_connection
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="GeoAttend API",
    description="Backend API for GeoAttend attendance management.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "GeoAttend API is running",
        "version": "0.1.0",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "GeoAttend API",
    }
@app.get("/api/health/database")
def database_health():
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database()")
                database_name = cursor.fetchone()[0]

        return {
            "status": "connected",
            "database": database_name,
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        )

@app.get("/api/locations")
def get_locations():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, name, latitude, longitude,
                       allowed_radius_meters
                FROM office_locations
                WHERE is_active = TRUE
                ORDER BY id
            """)

            rows = cursor.fetchall()

    return [
        {
            "id": row[0],
            "name": row[1],
            "latitude": row[2],
            "longitude": row[3],
            "allowed_radius_meters": row[4],
        }
        for row in rows
    ]

@app.post("/api/auth/register", status_code=201)
def register_employee(employee: EmployeeRegister):
    password_hash = hash_password(employee.password)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO employees (full_name, email, password_hash)
                    VALUES (%s, %s, %s)
                    RETURNING id, full_name, email, role, created_at
                    """,
                    (
                        employee.full_name.strip(),
                        str(employee.email).lower(),
                        password_hash,
                    ),
                )

                row = cursor.fetchone()

        return {
            "id": row[0],
            "full_name": row[1],
            "email": row[2],
            "role": row[3],
            "created_at": row[4],
        }

    except Exception as error:
        if getattr(error, "sqlstate", None) == "23505":
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )
        raise

@app.post("/api/auth/login")
def login_employee(credentials: EmployeeLogin):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, full_name, email, password_hash, role
                FROM employees
                WHERE email = %s
                """,
                (str(credentials.email).lower(),),
            )
            employee = cursor.fetchone()

    if employee is None or not verify_password(
        credentials.password,
        employee[3],
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        employee_id=employee[0],
        role=employee[4],
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "employee": {
            "id": employee[0],
            "full_name": employee[1],
            "email": employee[2],
            "role": employee[4],
        },
    }

@app.get("/api/auth/me")
def get_my_account(
    employee: dict = Depends(get_current_employee),
):
    return {
        "message": "Authentication successful",
        "employee_id": employee["id"],
        "role": employee["role"],
    }
