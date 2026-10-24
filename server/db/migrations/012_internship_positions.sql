-- Migration 012: bảng internship_positions (vị trí thực tập do Doanh nghiệp/Admin đăng, Sinh viên
-- ứng tuyển — xem server/services/internshipPositionService.js).
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/012_internship_positions.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

CREATE TABLE IF NOT EXISTS internship_positions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  period_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  requirements TEXT NULL,
  slots TINYINT UNSIGNED NOT NULL,
  -- status: 'open' = còn nhận đơn, 'closed' = đã đủ slot (tự đóng khi accepted >= slots, xem
  -- positionApplicationService.accept) hoặc Admin/Mentor tự đóng tay.
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_internship_positions_company (company_id),
  INDEX idx_internship_positions_period (period_id),
  INDEX idx_internship_positions_status (status),
  CONSTRAINT fk_internship_positions_company FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_internship_positions_period FOREIGN KEY (period_id) REFERENCES internship_periods(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
