-- Migration: 013_exam_table_config
-- Description: Per-exam tables now store the full Fields-drawer definition of each column and the
-- Feature Builder settings, so every exam table is configured with the same builders as the exam list.

ALTER TABLE exam_table_fields ADD COLUMN definition JSON NULL;
ALTER TABLE exam_tables ADD COLUMN features JSON NULL;
