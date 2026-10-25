-- Migration: 014_exam_field_presets
-- Description: Field presets per service (Settings > Config > Field presets). When an exam is created,
-- the preset matching its service is copied into the exam's own table; later edits to a preset
-- never change existing exam tables.

CREATE TABLE IF NOT EXISTS exam_field_presets (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    service_value VARCHAR(191) NOT NULL,
    fields JSON NOT NULL,
    features JSON NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exam_field_presets_service (service_value)
);
