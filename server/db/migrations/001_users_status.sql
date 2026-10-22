-- Migration 001: thêm users.status (khóa/mở tài khoản đăng nhập) cho database đã tồn tại
-- (đã chạy schema.sql cũ chưa có cột này). Idempotent-ish: nếu cột đã tồn tại, ALTER sẽ lỗi —
-- chạy 1 lần duy nhất trên mỗi database.
--
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/001_users_status.sql

USE internship_management;

ALTER TABLE users
  ADD COLUMN status ENUM('active','locked') NOT NULL DEFAULT 'active' AFTER role;
