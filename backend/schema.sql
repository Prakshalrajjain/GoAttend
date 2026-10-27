
CREATE TABLE IF NOT EXISTS employees (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'employee'
        CHECK (role IN ('employee', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS office_locations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    allowed_radius_meters INTEGER NOT NULL DEFAULT 100
        CHECK (allowed_radius_meters > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    office_location_id BIGINT NOT NULL REFERENCES office_locations(id),
    check_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_out_at TIMESTAMPTZ,
    photo_url TEXT,
    live_frame_url TEXT,
    check_in_latitude DOUBLE PRECISION NOT NULL,
    check_in_longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'present'
        CHECK (status IN ('present', 'late', 'rejected')),
    CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

CREATE TABLE IF NOT EXISTS attendance_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attendance_id BIGINT REFERENCES attendance(id),
    actor_employee_id BIGINT REFERENCES employees(id),
    action VARCHAR(80) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee
    ON attendance(employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_check_in
    ON attendance(check_in_at);

CREATE INDEX IF NOT EXISTS idx_audit_attendance
    ON attendance_audit(attendance_id);
