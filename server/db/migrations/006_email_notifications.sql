-- Migration 006: thêm users.email_notifications (cho phép tự tắt/bật email khi có thông báo mới)
-- cho database đã tồn tại (đã chạy schema.sql cũ chưa có cột này).
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/006_email_notifications.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

ALTER TABLE users
  ADD COLUMN email_notifications TINYINT(1) NOT NULL DEFAULT 1 AFTER must_change_password;
