-- Migration 004: thêm users.must_change_password (bắt buộc đổi mật khẩu tạm do Admin reset trước
-- khi dùng hệ thống) cho database đã tồn tại (đã chạy schema.sql cũ chưa có cột này).
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/004_must_change_password.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
