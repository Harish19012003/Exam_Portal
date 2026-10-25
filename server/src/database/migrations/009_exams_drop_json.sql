-- Migration: 009_exams_drop_json
-- Description: Remove legacy JSON columns — exam values live only as real SQL columns.

ALTER TABLE exams DROP COLUMN form_values;
ALTER TABLE exams DROP COLUMN fields_snapshot;
