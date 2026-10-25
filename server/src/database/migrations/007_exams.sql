-- Migration: 007_exams
-- Description: Shared exam records (form values JSON). Drafts stay in browser IndexedDB until Save.

CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    form_values JSON NOT NULL,
    fields_snapshot JSON NOT NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_exams_created_at (created_at),
    INDEX idx_exams_created_by (created_by),
    CONSTRAINT fk_exams_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
