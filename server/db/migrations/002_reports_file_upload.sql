-- Migration 002: thêm cột lưu thông tin file upload thật cho reports (stored_file_name/file_size/
-- mime_type) — file_name giữ nguyên vai trò tên gốc để hiển thị, KHÔNG đổi ý nghĩa.
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/002_reports_file_upload.sql

USE internship_management;

ALTER TABLE reports
  ADD COLUMN stored_file_name VARCHAR(255) NULL AFTER file_name,
  ADD COLUMN file_size INT UNSIGNED NULL AFTER stored_file_name,
  ADD COLUMN mime_type VARCHAR(100) NULL AFTER file_size;
