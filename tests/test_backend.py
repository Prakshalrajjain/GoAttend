import base64
import os
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.geofence import haversine_distance_meters, verify_location

client = TestClient(app)


def test_haversine_math():
    # Identical points should have 0 distance
    dist_zero = haversine_distance_meters(23.2599, 77.4126, 23.2599, 77.4126)
    assert dist_zero == 0.0

    # Slight shift (approx 50-70 meters)
    dist_near = haversine_distance_meters(23.2599, 77.4126, 23.2604, 77.4126)
    assert 40 <= dist_near <= 80

    # Far away (e.g. 1 degree latitude is ~111 km)
    dist_far = haversine_distance_meters(23.2599, 77.4126, 24.2599, 77.4126)
    assert dist_far > 100000

    # Geofence verification
    is_in, d = verify_location(23.2599, 77.4126, 23.2599, 77.4126, 100)
    assert is_in is True
    assert d == 0.0

    is_out, d2 = verify_location(23.2599, 77.4126, 24.2599, 77.4126, 100)
    assert is_out is False


def test_health_endpoints():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    res_db = client.get("/api/health/database")
    assert res_db.status_code == 200
    assert res_db.json()["status"] == "connected"


def test_get_locations():
    res = client.get("/api/locations")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) >= 1
    first = res.json()[0]
    assert "name" in first
    assert "latitude" in first
    assert "longitude" in first
    assert "allowed_radius_meters" in first


def test_auth_me_requires_token():
    res = client.get("/api/auth/me")
    assert res.status_code in (401, 403)


def test_registration_and_login_flow():
    import uuid
    unique_email = f"aniket_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "full_name": "Aniket Deshmukh",
        "email": unique_email,
        "password": "Password123!",
    }

    # 1. Register new user
    res_reg = client.post("/api/auth/register", json=payload)
    assert res_reg.status_code == 201
    data_reg = res_reg.json()
    assert data_reg["email"] == unique_email
    assert data_reg["role"] == "employee"

    # 2. Duplicate registration should fail with 409
    res_dup = client.post("/api/auth/register", json=payload)
    assert res_dup.status_code == 409

    # 3. Login with wrong password should fail with 401
    res_bad = client.post("/api/auth/login", json={"email": unique_email, "password": "WrongPassword!"})
    assert res_bad.status_code == 401

    # 4. Login with correct password should succeed
    res_login = client.post("/api/auth/login", json={"email": unique_email, "password": "Password123!"})
    assert res_login.status_code == 200
    token_data = res_login.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # 5. Access /api/auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200
    me = res_me.json()
    assert me["email"] == unique_email
    assert me["role"] == "employee"

    # 6. Verify geofence check endpoint
    locs = client.get("/api/locations").json()
    first_loc = locs[0]
    loc_id = first_loc["id"]

    res_geo = client.post(
        "/api/attendance/verify-location",
        headers=headers,
        json={
            "office_location_id": loc_id,
            "latitude": first_loc["latitude"],
            "longitude": first_loc["longitude"],
        },
    )
    assert res_geo.status_code == 200
    geo_data = res_geo.json()
    assert geo_data["is_within_radius"] is True
    assert geo_data["distance_meters"] <= 1.0

    # 7. Check-in rejection when far away
    dummy_photo = "data:image/jpeg;base64," + base64.b64encode(b"fake-image-bytes").decode("utf-8")
    res_bad_checkin = client.post(
        "/api/attendance/check-in",
        headers=headers,
        json={
            "office_location_id": loc_id,
            "latitude": first_loc["latitude"] + 1.0,  # ~111km away
            "longitude": first_loc["longitude"] + 1.0,
            "photo_data": dummy_photo,
        },
    )
    assert res_bad_checkin.status_code == 403
    assert "Check-in rejected" in res_bad_checkin.json()["detail"]

    # 8. Check-in success when at office location
    res_good_checkin = client.post(
        "/api/attendance/check-in",
        headers=headers,
        json={
            "office_location_id": loc_id,
            "latitude": first_loc["latitude"],
            "longitude": first_loc["longitude"],
            "photo_data": dummy_photo,
        },
    )
    assert res_good_checkin.status_code == 200
    att_data = res_good_checkin.json()
    assert att_data["status"] == "present"
    assert att_data["check_out_at"] is None

    # 9. Duplicate check-in while already checked in should fail with 400
    res_dup_checkin = client.post(
        "/api/attendance/check-in",
        headers=headers,
        json={
            "office_location_id": loc_id,
            "latitude": first_loc["latitude"],
            "longitude": first_loc["longitude"],
            "photo_data": dummy_photo,
        },
    )
    assert res_dup_checkin.status_code == 400

    # 10. Today's attendance should report checked in
    res_today = client.get("/api/attendance/today", headers=headers)
    assert res_today.status_code == 200
    assert res_today.json()["has_checked_in"] is True
    assert res_today.json()["is_checked_out"] is False

    # 11. Check out
    res_checkout = client.post(
        "/api/attendance/check-out",
        headers=headers,
        json={"latitude": first_loc["latitude"], "longitude": first_loc["longitude"]},
    )
    assert res_checkout.status_code == 200
    assert res_checkout.json()["check_out_at"] is not None

    # 12. Check out again should fail
    res_bad_checkout = client.post(
        "/api/attendance/check-out",
        headers=headers,
        json={},
    )
    assert res_bad_checkout.status_code == 400

    # 13. My history
    res_hist = client.get("/api/attendance/my-history", headers=headers)
    assert res_hist.status_code == 200
    assert len(res_hist.json()) >= 1

    # 14. Attendance summary
    res_summary = client.get("/api/attendance/summary", headers=headers)
    assert res_summary.status_code == 200
    assert "total_sessions" in res_summary.json()


def test_admin_authorization_and_features():
    import uuid

    # 1. An ordinary employee attempting admin endpoints should get 403 Forbidden
    emp_email = f"pooja_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/auth/register", json={"full_name": "Pooja Sharma", "email": emp_email, "password": "Password123!"})
    login_emp = client.post("/api/auth/login", json={"email": emp_email, "password": "Password123!"}).json()
    emp_headers = {"Authorization": f"Bearer {login_emp['access_token']}"}

    res_forbidden_analytics = client.get("/api/admin/analytics", headers=emp_headers)
    assert res_forbidden_analytics.status_code == 403

    res_forbidden_create = client.post(
        "/api/locations",
        headers=emp_headers,
        json={"name": "Forbidden Office", "latitude": 28.6139, "longitude": 77.2090, "allowed_radius_meters": 100},
    )
    assert res_forbidden_create.status_code == 403

    # 2. Setup an admin (using setup-admin or promoting user)
    admin_email = f"rajesh_{uuid.uuid4().hex[:6]}@example.com"
    # Call setup-admin (or direct DB update)
    res_admin_setup = client.post(
        "/api/auth/setup-admin",
        json={"full_name": "Rajesh Patel", "email": admin_email, "password": "AdminPassword123!"},
    )
    if res_admin_setup.status_code != 200:
        # If admin already exists, promote this user directly via SQL in a test context
        from backend.database import get_connection
        client.post("/api/auth/register", json={"full_name": "Rajesh Patel", "email": admin_email, "password": "AdminPassword123!"})
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE employees SET role = 'admin' WHERE email = %s", (admin_email,))

    login_admin = client.post("/api/auth/login", json={"email": admin_email, "password": "AdminPassword123!"}).json()
    admin_headers = {"Authorization": f"Bearer {login_admin['access_token']}"}

    # 3. Admin can access analytics
    res_analytics = client.get("/api/admin/analytics", headers=admin_headers)
    assert res_analytics.status_code == 200
    analytics_data = res_analytics.json()
    assert "overview" in analytics_data
    assert "daily_trend" in analytics_data

    # 4. Admin can list all employees
    res_employees = client.get("/api/admin/employees", headers=admin_headers)
    assert res_employees.status_code == 200
    assert len(res_employees.json()) >= 1

    # 5. Admin can create an office location
    new_office_payload = {
        "name": f"New Test Lab {uuid.uuid4().hex[:4]}",
        "latitude": 23.2500,
        "longitude": 77.4100,
        "allowed_radius_meters": 150,
        "is_active": True,
    }
    res_new_office = client.post("/api/locations", headers=admin_headers, json=new_office_payload)
    assert res_new_office.status_code == 201
    created_office_id = res_new_office.json()["id"]

    # 6. Admin can update the office location
    update_payload = {
        "name": "Updated Test Lab",
        "latitude": 23.2500,
        "longitude": 77.4100,
        "allowed_radius_meters": 200,
        "is_active": True,
    }
    res_update_office = client.put(f"/api/locations/{created_office_id}", headers=admin_headers, json=update_payload)
    assert res_update_office.status_code == 200
    assert res_update_office.json()["allowed_radius_meters"] == 200

    # 7. Admin can deactivate the office
    res_deact = client.delete(f"/api/locations/{created_office_id}", headers=admin_headers)
    assert res_deact.status_code == 200

    # 8. Admin can export CSV
    res_csv = client.get("/api/admin/export", headers=admin_headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "Record ID" in res_csv.text

