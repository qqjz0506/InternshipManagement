-- Migration 008: thêm internship_periods.log_frequency_days/final_report_deadline/evaluation_deadline
-- cho luồng nhắc việc (Mục 16J README) — cho database đã tồn tại.
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/008_internship_periods_reminders.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

ALTER TABLE internship_periods
  ADD COLUMN log_frequency_days TINYINT UNSIGNED NOT NULL DEFAULT 7 AFTER end_date,
  ADD COLUMN final_report_deadline DATE NULL AFTER log_frequency_days,
  ADD COLUMN evaluation_deadline DATE NULL AFTER final_report_deadline;
