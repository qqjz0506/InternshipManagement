-- Schema cho Hệ thống Quản lý Thực tập Tốt nghiệp
-- Nguồn: docs/DATABASE_DESIGN.md (Mục E) — KHÔNG tự đổi tên bảng/column/FK/relationship.
--
-- QUAN TRỌNG (phát hiện ở Phase 2A): client mysql.exe trên máy này tự thương lượng
-- charset "cp850" thay vì utf8mb4 dù my.ini đã khai default-character-set=utf8mb4.
-- Chạy file này (và seed.sql) LUÔN PHẢI ép charset tường minh, nếu không mọi text
-- tiếng Việt sẽ bị lưu sai (mojibake) dù terminal hiển thị "đúng" một cách đánh lừa:
--   mysql -u root --default-character-set=utf8mb4 < server/db/schema.sql
--   mysql -u root --default-character-set=utf8mb4 < server/db/seed.sql

CREATE DATABASE IF NOT EXISTS internship_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE internship_management;

-- 1. USERS
-- password_hash: bcrypt hash (cost 10) — đổi tên từ "password" ở Phase 3A khi thêm password hashing,
-- KHÔNG BAO GIỜ lưu plaintext. Xem docs/API_PHASE_3A.md.
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','student','lecturer','company_mentor') NOT NULL,
  -- status: khóa/mở tài khoản đăng nhập (không liên quan status active/inactive của students/
  -- lecturers/company_mentors — đó là trạng thái HỒ SƠ NGHIỆP VỤ, đây là trạng thái TÀI KHOẢN đăng
  -- nhập). Bổ sung sau Phase 7C — xem server/db/migrations/001_users_status.sql cho database đã có.
  status ENUM('active','locked') NOT NULL DEFAULT 'active',
  -- must_change_password: bật khi Admin đặt mật khẩu TẠM cho tài khoản (userService.resetPassword) —
  -- bắt buộc đổi mật khẩu trước khi dùng hệ thống (ProtectedRoute.jsx chặn mọi route khác, chỉ cho
  -- vào /change-password). Tự tắt khi user tự đổi mật khẩu thành công (authService.changePassword).
  -- Bổ sung sau đợt kiểm tra trước bảo vệ — xem server/db/migrations/004_must_change_password.sql
  -- cho database đã có.
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  -- email_notifications: tự tắt/bật việc nhận email khi có thông báo mới (notificationService.notify
  -- gọi mailService.sendMail SAU KHI ghi notifications, chỉ khi cờ này = 1) — không liên quan gì tới
  -- việc notification vẫn được ghi vào DB (luôn ghi, chỉ email là tùy chọn). Đổi qua
  -- PUT /api/auth/email-notifications (tự phục vụ, không qua Admin). Bổ sung sau đợt kiểm tra trước
  -- bảo vệ — xem server/db/migrations/006_email_notifications.sql cho database đã có.
  email_notifications TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- 2. DEPARTMENTS
CREATE TABLE departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_code VARCHAR(20) NOT NULL,
  department_name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_departments_code (department_code)
) ENGINE=InnoDB;

-- 3. STUDENTS
CREATE TABLE students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  student_code VARCHAR(20) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('Nam','Nữ','Khác') NOT NULL,
  date_of_birth DATE NULL,
  phone VARCHAR(15) NULL,
  email VARCHAR(255) NOT NULL,
  address VARCHAR(255) NULL,
  department_id INT UNSIGNED NOT NULL,
  major VARCHAR(150) NULL,
  class VARCHAR(50) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_students_code (student_code),
  UNIQUE KEY uk_students_user (user_id),
  INDEX idx_students_department (department_id),
  INDEX idx_students_status (status),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 4. LECTURERS
CREATE TABLE lecturers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  lecturer_code VARCHAR(20) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(15) NULL,
  department_id INT UNSIGNED NOT NULL,
  position VARCHAR(150) NULL,
  -- max_students: số sinh viên tối đa giảng viên này hướng dẫn CÙNG LÚC trong 1 đợt thực tập (đếm
  -- internship status pending/approved/in_progress — xem internshipService.assertLecturerCapacity).
  -- Bổ sung sau đợt kiểm tra trước bảo vệ — xem server/db/migrations/011_lecturers_max_students.sql
  -- cho database đã có.
  max_students TINYINT UNSIGNED NOT NULL DEFAULT 10,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lecturers_code (lecturer_code),
  UNIQUE KEY uk_lecturers_user (user_id),
  INDEX idx_lecturers_department (department_id),
  INDEX idx_lecturers_status (status),
  CONSTRAINT fk_lecturers_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_lecturers_department FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 5. COMPANIES
CREATE TABLE companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_code VARCHAR(20) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  tax_code VARCHAR(20) NOT NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(15) NULL,
  email VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  representative VARCHAR(150) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_companies_code (company_code),
  UNIQUE KEY uk_companies_tax_code (tax_code),
  INDEX idx_companies_status (status)
) ENGINE=InnoDB;

-- 6. COMPANY_MENTORS
CREATE TABLE company_mentors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  company_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(15) NULL,
  position VARCHAR(150) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_company_mentors_email (email),
  UNIQUE KEY uk_company_mentors_user (user_id),
  INDEX idx_company_mentors_company (company_id),
  INDEX idx_company_mentors_status (status),
  CONSTRAINT fk_company_mentors_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_company_mentors_company FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 7. INTERNSHIP_PERIODS
CREATE TABLE internship_periods (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  period_code VARCHAR(20) NOT NULL,
  period_name VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- log_frequency_days: Sinh viên phải có ít nhất 1 nhật ký mới mỗi N ngày (mặc định 7) — dùng ở
  -- reminderService.js để tính "quá hạn chưa ghi nhật ký". final_report_deadline/evaluation_deadline:
  -- hạn nộp báo cáo tổng kết/hạn hoàn tất đánh giá của ĐỢT (không bắt buộc, NULL = chưa đặt hạn, không
  -- nhắc). Bổ sung sau đợt kiểm tra trước bảo vệ — xem
  -- server/db/migrations/008_internship_periods_reminders.sql cho database đã có.
  log_frequency_days TINYINT UNSIGNED NOT NULL DEFAULT 7,
  final_report_deadline DATE NULL,
  evaluation_deadline DATE NULL,
  status ENUM('upcoming','ongoing','closed') NOT NULL DEFAULT 'upcoming',
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_periods_code (period_code),
  INDEX idx_periods_status (status)
) ENGINE=InnoDB;

-- 8. TOPICS
CREATE TABLE topics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_code VARCHAR(20) NOT NULL,
  topic_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  suggested_by_student_id INT UNSIGNED NULL,
  company_id INT UNSIGNED NULL,
  status ENUM('proposed','approved','rejected') NOT NULL DEFAULT 'proposed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_topics_code (topic_code),
  INDEX idx_topics_student (suggested_by_student_id),
  INDEX idx_topics_company (company_id),
  INDEX idx_topics_status (status),
  CONSTRAINT fk_topics_student FOREIGN KEY (suggested_by_student_id) REFERENCES students(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_topics_company FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 9. INTERNSHIPS (bảng trung tâm)
CREATE TABLE internships (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  period_id INT UNSIGNED NOT NULL,
  company_id INT UNSIGNED NULL,
  company_mentor_id INT UNSIGNED NULL,
  lecturer_id INT UNSIGNED NULL,
  topic_id INT UNSIGNED NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('pending','approved','in_progress','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  -- final_score/final_classification: điểm tổng kết thực tập + xếp loại ĐÃ CHỐT tại thời điểm chuyển
  -- sang 'completed' (evaluationService.computeFinalResult, dùng trọng số settings.lecturer_weight/
  -- company_weight TẠI THỜI ĐIỂM ĐÓ) — một khi đã completed, giá trị này KHÔNG đổi nữa dù Settings đổi
  -- trọng số sau này (bất biến hồ sơ completed, đợt kiểm tra trước bảo vệ). NULL khi chưa completed
  -- hoặc completed từ trước khi tính năng này tồn tại và chưa được backfill (xem migrations/005).
  final_score DECIMAL(3,1) NULL,
  final_classification VARCHAR(30) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_internships_student_period (student_id, period_id),
  INDEX idx_internships_period (period_id),
  INDEX idx_internships_company (company_id),
  INDEX idx_internships_mentor (company_mentor_id),
  INDEX idx_internships_lecturer (lecturer_id),
  INDEX idx_internships_topic (topic_id),
  INDEX idx_internships_status (status),
  CONSTRAINT chk_internships_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT fk_internships_student FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_internships_period FOREIGN KEY (period_id) REFERENCES internship_periods(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_internships_company FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_internships_mentor FOREIGN KEY (company_mentor_id) REFERENCES company_mentors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_internships_lecturer FOREIGN KEY (lecturer_id) REFERENCES lecturers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_internships_topic FOREIGN KEY (topic_id) REFERENCES topics(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 10. INTERNSHIP_LOGS
CREATE TABLE internship_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  internship_id INT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NULL,
  result TEXT NULL,
  difficulties TEXT NULL,
  next_plan TEXT NULL,
  note TEXT NULL,
  progress TINYINT UNSIGNED NULL,
  attachment VARCHAR(255) NULL,
  lecturer_comment TEXT NULL,
  company_comment TEXT NULL,
  status ENUM('submitted','reviewed') NOT NULL DEFAULT 'submitted',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_logs_internship (internship_id),
  INDEX idx_logs_status (status),
  CONSTRAINT chk_logs_progress CHECK (progress IS NULL OR progress BETWEEN 0 AND 100),
  CONSTRAINT fk_logs_internship FOREIGN KEY (internship_id) REFERENCES internships(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 11. REPORTS
CREATE TABLE reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  internship_id INT UNSIGNED NOT NULL,
  report_type ENUM('weekly','final') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  -- stored_file_name: tên file THẬT trên đĩa (server/uploads/reports/), luôn là crypto.randomUUID()
  -- + phần mở rộng — KHÔNG liên quan gì tới file_name (tên gốc, chỉ để hiển thị). NULL cho các report
  -- seed cũ (chưa có file thật) hoặc bổ sung sau khi có upload thật. Xem server/config/upload.js.
  stored_file_name VARCHAR(255) NULL,
  file_size INT UNSIGNED NULL,
  mime_type VARCHAR(100) NULL,
  submitted_at DATE NOT NULL,
  -- is_late: CHỈ có ý nghĩa với report_type='final' — nộp sau internship_periods.final_report_deadline
  -- của đợt (reportService.create() tự tính, client không gửi được). Báo cáo tuần ('weekly') không có
  -- khái niệm hạn, luôn 0. Bổ sung sau đợt kiểm tra trước bảo vệ — xem
  -- server/db/migrations/009_reports_is_late.sql cho database đã có.
  is_late TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
  reviewer_comment TEXT NULL,
  company_comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reports_internship (internship_id),
  INDEX idx_reports_status (status),
  CONSTRAINT fk_reports_internship FOREIGN KEY (internship_id) REFERENCES internships(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 12. EVALUATIONS
CREATE TABLE evaluations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  internship_id INT UNSIGNED NOT NULL,
  evaluator_role ENUM('lecturer','company') NOT NULL,
  attitude_score DECIMAL(3,1) NOT NULL,
  skill_score DECIMAL(3,1) NOT NULL,
  progress_score DECIMAL(3,1) NOT NULL,
  discipline_score DECIMAL(3,1) NOT NULL,
  overall_score DECIMAL(3,1) NOT NULL,
  comment TEXT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_evaluations_internship_role (internship_id, evaluator_role),
  INDEX idx_evaluations_published (is_published),
  CONSTRAINT chk_eval_attitude CHECK (attitude_score BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_skill CHECK (skill_score BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_progress CHECK (progress_score BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_discipline CHECK (discipline_score BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_overall CHECK (overall_score BETWEEN 0 AND 10),
  CONSTRAINT fk_evaluations_internship FOREIGN KEY (internship_id) REFERENCES internships(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 13. NOTIFICATIONS
CREATE TABLE notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NULL,
  type ENUM('internship','assignment','report','reminder','evaluation','log') NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_read (is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 14. SETTINGS (single row)
CREATE TABLE settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  system_name VARCHAR(255) NOT NULL,
  system_description TEXT NULL,
  -- school_name/faculty_name: in lên giấy giới thiệu thực tập + phiếu kết quả thực tập (PDF, xem
  -- server/services/documentService.js) — KHÁC system_name (tên hiển thị trong ứng dụng). NULL = Admin
  -- chưa cấu hình, PDF tự hiện dòng chấm trống thay thế. Bổ sung sau đợt kiểm tra trước bảo vệ — xem
  -- server/db/migrations/014_settings_school_faculty.sql cho database đã có.
  school_name VARCHAR(255) NULL,
  faculty_name VARCHAR(255) NULL,
  default_internship_period_id INT UNSIGNED NULL,
  allow_student_registration TINYINT(1) NOT NULL DEFAULT 1,
  -- lecturer_weight/company_weight: trọng số (%) dùng tính điểm tổng kết thực tập (evaluationService.
  -- computeFinalResult) — luôn phải cộng = 100 (validate ở settingsService + CHECK constraint ở DB,
  -- 2 lớp độc lập giống mọi invariant khác trong dự án).
  lecturer_weight TINYINT UNSIGNED NOT NULL DEFAULT 60,
  company_weight TINYINT UNSIGNED NOT NULL DEFAULT 40,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_settings_weight_sum CHECK (lecturer_weight + company_weight = 100),
  CONSTRAINT chk_settings_singleton CHECK (id = 1),
  CONSTRAINT fk_settings_default_period FOREIGN KEY (default_internship_period_id) REFERENCES internship_periods(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 15. PASSWORD_RESET_TOKENS (luồng "Quên mật khẩu" tự phục vụ)
CREATE TABLE password_reset_tokens (
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

-- 16. REMINDER_LOGS (chống gửi trùng nhắc việc tự động — server/jobs/reminderJob.js)
CREATE TABLE reminder_logs (
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

-- 17. INTERNSHIP_POSITIONS (vị trí thực tập do Doanh nghiệp/Admin đăng, Sinh viên ứng tuyển)
CREATE TABLE internship_positions (
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

-- 18. POSITION_APPLICATIONS (đơn ứng tuyển vị trí thực tập)
CREATE TABLE position_applications (
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
