-- Migration: 004_audit_logs
-- Tracks who did what and when for every mutating action in the system.
-- Written for MySQL (no PostgreSQL UUID/JSONB/TIMESTAMP WITH TIME ZONE).

CREATE TABLE IF NOT EXISTS audit_logs (
    id            VARCHAR(36)   NOT NULL PRIMARY KEY,   -- UUID generated in app layer
    user_id       VARCHAR(36)   NULL,                   -- NULL for system-triggered actions
    action        VARCHAR(255)  NOT NULL,               -- e.g. CREATE_USER, UPDATE_SETTINGS
    resource_type VARCHAR(255)  NOT NULL,               -- e.g. user, exam, settings
    resource_id   CHAR(36)      NULL,                   -- ID of affected record
    old_data      JSON          NULL,                   -- Snapshot before change
    new_data      JSON          NULL,                   -- Snapshot after change
    ip_address    VARCHAR(45)   NULL,                   -- Supports IPv4 and IPv6
    user_agent    TEXT          NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_resource   ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_action     ON audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

