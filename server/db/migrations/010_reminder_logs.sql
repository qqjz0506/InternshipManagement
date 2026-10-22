-- Migration 010: bảng reminder_logs — chống gửi trùng nhắc việc tự động (server/jobs/reminderJob.js).
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/010_reminder_logs.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

CREATE TABLE IF NOT EXISTS reminder_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  -- reminder_key: định danh DUY NHẤT cho 1 "việc cần nhắc" cụ thể (vd. "log_overdue:internship:5",
  -- "final_report_due:internship:5", "evaluation_due:internship:5:lecturer") — xem reminderService.js.
  reminder_key VARCHAR(255) NOT NULL,
  sent_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- UNIQUE (user_id, reminder_key, sent_date): đây CHÍNH LÀ cơ chế chống gửi trùng — job tự INSERT
  -- trước, chỉ thực sự gửi notify()/email nếu INSERT thành công (claim-ticket), không dựa vào cờ
  -- in-memory (an toàn kể cả khi job chạy lại nhiều lần trong ngày hoặc server restart).
  UNIQUE KEY uk_reminder_logs_user_key_date (user_id, reminder_key, sent_date),
  INDEX idx_reminder_logs_user (user_id),
  CONSTRAINT fk_reminder_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
