-- Migration: 012_exam_tables
-- Description: Per-exam dynamic tables. Each exam owns a physical table `exam_data_<exam_tables.id>`
-- whose real SQL columns are created/dropped at runtime from the Explore page column builder.
-- These two tables only hold the metadata (labels, types, order) that SQL itself cannot store.

CREATE TABLE IF NOT EXISTS exam_tables (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exam_tables_exam (exam_id)
);

CREATE TABLE IF NOT EXISTS exam_table_fields (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    table_id INT UNSIGNED NOT NULL,
    column_name VARCHAR(40) NOT NULL,
    label VARCHAR(120) NOT NULL,
    data_type VARCHAR(30) NOT NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 0,
    options JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exam_table_fields_column (table_id, column_name),
    INDEX idx_exam_table_fields_order (table_id, sort_order),
    CONSTRAINT fk_exam_table_fields_table
      FOREIGN KEY (table_id) REFERENCES exam_tables(id) ON DELETE CASCADE
);
