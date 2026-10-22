-- Migration 009: thêm reports.is_late (báo cáo tổng kết nộp sau final_report_deadline của đợt) —
-- cho database đã tồn tại.
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/009_reports_is_late.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

ALTER TABLE reports
  ADD COLUMN is_late TINYINT(1) NOT NULL DEFAULT 0 AFTER submitted_at;
