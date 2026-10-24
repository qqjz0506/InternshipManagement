-- Migration 013: bảng position_applications (đơn ứng tuyển vị trí thực tập — xem
-- server/services/positionApplicationService.js).
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/013_position_applications.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

CREATE TABLE IF NOT EXISTS position_applications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  position_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  status ENUM('applied','accepted','rejected','withdrawn') NOT NULL DEFAULT 'applied',
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 1 sinh viên chỉ có ĐÚNG 1 đơn/vị trí — ứng tuyển lại sau khi rút/bị từ chối là UPDATE lại dòng
  -- này (status -> 'applied'), không INSERT dòng mới (xem positionApplicationService.apply).
  UNIQUE KEY uk_position_applications_position_student (position_id, student_id),
  INDEX idx_position_applications_student (student_id),
  INDEX idx_position_applications_status (status),
  CONSTRAINT fk_position_applications_position FOREIGN KEY (position_id) REFERENCES internship_positions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_position_applications_student FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
