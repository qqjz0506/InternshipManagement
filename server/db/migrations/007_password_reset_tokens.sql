-- Migration 007: bảng password_reset_tokens cho luồng "Quên mật khẩu" tự phục vụ.
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/007_password_reset_tokens.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  -- token_hash: sha256(token gửi qua email) — KHÔNG BAO GIỜ lưu token gốc trong DB, chỉ so khớp bằng
  -- hash (giống nguyên tắc password_hash, chỉ khác thuật toán vì đây không phải mật khẩu người dùng
  -- tự chọn, không cần bcrypt cost factor).
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_password_reset_tokens_hash (token_hash),
  INDEX idx_password_reset_tokens_user (user_id),
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
