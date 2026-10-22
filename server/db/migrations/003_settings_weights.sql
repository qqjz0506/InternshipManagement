-- Migration 003: thêm trọng số Giảng viên/Doanh nghiệp dùng tính điểm tổng kết thực tập.
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/003_settings_weights.sql

USE internship_management;

ALTER TABLE settings
  ADD COLUMN lecturer_weight TINYINT UNSIGNED NOT NULL DEFAULT 60 AFTER allow_student_registration,
  ADD COLUMN company_weight TINYINT UNSIGNED NOT NULL DEFAULT 40 AFTER lecturer_weight,
  ADD CONSTRAINT chk_settings_weight_sum CHECK (lecturer_weight + company_weight = 100);
