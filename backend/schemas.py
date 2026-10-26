
from pydantic import BaseModel, EmailStr, Field


class EmployeeRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    
class EmployeeLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
