-- Seed data cho Hệ thống Quản lý Thực tập Tốt nghiệp
-- Nguồn: client/src/data/*.js và client/src/context/SettingsContext.jsx (DEFAULT_SETTINGS)
-- Toàn bộ giá trị được chuyển 1-1 từ mock data hiện tại, KHÔNG tự chế thêm dữ liệu.
-- ID được ghi tường minh để khớp đúng id đang dùng trong mock (phục vụ FK đúng như frontend).
--
-- QUAN TRỌNG: chạy với --default-character-set=utf8mb4, nếu không toàn bộ text tiếng Việt
-- sẽ bị lưu sai (xem cảnh báo trong server/db/schema.sql).
--   mysql -u root --default-character-set=utf8mb4 < server/db/seed.sql

USE internship_management;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE settings;
TRUNCATE TABLE notifications;
TRUNCATE TABLE evaluations;
TRUNCATE TABLE reports;
TRUNCATE TABLE internship_logs;
TRUNCATE TABLE internships;
TRUNCATE TABLE topics;
TRUNCATE TABLE company_mentors;
TRUNCATE TABLE lecturers;
TRUNCATE TABLE students;
TRUNCATE TABLE users;
TRUNCATE TABLE internship_periods;
TRUNCATE TABLE companies;
TRUNCATE TABLE departments;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. DEPARTMENTS (data/departments.js)
-- description: KHÔNG có trong mock data gốc, nhưng có trong DepartmentFormModal.jsx/DepartmentsPage.jsx
-- (phát hiện khi đối chiếu UI, bổ sung cột — mock ban đầu để NULL, không tự chế nội dung).
INSERT INTO departments (id, department_code, department_name, description) VALUES
(1, 'CNTT', 'Công nghệ thông tin', NULL),
(2, 'KTPM', 'Kỹ thuật phần mềm', NULL),
(3, 'HTTT', 'Hệ thống thông tin', NULL),
(4, 'ATTT', 'An toàn thông tin', NULL);

-- 2. COMPANIES (data/companies.js)
INSERT INTO companies (id, company_code, company_name, tax_code, address, phone, email, website, representative, status) VALUES
(1, 'DN001', 'Công ty TNHH Công nghệ FPT Software', '0100112233', 'Hà Nội', '02412345678', 'contact@fptsoftware.vn', 'https://fptsoftware.com', 'Nguyễn Văn Hùng', 'active'),
(2, 'DN002', 'Công ty Cổ phần Giải pháp Phần mềm VNG', '0100223344', 'TP. Hồ Chí Minh', '02823456789', 'info@vng.com.vn', 'https://vng.com.vn', 'Lê Thị Mai', 'active'),
(3, 'DN003', 'Công ty TNHH ABC Technology', '0100334455', 'Đà Nẵng', '02363456780', 'hr@abctech.vn', 'https://abctech.vn', 'Trần Văn Long', 'active'),
(4, 'DN004', 'Công ty Cổ phần Giải pháp Phần mềm XYZ', '0100445566', 'Hà Nội', '02434567891', 'contact@xyzsoft.vn', 'https://xyzsoft.vn', 'Phạm Thị Hằng', 'active'),
(5, 'DN005', 'Công ty TNHH Hệ thống Thông tin Viettel', '0100556677', 'Hà Nội', '02498765432', 'tuyendung@viettel.com.vn', 'https://viettel.com.vn', 'Nguyễn Minh Đức', 'active'),
(6, 'DN006', 'Công ty Cổ phần Công nghệ CMC', '0100667788', 'Hà Nội', '02466778899', 'info@cmc.com.vn', 'https://cmc.com.vn', 'Đỗ Thị Thanh', 'inactive'),
(7, 'DN007', 'Công ty TNHH Sản xuất Phần mềm KMS', '0100778899', 'TP. Hồ Chí Minh', '02877889900', 'contact@kms-technology.com', 'https://kms-technology.com', 'Vũ Anh Tuấn', 'active'),
(8, 'DN008', 'Công ty Cổ phần Tập đoàn Công nghệ NashTech', '0100889900', 'Hà Nội', '02488990011', 'hr@nashtechglobal.com', 'https://nashtechglobal.com', 'Hoàng Thị Linh', 'active'),
(9, 'DN009', 'Công ty TNHH Axon Active Việt Nam', '0100990011', 'TP. Hồ Chí Minh', '02899001122', 'info@axonactive.com', 'https://axonactive.com', 'Ngô Văn Bình', 'active'),
(10, 'DN010', 'Công ty Cổ phần Giải pháp Số Việt', '0101001122', 'Cần Thơ', '02921122334', 'contact@vietdigital.vn', 'https://vietdigital.vn', 'Bùi Thị Nga', 'inactive');

-- 3. INTERNSHIP_PERIODS (data/internshipPeriods.js)
-- description: KHÔNG có trong mock data gốc, nhưng có trong PeriodFormModal.jsx (field CRUD thật,
-- dù chưa hiển thị ở cột bảng InternshipPeriodsPage.jsx) — mock ban đầu để NULL, không tự chế nội dung.
INSERT INTO internship_periods (id, period_code, period_name, start_date, end_date, status, description) VALUES
(1, 'TT2024-1', 'Đợt thực tập HK1 2024-2025', '2024-09-01', '2025-01-15', 'closed', NULL),
(2, 'TT2024-2', 'Đợt thực tập HK2 2024-2025', '2025-02-01', '2025-06-15', 'ongoing', NULL),
(3, 'TT2025-1', 'Đợt thực tập HK1 2025-2026', '2025-09-01', '2026-01-15', 'upcoming', NULL);

-- 4. USERS (data/mockUsers.js) — password_hash = bcrypt(cost 10) của password plaintext gốc trong mock.
-- Plaintext test password cho từng tài khoản: xem docs/API_PHASE_3A.md (mục Test accounts).
-- KHÔNG BAO GIỜ lưu plaintext — đây là thay đổi bắt buộc của Phase 3A (password hashing).
INSERT INTO users (id, full_name, email, password_hash, role) VALUES
(1, 'Quản trị viên', 'admin@example.com', '$2b$10$orS0/bZi0vWTAXUvr5RtIe34LbZmXxdzSIICztKNZV3wBNrwis8x2', 'admin'),
(2, 'Nguyễn Minh Anh', 'student@example.com', '$2b$10$hVfII6OPVICAu/fmf3PuleW/boSZE4wUKIbipbEPzRDSMC.S.apTe', 'student'),
(3, 'Trần Quốc Bảo', 'lecturer@example.com', '$2b$10$7G5E5r9vAGGJXrglBna23uhfd.603Mi65hUXjkmwaIME2O.nR4Yme', 'lecturer'),
(4, 'Lê Hoàng Nam', 'company@example.com', '$2b$10$VXE9g0Yd71.zI/L5/OTrNunbtWLzdQebr0EPnwcRhC.L6XcwRzx.a', 'company_mentor'),
(5, 'Hoàng Văn Đức', 'student2@example.com', '$2b$10$hVfII6OPVICAu/fmf3PuleW/boSZE4wUKIbipbEPzRDSMC.S.apTe', 'student'),
(6, 'Lý Gia Bảo', 'student3@example.com', '$2b$10$hVfII6OPVICAu/fmf3PuleW/boSZE4wUKIbipbEPzRDSMC.S.apTe', 'student'),
(7, 'Phạm Văn Sơn', 'lecturer2@example.com', '$2b$10$7G5E5r9vAGGJXrglBna23uhfd.603Mi65hUXjkmwaIME2O.nR4Yme', 'lecturer'),
(8, 'Trịnh Thảo My', 'student4@example.com', '$2b$10$hVfII6OPVICAu/fmf3PuleW/boSZE4wUKIbipbEPzRDSMC.S.apTe', 'student'),
(9, 'Nguyễn Thị Hạnh', 'company2@example.com', '$2b$10$VXE9g0Yd71.zI/L5/OTrNunbtWLzdQebr0EPnwcRhC.L6XcwRzx.a', 'company_mentor'),
(10, 'Lê Văn Kiên', 'company3@example.com', '$2b$10$VXE9g0Yd71.zI/L5/OTrNunbtWLzdQebr0EPnwcRhC.L6XcwRzx.a', 'company_mentor');

-- 5. STUDENTS (data/students.js)
INSERT INTO students (id, user_id, student_code, full_name, gender, date_of_birth, phone, email, address, department_id, major, class, status) VALUES
(1, 2, '21110001', 'Nguyễn Minh Anh', 'Nam', '2003-05-12', '0901234567', 'minhanh.nguyen@student.edu.vn', 'Hà Nội', 1, 'Công nghệ thông tin', 'DHKTPM17A', 'active'),
(2, NULL, '21110002', 'Trần Thị Bích', 'Nữ', '2003-08-21', '0912345678', 'bich.tran@student.edu.vn', 'Hải Phòng', 1, 'Công nghệ thông tin', 'DHKTPM17A', 'active'),
(3, NULL, '21110003', 'Lê Hoàng Nam', 'Nam', '2003-02-14', '0923456789', 'nam.le@student.edu.vn', 'Đà Nẵng', 2, 'Kỹ thuật phần mềm', 'DHKTPM17B', 'active'),
(4, NULL, '21110004', 'Phạm Thu Trang', 'Nữ', '2003-11-03', '0934567890', 'trang.pham@student.edu.vn', 'TP. Hồ Chí Minh', 2, 'Kỹ thuật phần mềm', 'DHKTPM17B', 'inactive'),
(5, 5, '21110005', 'Hoàng Văn Đức', 'Nam', '2003-07-19', '0945678901', 'duc.hoang@student.edu.vn', 'Cần Thơ', 3, 'Hệ thống thông tin', 'DHHTTT17A', 'active'),
(6, NULL, '21110006', 'Vũ Thị Hoa', 'Nữ', '2003-09-30', '0956789012', 'hoa.vu@student.edu.vn', 'Huế', 3, 'Hệ thống thông tin', 'DHHTTT17A', 'active'),
(7, NULL, '21110007', 'Đặng Quốc Huy', 'Nam', '2003-01-25', '0967890123', 'huy.dang@student.edu.vn', 'Nha Trang', 4, 'An toàn thông tin', 'DHATTT17A', 'active'),
(8, NULL, '21110008', 'Bùi Ngọc Linh', 'Nữ', '2003-04-08', '0978901234', 'linh.bui@student.edu.vn', 'Vinh', 4, 'An toàn thông tin', 'DHATTT17A', 'inactive'),
(9, NULL, '21110009', 'Ngô Thanh Tùng', 'Nam', '2003-06-17', '0989012345', 'tung.ngo@student.edu.vn', 'Bình Dương', 1, 'Công nghệ thông tin', 'DHKTPM17C', 'active'),
(10, NULL, '21110010', 'Đỗ Khánh Vy', 'Nữ', '2003-10-22', '0990123456', 'vy.do@student.edu.vn', 'Quảng Ninh', 1, 'Công nghệ thông tin', 'DHKTPM17C', 'active'),
(11, 6, '21110011', 'Lý Gia Bảo', 'Nam', '2003-03-11', '0901112233', 'bao.ly@student.edu.vn', 'Đồng Nai', 2, 'Kỹ thuật phần mềm', 'DHKTPM17D', 'active'),
(12, 8, '21110012', 'Trịnh Thảo My', 'Nữ', '2003-12-05', '0912223344', 'my.trinh@student.edu.vn', 'Bắc Ninh', 2, 'Kỹ thuật phần mềm', 'DHKTPM17D', 'active'),
(13, NULL, '21110013', 'Phan Anh Tuấn', 'Nam', '2003-08-14', '0923334455', 'tuan.phan@student.edu.vn', 'Thanh Hóa', 3, 'Hệ thống thông tin', 'DHHTTT17B', 'active'),
(14, NULL, '21110014', 'Mai Thu Hằng', 'Nữ', '2003-05-29', '0934445566', 'hang.mai@student.edu.vn', 'Nghệ An', 4, 'An toàn thông tin', 'DHATTT17B', 'active');

-- 6. LECTURERS (data/lecturers.js)
INSERT INTO lecturers (id, user_id, lecturer_code, full_name, email, phone, department_id, position, status) VALUES
(1, 3, 'GV001', 'Trần Quốc Bảo', 'lecturer@example.com', '0911111111', 1, 'Giảng viên chính', 'active'),
(2, NULL, 'GV002', 'Nguyễn Thị Lan', 'lan.nguyen@edu.vn', '0911111112', 1, 'Giảng viên', 'active'),
(3, 7, 'GV003', 'Phạm Văn Sơn', 'son.pham@edu.vn', '0911111113', 2, 'Tiến sĩ', 'active'),
(4, NULL, 'GV004', 'Lê Thị Hồng', 'hong.le@edu.vn', '0911111114', 2, 'Giảng viên', 'active'),
(5, NULL, 'GV005', 'Vũ Đình Khoa', 'khoa.vu@edu.vn', '0911111115', 3, 'Phó giáo sư', 'active'),
(6, NULL, 'GV006', 'Đặng Thị Nga', 'nga.dang@edu.vn', '0911111116', 3, 'Giảng viên chính', 'inactive'),
(7, NULL, 'GV007', 'Hoàng Minh Tuấn', 'tuan.hoang@edu.vn', '0911111117', 4, 'Tiến sĩ', 'active'),
(8, NULL, 'GV008', 'Bùi Thị Thu', 'thu.bui@edu.vn', '0911111118', 4, 'Giảng viên', 'active'),
(9, NULL, 'GV009', 'Ngô Văn Phúc', 'phuc.ngo@edu.vn', '0911111119', 1, 'Giảng viên', 'active'),
(10, NULL, 'GV010', 'Trịnh Thị Yến', 'yen.trinh@edu.vn', '0911111120', 2, 'Giảng viên', 'inactive');

-- 7. COMPANY_MENTORS (data/companyMentors.js)
INSERT INTO company_mentors (id, user_id, company_id, full_name, email, phone, position, status) VALUES
(1, 9, 1, 'Nguyễn Thị Hạnh', 'hanh.nguyen@fptsoftware.vn', '0977111222', 'Trưởng nhóm phát triển', 'active'),
(2, 10, 1, 'Lê Văn Kiên', 'kien.le@fptsoftware.vn', '0977111223', 'Kỹ sư phần mềm cấp cao', 'active'),
(3, NULL, 2, 'Phạm Thị Yến', 'yen.pham@vng.com.vn', '0977222333', 'Trưởng phòng nhân sự', 'active'),
(4, NULL, 3, 'Trần Văn Nghĩa', 'nghia.tran@abctech.vn', '0977333444', 'Giám đốc kỹ thuật', 'active'),
(5, NULL, 5, 'Đỗ Thị Kim Anh', 'kimanh.do@viettel.com.vn', '0977444555', 'Quản lý dự án', 'active'),
(6, NULL, 7, 'Vũ Hoàng Long', 'long.vu@kms-technology.com', '0977555666', 'Technical Lead', 'active'),
(7, 4, 4, 'Lê Hoàng Nam', 'company@example.com', '0977666777', 'Người hướng dẫn thực tập', 'active');

-- 8. TOPICS (data/topics.js)
INSERT INTO topics (id, topic_code, topic_name, description, suggested_by_student_id, company_id, status) VALUES
(1, 'DT001', 'Xây dựng hệ thống quản lý bán hàng trực tuyến', 'Phát triển website bán hàng với giỏ hàng, thanh toán, quản lý đơn hàng.', 1, NULL, 'approved'),
(2, 'DT002', 'Ứng dụng học máy trong dự đoán doanh số', 'Xây dựng mô hình dự đoán doanh số bán hàng dựa trên dữ liệu lịch sử.', 3, NULL, 'approved'),
(3, 'DT003', 'Phát triển ứng dụng di động quản lý chi tiêu cá nhân', 'Ứng dụng mobile giúp người dùng theo dõi thu chi hàng ngày.', 5, NULL, 'approved'),
(4, 'DT004', 'Xây dựng chatbot hỗ trợ chăm sóc khách hàng', 'Chatbot tự động trả lời câu hỏi thường gặp của khách hàng.', NULL, 1, 'approved'),
(5, 'DT005', 'Hệ thống giám sát hạ tầng mạng thời gian thực', 'Giám sát tình trạng thiết bị mạng và cảnh báo sự cố.', NULL, 5, 'approved'),
(6, 'DT006', 'Tối ưu hóa quy trình CI/CD cho dự án phần mềm', 'Xây dựng pipeline CI/CD tự động triển khai ứng dụng.', 7, NULL, 'proposed'),
(7, 'DT007', 'Xây dựng hệ thống quản lý kho hàng', 'Quản lý nhập/xuất kho, tồn kho theo thời gian thực.', 9, NULL, 'approved'),
(8, 'DT008', 'Phân tích dữ liệu lớn trong thương mại điện tử', 'Phân tích hành vi người dùng từ dữ liệu giao dịch.', NULL, 2, 'approved'),
(9, 'DT009', 'Xây dựng cổng thông tin nội bộ doanh nghiệp', 'Cổng thông tin chia sẻ tài liệu và thông báo nội bộ.', 11, NULL, 'approved'),
(10, 'DT010', 'Nghiên cứu và triển khai giải pháp bảo mật ứng dụng web', 'Đánh giá và vá các lỗ hổng bảo mật phổ biến (OWASP Top 10).', 13, NULL, 'rejected');

-- 9. INTERNSHIPS (data/internships.js) — bảng trung tâm
INSERT INTO internships (id, student_id, period_id, company_id, company_mentor_id, lecturer_id, topic_id, start_date, end_date, status, progress) VALUES
(1, 1, 2, 1, 1, 1, 1, '2025-02-01', '2025-06-15', 'in_progress', 60),
(2, 2, 2, 1, 2, 1, NULL, '2025-02-01', NULL, 'approved', 10),
-- internships.id=3: topic_id gốc trong seed cũ là 2, nhưng đã lệch khỏi DB dev thật đang chạy (đã
-- được NULL hóa từ trước — phát hiện khi chạy test suite lần đầu trên DB test build từ seed.sql,
-- xem docs liên quan đến "test database riêng"). Khớp lại đúng NULL để seed tái tạo đúng trạng thái
-- mà toàn bộ test (businessRulesV2.test.js Rule 2) đã xác minh xuyên suốt các phase trước.
(3, 3, 2, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 0),
(4, 5, 2, 5, 5, 3, 5, '2025-02-01', '2025-06-15', 'in_progress', 75),
(5, 6, 2, NULL, NULL, 3, NULL, NULL, NULL, 'approved', 5),
(6, 7, 2, NULL, NULL, NULL, 6, NULL, NULL, 'pending', 0),
(7, 9, 2, 7, 6, 5, 7, '2025-02-01', '2025-06-15', 'in_progress', 40),
(8, 11, 2, 4, 7, 7, 9, '2025-02-01', '2025-06-15', 'in_progress', 55),
(9, 4, 1, 2, 3, 2, 8, '2024-09-01', '2025-01-15', 'completed', 100),
(10, 8, 1, 3, 4, 4, NULL, '2024-09-01', '2025-01-15', 'completed', 100),
-- internships.id=11: topic_id gốc (10) đang 'rejected' -> vi phạm rule mới "không gán đề tài đã bị
-- từ chối" (áp dụng cả dữ liệu cũ, không chỉ request mới) -> đổi về NULL để seed hợp lệ theo rule hiện tại.
(11, 13, 2, NULL, NULL, NULL, NULL, NULL, NULL, 'rejected', 0),
(12, 10, 2, 1, 1, NULL, NULL, NULL, NULL, 'pending', 0);

-- 10. INTERNSHIP_LOGS (data/internshipLogs.js)
INSERT INTO internship_logs (id, internship_id, log_date, title, content, result, difficulties, next_plan, note, progress, attachment, lecturer_comment, company_comment, status) VALUES
(1, 1, '2025-03-03', 'Tuần 1: Làm quen môi trường dự án', 'Cài đặt môi trường phát triển, đọc tài liệu dự án, tham gia họp nhóm.', 'Hoàn thành cài đặt môi trường, hiểu sơ bộ kiến trúc hệ thống.', 'Chưa quen với quy trình Git của công ty.', 'Bắt đầu nhận task đầu tiên từ người hướng dẫn.', '', 10, NULL, 'Tốt, tiếp tục bám sát kế hoạch.', 'Em làm việc chủ động, phối hợp tốt với team.', 'reviewed'),
-- company_comment: NULL (không phải '') — khớp đúng DB dev thật đang chạy (phát hiện khi so dữ liệu
-- DB fresh dựng từ seed.sql với DB dev lúc kiểm tra cài đặt từ đầu trước khi bảo vệ); log này status
-- 'submitted' (Company Mentor chưa nhận xét), NULL đúng semantics "chưa có" hơn '' (chuỗi rỗng ngụ ý
-- đã nhận xét nhưng để trống).
(2, 1, '2025-03-10', 'Tuần 2: Phát triển module đăng nhập', 'Xây dựng chức năng đăng nhập, phân quyền cơ bản.', 'Hoàn thành chức năng đăng nhập, đang chờ review code.', 'Gặp lỗi khi tích hợp thư viện xác thực.', 'Sửa lỗi và viết unit test.', '', 30, NULL, '', NULL, 'submitted'),
(3, 4, '2025-03-05', 'Tuần 1: Khảo sát hệ thống giám sát hiện tại', 'Khảo sát hạ tầng mạng, thu thập yêu cầu từ phòng kỹ thuật.', 'Có tài liệu mô tả hiện trạng hệ thống.', 'Tài liệu cũ không đầy đủ, phải hỏi lại nhiều lần.', 'Thiết kế sơ đồ kiến trúc giám sát mới.', '', 15, NULL, 'Cần bổ sung thêm số liệu cụ thể.', '', 'reviewed');

-- 11. REPORTS (data/reports.js)
-- id=3,4: bổ sung (không có trong mock gốc) — internships.id=9,10 đã 'completed' nhưng rule mới
-- (in_progress -> completed bắt buộc có báo cáo tổng kết 'final' đã 'approved') đòi hỏi dữ liệu này
-- để seed nhất quán với rule hiện tại, không phải vì mock cũ có sẵn.
INSERT INTO reports (id, internship_id, report_type, file_name, submitted_at, status, reviewer_comment, company_comment) VALUES
(1, 1, 'weekly', 'bao-cao-tuan-2.pdf', '2025-03-10', 'approved', 'Tốt, tiếp tục duy trì tiến độ.', 'Báo cáo rõ ràng, đúng tiến độ đã cam kết.'),
(2, 4, 'weekly', 'bao-cao-tuan-1.pdf', '2025-03-05', 'submitted', '', ''),
(3, 9, 'final', 'bao-cao-tong-ket.pdf', '2025-01-10', 'approved', 'Hoàn thành tốt toàn bộ nội dung thực tập.', 'Sinh viên làm việc nghiêm túc, đúng tiến độ.'),
(4, 10, 'final', 'bao-cao-tong-ket.pdf', '2025-01-10', 'approved', 'Đạt yêu cầu, báo cáo rõ ràng.', 'Hoàn thành công việc được giao đầy đủ.');

-- 12. EVALUATIONS (data/evaluations.js)
-- id=3-6: bổ sung (không có trong mock gốc) — cùng lý do với reports id=3,4: internships.id=9,10
-- 'completed' cần đủ 2 evaluator_role (lecturer+company) theo rule mới.
INSERT INTO evaluations (id, internship_id, evaluator_role, attitude_score, skill_score, progress_score, discipline_score, overall_score, comment, is_published, published_at) VALUES
(1, 1, 'lecturer', 8.5, 8.0, 7.5, 9.0, 8.2, 'Sinh viên chủ động, hoàn thành tốt các task được giao.', 1, '2025-03-12'),
(2, 4, 'lecturer', 8.0, 7.5, 8.0, 8.0, 7.8, 'Đang chờ công bố sau khi họp hội đồng.', 0, NULL),
(3, 9, 'lecturer', 8.0, 8.0, 9.0, 8.0, 8.3, 'Hoàn thành tốt đợt thực tập.', 1, '2025-01-12'),
(4, 9, 'company', 8.0, 7.5, 9.0, 8.5, 8.3, 'Làm việc chuyên nghiệp, đáp ứng yêu cầu công ty.', 1, '2025-01-12'),
(5, 10, 'lecturer', 7.5, 7.5, 8.0, 8.0, 7.8, 'Đạt yêu cầu thực tập.', 1, '2025-01-12'),
(6, 10, 'company', 7.5, 7.0, 8.0, 8.0, 7.6, 'Hoàn thành nhiệm vụ được giao.', 1, '2025-01-12');

-- 13. NOTIFICATIONS (data/notifications.js)
INSERT INTO notifications (id, user_id, title, content, type, is_read, created_at) VALUES
(1, 2, 'Hồ sơ thực tập đã được duyệt', 'Hồ sơ thực tập của bạn tại Công ty TNHH Công nghệ FPT Software đã được duyệt.', 'internship', 1, '2025-02-05'),
(2, 2, 'Bạn đã được phân công giảng viên hướng dẫn', 'Giảng viên Trần Quốc Bảo sẽ hướng dẫn bạn trong đợt thực tập này.', 'assignment', 1, '2025-02-06'),
(3, 2, 'Báo cáo thực tập của bạn đã được duyệt', 'Báo cáo tuần 2 đã được giảng viên duyệt kèm nhận xét.', 'report', 0, '2025-03-11'),
(4, 5, 'Hồ sơ thực tập đã được duyệt', 'Hồ sơ thực tập của bạn tại Công ty TNHH Hệ thống Thông tin Viettel đã được duyệt.', 'internship', 0, '2025-02-05'),
(5, 5, 'Nhật ký thực tập tuần này chưa được cập nhật', 'Bạn chưa cập nhật nhật ký thực tập cho tuần này, vui lòng bổ sung.', 'reminder', 0, '2025-03-15'),
(6, 6, 'Bạn đã được phân công giảng viên hướng dẫn', 'Giảng viên Hoàng Minh Tuấn sẽ hướng dẫn bạn trong đợt thực tập này.', 'assignment', 0, '2025-02-07'),
(7, 3, 'Sinh viên mới được phân công', 'Bạn được phân công hướng dẫn sinh viên Nguyễn Minh Anh và Trần Thị Bích trong đợt thực tập này.', 'assignment', 1, '2025-02-06'),
(8, 3, 'Sinh viên nộp nhật ký thực tập', 'Nguyễn Minh Anh vừa nộp nhật ký thực tập tuần 2.', 'log', 0, '2025-03-10'),
(9, 7, 'Sinh viên mới được phân công', 'Bạn được phân công hướng dẫn sinh viên Hoàng Văn Đức và Vũ Thị Hoa trong đợt thực tập này.', 'assignment', 0, '2025-02-06'),
(10, 9, 'Có sinh viên mới được phân công', 'Bạn được phân công hướng dẫn sinh viên Nguyễn Minh Anh và Đỗ Khánh Vy tại công ty.', 'assignment', 0, '2025-02-06'),
(11, 9, 'Sinh viên nộp nhật ký thực tập', 'Nguyễn Minh Anh vừa nộp nhật ký thực tập tuần 2.', 'log', 0, '2025-03-10'),
(12, 10, 'Có sinh viên mới được phân công', 'Bạn được phân công hướng dẫn sinh viên Trần Thị Bích tại công ty.', 'assignment', 0, '2025-02-06'),
(13, 4, 'Có sinh viên mới được phân công', 'Bạn được phân công hướng dẫn sinh viên Lý Gia Bảo tại công ty.', 'assignment', 0, '2025-02-06');

-- 14. SETTINGS (context/SettingsContext.jsx — DEFAULT_SETTINGS, bản ghi đơn duy nhất)
INSERT INTO settings (id, system_name, system_description, default_internship_period_id, allow_student_registration) VALUES
(1, 'Hệ thống quản lý thực tập tốt nghiệp', 'Hệ thống hỗ trợ quản lý quy trình thực tập giữa sinh viên, giảng viên, doanh nghiệp và khoa.', NULL, 1);

-- Chốt điểm tổng kết cho các hồ sơ đã 'completed' có sẵn trong seed (internships.id=9,10) — cùng công
-- thức/trọng số với evaluationService.computeFinalResult(), tính NGAY TẠI THỜI ĐIỂM SEED (đúng ý
-- nghĩa "chốt khi hoàn thành" — xem server/db/migrations/005_internship_final_score.sql cho DB cũ).
UPDATE internships i
JOIN (
  SELECT internship_id,
    MAX(CASE WHEN evaluator_role = 'lecturer' AND is_published = 1 THEN overall_score END) AS lecturer_score,
    MAX(CASE WHEN evaluator_role = 'company' AND is_published = 1 THEN overall_score END) AS company_score
  FROM evaluations
  GROUP BY internship_id
) e ON e.internship_id = i.id
JOIN settings s ON s.id = 1
SET i.final_score = ROUND((e.lecturer_score * s.lecturer_weight + e.company_score * s.company_weight) / 10) / 10
WHERE i.status = 'completed' AND e.lecturer_score IS NOT NULL AND e.company_score IS NOT NULL;

UPDATE internships
SET final_classification = CASE
  WHEN final_score >= 9 THEN 'Xuất sắc'
  WHEN final_score >= 8 THEN 'Giỏi'
  WHEN final_score >= 6.5 THEN 'Khá'
  WHEN final_score >= 5 THEN 'Trung bình'
  ELSE 'Không đạt'
END
WHERE status = 'completed' AND final_score IS NOT NULL;
