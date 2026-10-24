-- Migration 014: thêm settings.school_name/faculty_name — dùng để in lên giấy giới thiệu thực tập +
-- phiếu kết quả thực tập (PDF, xem server/services/documentService.js).
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/014_settings_school_faculty.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

ALTER TABLE settings
  ADD COLUMN school_name VARCHAR(255) NULL AFTER system_description,
  ADD COLUMN faculty_name VARCHAR(255) NULL AFTER school_name;
