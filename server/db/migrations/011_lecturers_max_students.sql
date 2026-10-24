-- Migration 011: thêm lecturers.max_students (giới hạn số sinh viên tối đa 1 giảng viên hướng dẫn
-- CÙNG LÚC trong 1 đợt thực tập) — cho database đã tồn tại.
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/011_lecturers_max_students.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

ALTER TABLE lecturers
  ADD COLUMN max_students TINYINT UNSIGNED NOT NULL DEFAULT 10 AFTER position;
