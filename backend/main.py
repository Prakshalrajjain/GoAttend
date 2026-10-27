import csv
import io
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.auth import create_access_token
from backend.database import get_connection
from backend.dependencies import get_current_employee, require_admin
from backend.schemas import (
    AttendanceOut,
    AttendanceStatusUpdate,
    CheckInRequest,
    CheckOutRequest,
    EmployeeLogin,
    EmployeeOut,
    EmployeeRegister,
    GeofenceVerificationRequest,
    GeofenceVerificationResponse,
    OfficeLocationCreate,
    OfficeLocationOut,
    TokenResponse,
)
from backend.security import hash_password, verify_password
from backend.services.geofence import haversine_distance_meters, verify_location
from backend.services.storage import LOCAL_PHOTOS_DIR, save_attendance_photo

app = FastAPI(
    title="GeoAttend API",
    description="Backend API for GeoAttend GPS-based smart attendance management system.",
    version="1.0.0",
)

# Enable CORS for local development frontend & mobile devices on local network
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local photos storage
app.mount("/storage/photos", StaticFiles(directory=str(LOCAL_PHOTOS_DIR)), name="photos")


# ---------------------------------------------------------
# Health Endpoints
# ---------------------------------------------------------
@app.get("/")
def home():
    return {
        "message": "GeoAttend API is running",
        "version": "1.0.0",
        "status": "healthy",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "GeoAttend API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed",
        )


# ---------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------
@app.post("/api/auth/register", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def register_employee(employee: EmployeeRegister):
    full_name = employee.full_name.strip()
    email = str(employee.email).lower().strip()
    password_hash = hash_password(employee.password)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO employees (full_name, email, password_hash, role)
                    VALUES (%s, %s, %s, 'employee')
                    RETURNING id, full_name, email, role, created_at
                    """,
                    (full_name, email, password_hash),
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
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later.",
        )


@app.post("/api/auth/login", response_model=TokenResponse)
def login_employee(credentials: EmployeeLogin):
    email = str(credentials.email).lower().strip()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, full_name, email, password_hash, role, created_at
                FROM employees
                WHERE email = %s
                """,
                (email,),
            )
            employee = cursor.fetchone()

    if employee is None or not verify_password(credentials.password, employee[3]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
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
            "created_at": employee[5],
        },
    }


@app.get("/api/auth/me", response_model=EmployeeOut)
def get_my_account(
    current_employee: dict = Depends(get_current_employee),
):
    return current_employee


@app.post("/api/auth/setup-admin", response_model=EmployeeOut)
def setup_first_admin(admin_data: EmployeeRegister):
    """
    Safely creates the first administrator if no admin account exists in the system.
    """
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM employees WHERE role = 'admin'")
            admin_count = cursor.fetchone()[0]

            if admin_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="An administrator already exists. Please ask the administrator to promote your account.",
                )

            password_hash = hash_password(admin_data.password)
            try:
                cursor.execute(
                    """
                    INSERT INTO employees (full_name, email, password_hash, role)
                    VALUES (%s, %s, %s, 'admin')
                    RETURNING id, full_name, email, role, created_at
                    """,
                    (admin_data.full_name.strip(), str(admin_data.email).lower().strip(), password_hash),
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
                    # If this email already exists, promote them to admin since no other admin exists
                    cursor.execute(
                        """
                        UPDATE employees
                        SET role = 'admin', password_hash = %s
                        WHERE email = %s
                        RETURNING id, full_name, email, role, created_at
                        """,
                        (password_hash, str(admin_data.email).lower().strip()),
                    )
                    row = cursor.fetchone()
                    return {
                        "id": row[0],
                        "full_name": row[1],
                        "email": row[2],
                        "role": row[3],
                        "created_at": row[4],
                    }
                raise


# ---------------------------------------------------------
# Office Locations Endpoints
# ---------------------------------------------------------
@app.get("/api/locations", response_model=list[OfficeLocationOut])
def get_locations():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, latitude, longitude, allowed_radius_meters, is_active, created_at
                FROM office_locations
                WHERE is_active = TRUE
                ORDER BY name ASC
                """
            )
            rows = cursor.fetchall()

    return [
        {
            "id": row[0],
            "name": row[1],
            "latitude": row[2],
            "longitude": row[3],
            "allowed_radius_meters": row[4],
            "is_active": row[5],
            "created_at": row[6],
        }
        for row in rows
    ]


@app.post("/api/locations", response_model=OfficeLocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    location: OfficeLocationCreate,
    current_admin: dict = Depends(require_admin),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO office_locations (name, latitude, longitude, allowed_radius_meters, is_active)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, latitude, longitude, allowed_radius_meters, is_active, created_at
                """,
                (
                    location.name.strip(),
                    location.latitude,
                    location.longitude,
                    location.allowed_radius_meters,
                    location.is_active,
                ),
            )
            row = cursor.fetchone()

    return {
        "id": row[0],
        "name": row[1],
        "latitude": row[2],
        "longitude": row[3],
        "allowed_radius_meters": row[4],
        "is_active": row[5],
        "created_at": row[6],
    }


@app.put("/api/locations/{location_id}", response_model=OfficeLocationOut)
def update_location(
    location_id: int,
    location: OfficeLocationCreate,
    current_admin: dict = Depends(require_admin),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE office_locations
                SET name = %s, latitude = %s, longitude = %s, allowed_radius_meters = %s, is_active = %s
                WHERE id = %s
                RETURNING id, name, latitude, longitude, allowed_radius_meters, is_active, created_at
                """,
                (
                    location.name.strip(),
                    location.latitude,
                    location.longitude,
                    location.allowed_radius_meters,
                    location.is_active,
                    location_id,
                ),
            )
            row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Office location not found",
        )

    return {
        "id": row[0],
        "name": row[1],
        "latitude": row[2],
        "longitude": row[3],
        "allowed_radius_meters": row[4],
        "is_active": row[5],
        "created_at": row[6],
    }


@app.delete("/api/locations/{location_id}")
def delete_location(
    location_id: int,
    current_admin: dict = Depends(require_admin),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            # Soft delete by deactivating
            cursor.execute(
                """
                UPDATE office_locations
                SET is_active = FALSE
                WHERE id = %s
                RETURNING id
                """,
                (location_id,),
            )
            row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Office location not found",
        )

    return {"message": "Office location deactivated successfully"}


# ---------------------------------------------------------
# Geofence Distance Verification Helper
# ---------------------------------------------------------
@app.post("/api/attendance/verify-location", response_model=GeofenceVerificationResponse)
def verify_geofence(
    req: GeofenceVerificationRequest,
    current_employee: dict = Depends(get_current_employee),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, latitude, longitude, allowed_radius_meters
                FROM office_locations
                WHERE id = %s AND is_active = TRUE
                """,
                (req.office_location_id,),
            )
            office = cursor.fetchone()

    if not office:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Office location not found or inactive",
        )

    office_name = office[1]
    office_lat = office[2]
    office_lon = office[3]
    allowed_radius = office[4]

    is_within, dist = verify_location(
        req.latitude, req.longitude, office_lat, office_lon, allowed_radius
    )

    return {
        "is_within_radius": is_within,
        "distance_meters": dist,
        "allowed_radius_meters": allowed_radius,
        "office_name": office_name,
    }


# ---------------------------------------------------------
# Attendance Check-in / Check-out Endpoints
# ---------------------------------------------------------
@app.post("/api/attendance/check-in", response_model=AttendanceOut)
def check_in(
    req: CheckInRequest,
    current_employee: dict = Depends(get_current_employee),
):
    employee_id = current_employee["id"]

    # 1. Fetch authorized office location
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, latitude, longitude, allowed_radius_meters
                FROM office_locations
                WHERE id = %s AND is_active = TRUE
                """,
                (req.office_location_id,),
            )
            office = cursor.fetchone()

            if not office:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Office location is not found or is currently inactive",
                )

            office_name = office[1]
            office_lat = office[2]
            office_lon = office[3]
            allowed_radius = office[4]

            # 2. Check for active check-in (uncompleted checkout today)
            cursor.execute(
                """
                SELECT id, check_in_at
                FROM attendance
                WHERE employee_id = %s
                  AND check_out_at IS NULL
                  AND check_in_at::date = CURRENT_DATE
                ORDER BY check_in_at DESC
                LIMIT 1
                """,
                (employee_id,),
            )
            active_checkin = cursor.fetchone()
            if active_checkin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already checked in. Please check out first before creating a new check-in.",
                )

            # 3. Server-side GPS Geofence verification
            is_valid_location, distance_m = verify_location(
                req.latitude, req.longitude, office_lat, office_lon, allowed_radius
            )

            if not is_valid_location:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Check-in rejected: You are {distance_m}m away from {office_name}. Allowed radius is {allowed_radius}m.",
                )

            # 4. Process Photo Evidence (Dual Frame Verification)
            photo_url = None
            if req.photo_data:
                try:
                    photo_url = save_attendance_photo(req.photo_data, employee_id, tag="selfie")
                except Exception as photo_err:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to process verification selfie: {str(photo_err)}",
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Live selfie photo verification is required for check-in.",
                )

            # Automated live camera video stream frame
            live_frame_url = None
            if req.live_frame_data:
                try:
                    live_frame_url = save_attendance_photo(req.live_frame_data, employee_id, tag="liveframe")
                except Exception:
                    live_frame_url = photo_url
            else:
                live_frame_url = photo_url

            # 5. Determine status (e.g. 'present' or 'late')
            attendance_status = "present"

            # 6. Insert attendance record with dual verification frames
            cursor.execute(
                """
                INSERT INTO attendance (
                    employee_id, office_location_id, check_in_at, photo_url, live_frame_url,
                    check_in_latitude, check_in_longitude, status
                )
                VALUES (%s, %s, CURRENT_TIMESTAMP, %s, %s, %s, %s, %s)
                RETURNING id, employee_id, office_location_id, check_in_at, check_out_at,
                          photo_url, live_frame_url, check_in_latitude, check_in_longitude, status
                """,
                (
                    employee_id,
                    req.office_location_id,
                    photo_url,
                    live_frame_url,
                    req.latitude,
                    req.longitude,
                    attendance_status,
                ),
            )
            att_row = cursor.fetchone()
            attendance_id = att_row[0]

            # 7. Record in attendance_audit
            audit_details = json.dumps(
                {
                    "office_location_id": req.office_location_id,
                    "office_name": office_name,
                    "latitude": req.latitude,
                    "longitude": req.longitude,
                    "distance_meters": distance_m,
                    "photo_url": photo_url,
                    "live_frame_url": live_frame_url,
                    "status": attendance_status,
                }
            )
            cursor.execute(
                """
                INSERT INTO attendance_audit (attendance_id, actor_employee_id, action, details)
                VALUES (%s, %s, 'CHECK_IN', %s::jsonb)
                """,
                (attendance_id, employee_id, audit_details),
            )

    return {
        "id": att_row[0],
        "employee_id": att_row[1],
        "office_location_id": att_row[2],
        "office_name": office_name,
        "employee_name": current_employee["full_name"],
        "employee_email": current_employee["email"],
        "check_in_at": att_row[3],
        "check_out_at": att_row[4],
        "photo_url": att_row[5],
        "live_frame_url": att_row[6],
        "check_in_latitude": att_row[7],
        "check_in_longitude": att_row[8],
        "status": att_row[9],
    }


@app.post("/api/attendance/check-out", response_model=AttendanceOut)
def check_out(
    req: CheckOutRequest,
    current_employee: dict = Depends(get_current_employee),
):
    employee_id = current_employee["id"]

    with get_connection() as connection:
        with connection.cursor() as cursor:
            # Find the active check-in
            if req.attendance_id:
                cursor.execute(
                    """
                    SELECT a.id, a.employee_id, a.office_location_id, a.check_in_at, a.check_out_at,
                           a.photo_url, a.live_frame_url, a.check_in_latitude, a.check_in_longitude, a.status,
                           o.name AS office_name
                    FROM attendance a
                    JOIN office_locations o ON a.office_location_id = o.id
                    WHERE a.id = %s AND a.employee_id = %s
                    """,
                    (req.attendance_id, employee_id),
                )
            else:
                cursor.execute(
                    """
                    SELECT a.id, a.employee_id, a.office_location_id, a.check_in_at, a.check_out_at,
                           a.photo_url, a.live_frame_url, a.check_in_latitude, a.check_in_longitude, a.status,
                           o.name AS office_name
                    FROM attendance a
                    JOIN office_locations o ON a.office_location_id = o.id
                    WHERE a.employee_id = %s AND a.check_out_at IS NULL
                    ORDER BY a.check_in_at DESC
                    LIMIT 1
                    """,
                    (employee_id,),
                )

            record = cursor.fetchone()

            if not record:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active check-in found to check out from.",
                )

            if record[4] is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This attendance session has already been checked out.",
                )

            attendance_id = record[0]
            office_name = record[10]

            # Update check-out timestamp
            cursor.execute(
                """
                UPDATE attendance
                SET check_out_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING check_out_at
                """,
                (attendance_id,),
            )
            check_out_at = cursor.fetchone()[0]

            # Record audit entry
            audit_details = json.dumps(
                {
                    "check_out_at": check_out_at.isoformat(),
                    "latitude": req.latitude,
                    "longitude": req.longitude,
                }
            )
            cursor.execute(
                """
                INSERT INTO attendance_audit (attendance_id, actor_employee_id, action, details)
                VALUES (%s, %s, 'CHECK_OUT', %s::jsonb)
                """,
                (attendance_id, employee_id, audit_details),
            )

    return {
        "id": record[0],
        "employee_id": record[1],
        "office_location_id": record[2],
        "office_name": office_name,
        "employee_name": current_employee["full_name"],
        "employee_email": current_employee["email"],
        "check_in_at": record[3],
        "check_out_at": check_out_at,
        "photo_url": record[5],
        "live_frame_url": record[6],
        "check_in_latitude": record[7],
        "check_in_longitude": record[8],
        "status": record[9],
    }


@app.get("/api/attendance/today")
def get_today_attendance(
    current_employee: dict = Depends(get_current_employee),
):
    employee_id = current_employee["id"]

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT a.id, a.employee_id, a.office_location_id, a.check_in_at, a.check_out_at,
                       a.photo_url, a.live_frame_url, a.check_in_latitude, a.check_in_longitude, a.status,
                       o.name AS office_name
                FROM attendance a
                JOIN office_locations o ON a.office_location_id = o.id
                WHERE a.employee_id = %s
                  AND a.check_in_at::date = CURRENT_DATE
                ORDER BY a.check_in_at DESC
                LIMIT 1
                """,
                (employee_id,),
            )
            row = cursor.fetchone()

    if not row:
        return {"has_checked_in": False, "record": None}

    return {
        "has_checked_in": True,
        "is_checked_out": row[4] is not None,
        "record": {
            "id": row[0],
            "employee_id": row[1],
            "office_location_id": row[2],
            "check_in_at": row[3],
            "check_out_at": row[4],
            "photo_url": row[5],
            "live_frame_url": row[6],
            "check_in_latitude": row[7],
            "check_in_longitude": row[8],
            "status": row[9],
            "office_name": row[10],
        },
    }


@app.get("/api/attendance/my-history", response_model=list[AttendanceOut])
def get_my_history(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_employee: dict = Depends(get_current_employee),
):
    employee_id = current_employee["id"]
    query = """
        SELECT a.id, a.employee_id, a.office_location_id, a.check_in_at, a.check_out_at,
               a.photo_url, a.live_frame_url, a.check_in_latitude, a.check_in_longitude, a.status,
               o.name AS office_name, e.full_name AS employee_name, e.email AS employee_email
        FROM attendance a
        JOIN office_locations o ON a.office_location_id = o.id
        JOIN employees e ON a.employee_id = e.id
        WHERE a.employee_id = %s
    """
    params = [employee_id]

    if start_date:
        query += " AND a.check_in_at::date >= %s"
        params.append(start_date)
    if end_date:
        query += " AND a.check_in_at::date <= %s"
        params.append(end_date)

    query += " ORDER BY a.check_in_at DESC"

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

    return [
        {
            "id": r[0],
            "employee_id": r[1],
            "office_location_id": r[2],
            "check_in_at": r[3],
            "check_out_at": r[4],
            "photo_url": r[5],
            "live_frame_url": r[6],
            "check_in_latitude": r[7],
            "check_in_longitude": r[8],
            "status": r[9],
            "office_name": r[10],
            "employee_name": r[11],
            "employee_email": r[12],
        }
        for r in rows
    ]


@app.get("/api/attendance/summary")
def get_attendance_summary(
    current_employee: dict = Depends(get_current_employee),
):
    employee_id = current_employee["id"]

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_sessions,
                    COUNT(CASE WHEN status = 'present' THEN 1 END) AS present_count,
                    COUNT(CASE WHEN status = 'late' THEN 1 END) AS late_count,
                    COUNT(CASE WHEN check_out_at IS NOT NULL THEN 1 END) AS completed_sessions
                FROM attendance
                WHERE employee_id = %s
                """,
                (employee_id,),
            )
            row = cursor.fetchone()

    return {
        "total_sessions": row[0] or 0,
        "present_count": row[1] or 0,
        "late_count": row[2] or 0,
        "completed_sessions": row[3] or 0,
    }


# ---------------------------------------------------------
# Administrator Endpoints
# ---------------------------------------------------------
@app.get("/api/admin/employees", response_model=list[EmployeeOut])
def get_all_employees(
    current_admin: dict = Depends(require_admin),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, full_name, email, role, created_at
                FROM employees
                ORDER BY id ASC
                """
            )
            rows = cursor.fetchall()

    return [
        {
            "id": r[0],
            "full_name": r[1],
            "email": r[2],
            "role": r[3],
            "created_at": r[4],
        }
        for r in rows
    ]


@app.put("/api/admin/employees/{employee_id}/role")
def update_employee_role(
    employee_id: int,
    role: str = Query(..., pattern="^(employee|admin)$"),
    current_admin: dict = Depends(require_admin),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE employees
                SET role = %s
                WHERE id = %s
                RETURNING id, full_name, role
                """,
                (role, employee_id),
            )
            row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    return {
        "message": f"Updated role for {row[1]} to {row[2]}",
        "employee_id": row[0],
        "role": row[2],
    }


@app.get("/api/admin/attendance", response_model=list[AttendanceOut])
def get_all_attendance(
    employee_id: Optional[int] = None,
    office_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_admin: dict = Depends(require_admin),
):
    query = """
        SELECT a.id, a.employee_id, a.office_location_id, a.check_in_at, a.check_out_at,
               a.photo_url, a.live_frame_url, a.check_in_latitude, a.check_in_longitude, a.status,
               o.name AS office_name, e.full_name AS employee_name, e.email AS employee_email
        FROM attendance a
        JOIN office_locations o ON a.office_location_id = o.id
        JOIN employees e ON a.employee_id = e.id
        WHERE 1 = 1
    """
    params = []

    if employee_id:
        query += " AND a.employee_id = %s"
        params.append(employee_id)
    if office_id:
        query += " AND a.office_location_id = %s"
        params.append(office_id)
    if status_filter:
        query += " AND a.status = %s"
        params.append(status_filter)
    if start_date:
        query += " AND a.check_in_at::date >= %s"
        params.append(start_date)
    if end_date:
        query += " AND a.check_in_at::date <= %s"
        params.append(end_date)

    query += " ORDER BY a.check_in_at DESC LIMIT 500"

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

    return [
        {
            "id": r[0],
            "employee_id": r[1],
            "office_location_id": r[2],
            "check_in_at": r[3],
            "check_out_at": r[4],
            "photo_url": r[5],
            "live_frame_url": r[6],
            "check_in_latitude": r[7],
            "check_in_longitude": r[8],
            "status": r[9],
            "office_name": r[10],
            "employee_name": r[11],
            "employee_email": r[12],
        }
        for r in rows
    ]


@app.put("/api/admin/attendance/{attendance_id}/status")
def update_attendance_status_endpoint(
    attendance_id: int,
    status_update: Optional[AttendanceStatusUpdate] = None,
    new_status_param: Optional[str] = Query(None, alias="status", pattern=r"^(present|late|rejected)$"),
    current_admin: dict = Depends(require_admin),
):
    new_status = status_update.status if status_update else new_status_param
    if not new_status or new_status not in ("present", "late", "rejected"):
        raise HTTPException(
            status_code=400,
            detail="Status must be one of: 'present', 'late', 'rejected'",
        )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            # Check if attendance record exists
            cursor.execute(
                """
                SELECT a.id, a.employee_id, a.status, e.full_name
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id
                WHERE a.id = %s
                """,
                (attendance_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"Attendance record #{attendance_id} not found.",
                )

            old_status = row[2]
            employee_name = row[3]

            # Update attendance status
            cursor.execute(
                """
                UPDATE attendance
                SET status = %s
                WHERE id = %s
                RETURNING id, status
                """,
                (new_status, attendance_id),
            )

            # Insert audit record
            audit_details = json.dumps({
                "previous_status": old_status,
                "new_status": new_status,
                "changed_by": current_admin["email"],
                "changed_at": datetime.now(timezone.utc).isoformat(),
            })
            cursor.execute(
                """
                INSERT INTO attendance_audit (attendance_id, actor_employee_id, action, details)
                VALUES (%s, %s, 'STATUS_UPDATE', %s::jsonb)
                """,
                (attendance_id, current_admin["id"], audit_details),
            )

    return {
        "message": f"Attendance status for {employee_name} updated from '{old_status}' to '{new_status}'",
        "attendance_id": attendance_id,
        "previous_status": old_status,
        "status": new_status,
    }


@app.get("/api/admin/analytics")
def get_attendance_analytics(
    current_admin: dict = Depends(require_admin),
):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            # 1. Total counts
            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_records,
                    COUNT(CASE WHEN status = 'present' THEN 1 END) AS present_count,
                    COUNT(CASE WHEN status = 'late' THEN 1 END) AS late_count,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_count,
                    COUNT(DISTINCT employee_id) AS unique_employees_attended
                FROM attendance
                """
            )
            overview = cursor.fetchone()

            # 2. Daily attendance trend for last 14 days
            cursor.execute(
                """
                SELECT check_in_at::date AS att_date, COUNT(*) AS count
                FROM attendance
                WHERE check_in_at >= CURRENT_DATE - INTERVAL '14 days'
                GROUP BY check_in_at::date
                ORDER BY check_in_at::date ASC
                """
            )
            daily_trend = [{"date": str(r[0]), "count": r[1]} for r in cursor.fetchall()]

            # 3. Attendance per office location
            cursor.execute(
                """
                SELECT o.name, COUNT(a.id)
                FROM office_locations o
                LEFT JOIN attendance a ON o.id = a.office_location_id
                GROUP BY o.id, o.name
                ORDER BY count DESC
                """
            )
            office_breakdown = [{"office": r[0], "count": r[1]} for r in cursor.fetchall()]

    return {
        "overview": {
            "total_records": overview[0] or 0,
            "present_count": overview[1] or 0,
            "late_count": overview[2] or 0,
            "rejected_count": overview[3] or 0,
            "unique_employees": overview[4] or 0,
        },
        "daily_trend": daily_trend,
        "office_breakdown": office_breakdown,
    }


@app.get("/api/admin/export")
def export_attendance_csv(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    office_id: Optional[int] = None,
    current_admin: dict = Depends(require_admin),
):
    query = """
        SELECT a.id, e.full_name, e.email, o.name AS office_name,
               a.check_in_at, a.check_out_at, a.status,
               a.check_in_latitude, a.check_in_longitude, a.photo_url
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        JOIN office_locations o ON a.office_location_id = o.id
        WHERE 1 = 1
    """
    params = []
    if office_id:
        query += " AND a.office_location_id = %s"
        params.append(office_id)
    if start_date:
        query += " AND a.check_in_at::date >= %s"
        params.append(start_date)
    if end_date:
        query += " AND a.check_in_at::date <= %s"
        params.append(end_date)

    query += " ORDER BY a.check_in_at DESC"

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Record ID",
        "Employee Name",
        "Employee Email",
        "Office Location",
        "Check-In Time",
        "Check-Out Time",
        "Status",
        "Latitude",
        "Longitude",
        "Photo URL",
    ])

    for row in rows:
        writer.writerow([
            row[0],
            row[1],
            row[2],
            row[3],
            row[4].isoformat() if row[4] else "",
            row[5].isoformat() if row[5] else "",
            row[6],
            row[7],
            row[8],
            row[9] or "",
        ])

    csv_data = output.getvalue()
    filename = f"geoattend_export_{date.today().isoformat()}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
