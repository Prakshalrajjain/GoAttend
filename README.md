# GeoAttend (GoAttend) 📍📸

Smart GPS-Based Attendance Management System with Dual-Proof Selfie Verification and Dynamic Geofencing.

---

## ✨ Features

- **📍 GPS Geofencing**: Server-side mathematical distance verification using the Haversine great-circle formula against configured office locations and custom allowed radii.
- **📸 Real Laptop Webcam Verification**:
  - Live laptop camera feed with a natural mirrored selfie viewfinder.
  - User-clicked selfie snapshot with audio-visual shutter flash and optional 3-second countdown timer.
  - Automated continuous live sensor stream frame capture for dual-photo verification engine.
  - Multi-camera device switching support (integrated webcam vs USB cameras) and native device fallback.
- **🛡️ Role-Based Access Control**:
  - **Employee Portal**: 1-click GPS detection, live map verification, selfie check-in, check-out, and personal attendance history.
  - **Admin & Authority Dashboard**: Real-time attendance log, geofence violations tracking, office location manager, analytics dashboard with Plotly charts, and CSV report export.
- **⚡ High Performance Stack**:
  - **Backend**: FastAPI (Python), PostgreSQL, Psycopg, PyJWT, Passlib (Argon2 / BCrypt).
  - **Frontend**: React 19, Vite, Plotly.js, Vanilla CSS design system with glassmorphism and dark mode.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL database

### 1. Database & Environment Setup
Configure your `.env` file in the project root:
```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=geoattend
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET_KEY=your_secure_random_jwt_secret
JWT_ALGORITHM=HS256
```

Apply database tables:
```bash
# Execute schema in PostgreSQL
psql -U your_db_user -d geoattend -f backend/schema.sql
```

### 2. Backend (FastAPI)
```bash
# Activate virtual environment
.venv\Scripts\activate   # On Windows
# source .venv/bin/activate # On Linux/macOS

# Install dependencies (if needed) and run
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive API Documentation (Swagger): `http://127.0.0.1:8000/docs`

### 3. Frontend (Vite + React)
```bash
cd frontend
npm install
npm run dev
```
- App UI: `http://localhost:5173`

---

## 🧪 Running Tests
```bash
pytest tests/
```