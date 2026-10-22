# DATA MIGRATION MAPPING
## Mock data (frontend) → MySQL (`internship_management`)

> Nguồn thực thi: `server/db/seed.sql`. Tài liệu này chỉ mô tả lại mapping để tham chiếu, không phải nguồn dữ liệu.

---

### 1. `client/src/data/mockUsers.js` (`MOCK_USERS`)
```
data/mockUsers.js
        ↓
users
```
| Frontend field | DB column | Ghi chú |
|---|---|---|
| `id` | `id` | Giữ nguyên số thứ tự |
| `fullName` | `full_name` | **Đổi tên** camelCase → snake_case |
| `email` | `email` | |
| `password` | `password` | Plaintext trong mock, **chưa hash** (đúng phạm vi Phase 1 — hashing thuộc Phase JWT sau) |
| `role` | `role` | |

`ROLE_LABELS`, `ROLE_HOME_PATH` (cùng file) — là hằng số hiển thị/điều hướng phía FE (nhãn tiếng Việt theo role, đường dẫn dashboard theo role), **không migrate**, không có bảng tương ứng.

---

### 2. `client/src/data/departments.js` (`DEPARTMENTS`)
```
data/departments.js
        ↓
departments
```
Toàn bộ field (`id`, `department_code`, `department_name`) giữ nguyên tên, migrate 1-1.

---

### 3. `client/src/data/students.js` (`INITIAL_STUDENTS`)
```
data/students.js
        ↓
students
```
Toàn bộ field giữ nguyên tên (`student_code`, `full_name`, `gender`, `date_of_birth`, `phone`, `email`, `address`, `department_id`, `major`, `class`, `status`). `user_id` giữ nguyên `null`/số như mock.

---

### 4. `client/src/data/lecturers.js` (`INITIAL_LECTURERS`)
```
data/lecturers.js
        ↓
lecturers
```
Toàn bộ field giữ nguyên tên (`lecturer_code`, `full_name`, `email`, `phone`, `department_id`, `position`, `status`).

---

### 5. `client/src/data/companies.js` (`INITIAL_COMPANIES`)
```
data/companies.js
        ↓
companies
```
Toàn bộ field giữ nguyên tên (`company_code`, `company_name`, `tax_code`, `address`, `phone`, `email`, `website`, `representative`, `status`).

---

### 6. `client/src/data/companyMentors.js` (`COMPANY_MENTORS`)
```
data/companyMentors.js
        ↓
company_mentors
```
Toàn bộ field giữ nguyên tên (`company_id`, `full_name`, `position`, `email`, `phone`, `status`). `user_id` giữ nguyên (chỉ id 1, 2, 7 có giá trị, còn lại `null`).

---

### 7. `client/src/data/internshipPeriods.js` (`INTERNSHIP_PERIODS`)
```
data/internshipPeriods.js
        ↓
internship_periods
```
Toàn bộ field giữ nguyên tên (`period_code`, `period_name`, `start_date`, `end_date`, `status`).

---

### 8. `client/src/data/topics.js` (`TOPICS`)
```
data/topics.js
        ↓
topics
```
Toàn bộ field giữ nguyên tên (`topic_code`, `topic_name`, `description`, `suggested_by_student_id`, `company_id`, `status`).

---

### 9. `client/src/data/internships.js` (`INITIAL_INTERNSHIPS`)
```
data/internships.js
        ↓
internships
```
Toàn bộ field giữ nguyên tên (`student_id`, `period_id`, `company_id`, `company_mentor_id`, `lecturer_id`, `topic_id`, `start_date`, `end_date`, `status`, `progress`). Đây là bảng trung tâm — migrate sau khi `students`/`internship_periods`/`companies`/`company_mentors`/`lecturers`/`topics` đã có dữ liệu.

---

### 10. `client/src/data/internshipLogs.js` (`INITIAL_INTERNSHIP_LOGS`)
```
data/internshipLogs.js
        ↓
internship_logs
```
Toàn bộ field giữ nguyên tên (`internship_id`, `log_date`, `title`, `content`, `result`, `difficulties`, `next_plan`, `note`, `progress`, `attachment`, `lecturer_comment`, `company_comment`, `status`). `attachment` toàn bộ mock là `null` (chưa có upload file thật).

---

### 11. `client/src/data/reports.js` (`INITIAL_REPORTS`)
```
data/reports.js
        ↓
reports
```
Toàn bộ field giữ nguyên tên (`internship_id`, `report_type`, `file_name`, `submitted_at`, `status`, `reviewer_comment`, `company_comment`). `file_name` chỉ là text minh họa, **chưa** có file thật được lưu trữ (không có cột lưu binary/path thực).

---

### 12. `client/src/data/evaluations.js` (`INITIAL_EVALUATIONS`)
```
data/evaluations.js
        ↓
evaluations
```
Toàn bộ field giữ nguyên tên (`internship_id`, `evaluator_role`, `attitude_score`, `skill_score`, `progress_score`, `discipline_score`, `overall_score`, `comment`, `is_published`, `published_at`). **Không có** `evaluator_id` — đúng nguyên tắc đã thống nhất, người đánh giá suy ra từ `internships.lecturer_id`/`internships.company_mentor_id` theo `evaluator_role`.

---

### 13. `client/src/data/notifications.js` (`INITIAL_NOTIFICATIONS`)
```
data/notifications.js
        ↓
notifications
```
Toàn bộ field giữ nguyên tên (`user_id`, `title`, `content`, `type`, `is_read`, `created_at`). Giá trị `type = 'log'` (id 8, 11) được giữ nguyên trong ENUM dù FE (`TYPE_LABEL`) chưa có nhãn hiển thị cho giá trị này (mục I.3 của Database Design — không tự sửa dữ liệu).

---

### 14. `client/src/context/SettingsContext.jsx` (`DEFAULT_SETTINGS`)
```
context/SettingsContext.jsx (DEFAULT_SETTINGS)
        ↓
settings   (1 dòng duy nhất, id = 1)
```
| Frontend field | DB column | Ghi chú |
|---|---|---|
| `systemName` | `system_name` | Đổi tên camelCase → snake_case |
| `systemDescription` | `system_description` | Đổi tên |
| `defaultInternshipPeriodId` | `default_internship_period_id` | Đổi tên, `null` trong mock |
| `allowStudentRegistration` | `allow_student_registration` | Đổi tên, `true` → `1` |

`FRONTEND_VERSION` (hằng số `'1.0.0'`, cùng file) — **display-only**, không migrate, không có cột tương ứng trong `settings` (đúng quyết định tại Database Design mục 10).

---

## Tổng hợp field KHÔNG migrate (chỉ tồn tại phía Frontend)

| Nguồn | Lý do không migrate |
|---|---|
| `data/mockUsers.js` → `ROLE_LABELS`, `ROLE_HOME_PATH` | Hằng số nhãn hiển thị / điều hướng UI, không phải dữ liệu nghiệp vụ |
| `context/SettingsContext.jsx` → `FRONTEND_VERSION` | Hiển thị phiên bản build FE, không phải config nghiệp vụ |
| `utils/internshipStatus.js` → `STATUS_META`, `ALLOWED_TRANSITIONS` | Nhãn tiếng Việt + luật chuyển trạng thái — DB chỉ lưu giá trị ENUM thô (`pending`, `approved`,…), nhãn/luật này vẫn sống ở tầng ứng dụng (FE hiện tại, Backend service layer sau này) |
| `utils/internshipLogStatus.js` → `LOG_STATUS_META` | Tương tự — nhãn hiển thị cho `internship_logs.status` |
| `utils/reportStatus.js` → `REPORT_TYPE_LABEL`, `REPORT_STATUS_META` | Tương tự — nhãn hiển thị cho `reports.report_type`/`status` |

Không có field nào của mock data bị **bỏ sót** khi migrate — mọi field nghiệp vụ thực (không phải hằng số UI) đều có cột tương ứng đúng tên hoặc đúng mapping ở trên.
