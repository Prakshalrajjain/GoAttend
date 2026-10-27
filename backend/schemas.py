
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class EmployeeRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class EmployeeLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class EmployeeOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee: EmployeeOut


class OfficeLocationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    allowed_radius_meters: int = Field(default=100, gt=0, le=10000)
    is_active: bool = True


class OfficeLocationOut(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    allowed_radius_meters: int
    is_active: bool
    created_at: Optional[datetime] = None


class GeofenceVerificationRequest(BaseModel):
    office_location_id: int
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)


class GeofenceVerificationResponse(BaseModel):
    is_within_radius: bool
    distance_meters: float
    allowed_radius_meters: int
    office_name: str


class CheckInRequest(BaseModel):
    office_location_id: int
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    photo_data: Optional[str] = None  # Base64 data URL for clicked selfie
    live_frame_data: Optional[str] = None  # Base64 data URL for live stream video frame


class CheckOutRequest(BaseModel):
    attendance_id: Optional[int] = None
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    office_location_id: int
    office_name: Optional[str] = None
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    check_in_at: datetime
    check_out_at: Optional[datetime] = None
    photo_url: Optional[str] = None
    live_frame_url: Optional[str] = None
    check_in_latitude: float
    check_in_longitude: float
    status: str


