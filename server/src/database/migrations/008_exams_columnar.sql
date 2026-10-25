-- Migration: 008_exams_columnar
-- Description: Exam row values live in real columns (field key = column name).
-- Dynamic field columns are added at runtime via ALTER TABLE when config is published.
-- Legacy JSON columns kept nullable only for one-time data migration.

ALTER TABLE exams
  MODIFY form_values JSON NULL,
  MODIFY fields_snapshot JSON NULL;
