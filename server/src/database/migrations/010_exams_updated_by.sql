-- Migration: 010_exams_updated_by
-- Description: Track who last modified an exam row (for Modify by / Updated by display).

ALTER TABLE exams
  ADD COLUMN updated_by VARCHAR(36) NULL AFTER created_by,
  ADD INDEX idx_exams_updated_by (updated_by);
