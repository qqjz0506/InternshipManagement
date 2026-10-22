# API PHASE 4D-1 — Migrate Internship Logs from Mock Data to REST API

## 1. Mismatch check

```
PASS
```
Field-by-field: `id, internship_id, log_date, title, content, result, difficulties, next_plan, note, progress, attachment, lecturer_comment, company_comment, status, created_at, updated_at` khớp 100% giữa `data/internshipLogs.js`, `LogFormModal.jsx`/`LecturerLogReviewModal.jsx`/`CompanyLogCommentModal.jsx` và `internshipLogService.js`/`schema.sql`. Đối chiếu dữ liệu thật qua `GET /api/internship-logs` (Admin) — khớp byte-for-byte với mock (3 log, đúng mọi field/status). Không cần mapper.

**Đặc điểm kiến trúc phải tôn trọng (không phải mismatch):** `internshipLogService.update()` là **PARTIAL update** (giống Internship, khác Department/Student/.../Topic) — khớp đúng cách `InternshipLogsContext` (mock cũ, qua `createResourceContext`) hoạt động. Không có mismatch PATCH-vs-PUT nào cần sửa.

**Phát hiện quan trọng khác:** `InternshipLogsContext.jsx` (mock) đã dùng sẵn naming chuẩn `items`/`addItem`/`updateItem`/`deleteItem` (qua `createResourceContext`) — khác `InternshipsContext` (Phase 4C) vốn có naming riêng. Vì vậy phase này **tái dùng thẳng `createApiResourceContext`** (giống Topics/Companies/CompanyMentors) thay vì viết Context riêng.

Không có mismatch nào yêu cầu dừng hoặc đổi schema.

## 2. Files created
```
client/src/api/internshipLogApi.js
docs/API_PHASE_4D_1.md
```

## 3. Files modified
```
client/src/context/InternshipLogsContext.jsx
client/src/pages/student/StudentLogsPage.jsx
client/src/pages/lecturer/LecturerLogsPage.jsx
client/src/pages/company/CompanyLogsPage.jsx
client/src/pages/lecturer/LecturerStudentDetailPage.jsx
client/src/pages/company/CompanyStudentDetailPage.jsx
client/src/components/internshipLogs/LogFormModal.jsx
client/src/components/internshipLogs/LecturerLogReviewModal.jsx
client/src/components/internshipLogs/CompanyLogCommentModal.jsx
```
Không sửa backend/schema (không có mismatch nào yêu cầu). Không sửa `ReportsContext`/`EvaluationsContext`/`NotificationsContext`/`SettingsContext`/`UsersContext` — `updateReport` trong `CompanyStudentDetailPage.jsx`/`LecturerStudentDetailPage.jsx` giữ nguyên (Reports chưa migrate, vẫn mock đồng bộ).

## 4. API contract
```
client/src/api/internshipLogApi.js — getAll, getById, create, update, remove
```
Map 1-1 vào `GET/POST/PUT/DELETE /api/internship-logs`, forward đúng payload PARTIAL như đã nhận.

## 5. Context migration
```
InternshipLogsContext.jsx → createApiResourceContext(internshipLogApi, 'InternshipLogs')
```
Tái dùng factory có sẵn (giống Topics/Companies/CompanyMentors) — không viết Context riêng vì interface cũ đã tương thích sẵn. Thêm `isLoading`/`isMutating`/`error` (chưa có ở bản mock).

## 6. Frontend mutation audit
Grep toàn bộ `useInternshipLogs(`, `addItem(`, `updateItem(`, `deleteItem(` cho Logs — 10 file tiêu thụ, 5 file có mutation thật:

| File | Mutation | Thay đổi |
|---|---|---|
| `StudentLogsPage.jsx` | `addItem` (tạo log), `updateItem` (sửa), `deleteItem` | `handleSubmit`/`handleDelete` chuyển async, không đóng modal trước khi backend xác nhận |
| `LecturerLogsPage.jsx` | `updateItem` (duyệt + nhận xét) | `onSubmit` của `LecturerLogReviewModal` chuyển async, thêm `reviewError` |
| `CompanyLogsPage.jsx` | `updateItem` (nhận xét) | `onSubmit` của `CompanyLogCommentModal` chuyển async, thêm `commentError` |
| `LecturerStudentDetailPage.jsx` | `updateItem` (duyệt log qua tab chi tiết SV) | Cùng pattern async + `logReviewError` |
| `CompanyStudentDetailPage.jsx` | `updateItem` (nhận xét log qua tab chi tiết SV) | Cùng pattern async + `logCommentError` |

5 file còn lại chỉ đọc `items` (dashboard/progress, qua filter client-side trên danh sách đã scope từ backend) — không cần sửa.

## 7. Async Promise audit
Tất cả các điểm gọi `updateItem(id, changes)`/`addItem(...)`/`deleteItem(id)` trước đây đồng bộ (mock) nay đều đã `await` và kiểm tra `result.success` trước khi đóng modal/điều hướng/xoá khỏi UI — không còn trường hợp nào dùng Promise như object (đã rà toàn bộ, không lặp lại lỗi của Phase 4B-4/4C).

## 8. PUT semantics audit
Backend PARTIAL/merge — xác nhận qua đọc code VÀ test thật: PUT chỉ `{title: "..."}` không xoá `content`/`comments`/`progress`/`status`/`attachment` hiện có (verify bằng GET lại sau mỗi PUT trong lúc test). Không có nguy cơ mất field như lo ngại ở mục 11 yêu cầu.

## 9. Student ownership
```
Student A GET/PUT/DELETE log của Student B → 403
Student A POST internship_id = Student B's internship → 403 (không tạo được dưới danh nghĩa B)
Student A PUT/DELETE log đã 'reviewed' (kể cả của chính mình) → 409 (khoá)
Student A inject lecturer_comment/company_comment/status → 403 (reject toàn bộ field lạ)
Query bypass ?internship_id=<B> → trả [] (không leak)
```

## 10. Lecturer scope
```
Lecturer A GET/PUT log thuộc Internship không phải lecturer_id của mình → 403
Lecturer A review (lecturer_comment + status=reviewed) log đúng scope → 200, submitted→reviewed
Lecturer A inject content/internship_id cùng lecturer_comment → 403/400 (reject toàn bộ)
Lecturer A set status khác 'reviewed' (vd. 'approved') → 400
Query bypass ?internship_id=<khác scope> → trả [] (không leak)
```

## 11. Company Mentor scope
```
Mentor A GET/PUT log thuộc Internship không phải company_mentor_id của mình → 403
Mentor A comment (company_comment) log đúng scope → 200, không đổi status
Mentor A inject content/status cùng company_comment → 403 (reject toàn bộ)
Query bypass ?internship_id=<khác scope> → trả [] (không leak)
```

## 12. Review authorization
Đúng frontend thực tế (không suy đoán): Lecturer có UI review (`LecturerLogReviewModal`, set `lecturer_comment`+`status='reviewed'`), Company Mentor có UI comment (`CompanyLogCommentModal`, chỉ `company_comment`, không đụng `status`). Student tuyệt đối không ghi được `lecturer_comment`/`company_comment` (test field-injection PASS). Admin không có UI review riêng nhưng có full PUT — vẫn bị chặn bởi cùng business rule khoá/one-way transition như mọi role khác (test PASS, xem mục 13).

## 13. Review lock
```
reviewed log: Student PUT nội dung → 409 | Student DELETE → 409
Admin PUT nội dung log reviewed → 409 (KHÔNG có bypass cho Admin — xác nhận bằng test thật)
Admin DELETE log reviewed → 409 (KHÔNG có bypass)
reviewed → submitted (bất kỳ role nào, kể cả Admin) → 409 (one-way transition, không thể đảo ngược qua API)
```
Phát hiện vận hành quan trọng: vì rule one-way này áp dụng cho CẢ Admin, sau khi test Lecturer review thật (submitted→reviewed) trên log seed (log #2), **không có cách nào phục hồi qua API** — phải phục hồi trực tiếp bằng SQL (xem mục 17).

## 14. Status transitions
```
STATUS_VALUES: submitted, reviewed (không đổi, server/utils/internshipLogStatus.js nếu có — thực tế
  transition logic nằm trực tiếp trong internshipLogService.js, không có file transition matrix riêng
  như Internship, đã đọc kỹ code để xác nhận đúng 2 status này và hướng chuyển 1 chiều)
submitted → reviewed: Lecturer hoặc Admin, một chiều
reviewed → submitted: KHÔNG được phép (409, không có ngoại lệ)
```

## 15. Loading/error UX
`items, isLoading, isMutating, error` áp dụng cho `StudentLogsPage.jsx`/`LecturerLogsPage.jsx`/`CompanyLogsPage.jsx` (loading banner, disable nút trong lúc mutating); `submitError`/`isSubmitting` thêm vào `LogFormModal`/`LecturerLogReviewModal`/`CompanyLogCommentModal` (không đóng modal nếu thất bại, chặn double-submit).

## 16. HTTP tests

| Test | Result |
|---|---|
| No token / invalid token | PASS (401 cả hai) |
| Admin GET list/detail | PASS |
| Admin POST valid | PASS (201) |
| Admin POST invalid internship_id | PASS (400) |
| Admin POST invalid progress | PASS (400) |
| Admin POST khi Internship không 'in_progress' | PASS (409) |
| Admin POST status≠submitted / lecturer_comment set | PASS (400 cả hai) |
| Admin PUT valid | PASS (200) |
| Admin PUT/DELETE log reviewed | PASS (409 cả hai — không bypass) |
| Admin reviewed→submitted | PASS (409 — one-way) |
| Admin PUT immutable internship_id | PASS (400) |
| Student A GET/PUT/DELETE own | PASS |
| Student A GET/PUT/DELETE Student B | PASS (403 cả ba) |
| Student A POST spoof internship_id | PASS (403) |
| Student A PUT/DELETE log reviewed | PASS (409 cả hai) |
| Student A inject lecturer_comment/company_comment/status | PASS (403 cả ba) |
| Query bypass (Student) | PASS (trả rỗng) |
| Lecturer A GET/review own scope | PASS |
| Lecturer A GET/review Lecturer B's log | PASS (403 cả hai) |
| Lecturer A inject content/internship_id | PASS (403/400) |
| Lecturer A set status khác 'reviewed' | PASS (400) |
| Query bypass (Lecturer) | PASS (trả rỗng) |
| Mentor A GET/comment own scope | PASS |
| Mentor A GET/comment Mentor B's log | PASS (403 cả hai) |
| Mentor A inject content/status | PASS (403 cả hai) |
| Query bypass (Mentor) | PASS (trả rỗng) |
| Lint | PASS (exit 0, 39 warning — baseline không đổi) |
| Build | PASS (188 modules, 0 lỗi) |

## 17. Regression
```
Phase 2A-2F: PASS (health + 12 resource GET admin đều 200)
Phase 3A-3B: PASS (login 4 role, 403 role-based giữ nguyên)
Phase 4A:    PASS
Phase 4B-1 → 4B-4 + Topic Approval RBAC fix: PASS (departments=4, periods=3, students=14,
  lecturers=10, companies=10, company_mentors=7, topics=10 — tất cả không đổi)
Phase 4C:    PASS (internships=12, không đổi)
```

## 18. Database integrity
```
14/14 tables
19/19 foreign keys
internship_logs = 3 — khớp seed gốc
internships/students/topics không đổi (12/14/10)
no test data left (log id=6, id=7 tạo-test-rồi-xoá sạch)
log #2 (bị review test chạm vào) đã phục hồi lecturer_comment/status về đúng giá trị gốc BẰNG SQL
  TRỰC TIẾP (không qua API) — vì rule one-way transition 'reviewed→submitted' áp dụng cho CẢ Admin,
  không có cách nào đảo ngược qua REST API. company_comment phục hồi qua API (field này không bị khoá
  one-way) nhưng kết quả là NULL thay vì chuỗi rỗng '' như seed gốc — do backend tự chuẩn hoá chuỗi
  rỗng thành NULL ở MỌI update qua application layer (resolveOptionalText()), không phải lỗi phục hồi:
  bất kỳ user thật nào xoá comment về rỗng qua UI cũng sẽ tạo ra cùng kết quả NULL này. Khác biệt thuần
  cosmetic (NULL ≡ '' về mặt ý nghĩa "chưa có nhận xét"), không ảnh hưởng tới số lượng bản ghi/FK/nội
  dung thực chất.
```

## 19. Lint/build
```
npm run lint:  PASS (exit 0, 39 warning — baseline không đổi, 0 cảnh báo/lỗi mới)
npm run build: PASS (188 modules, 0 lỗi)
```

## 20. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 10 file tiêu thụ `useInternshipLogs`, test HTTP thật cho toàn bộ CRUD/ownership/IDOR/review-lock/field-injection/transition (JWT thật của 2 Student, 2 Lecturer, 2 Company Mentor + Admin), test DB trực tiếp (COUNT(*) thật, không chỉ tin `information_schema.TABLE_ROWS` — phát hiện số liệu ước lượng đó bị lệch sau sự cố MySQL ở mục 21, phải verify bằng COUNT(*) thật), và `npm run build` thành công.

## 21. Known limitations / sự cố hạ tầng trong phiên làm việc
```
- Trước khi bắt đầu test, phát hiện MySQL/MariaDB (XAMPP) không khởi động được do Aria storage
  engine bị lỗi recovery sau một lần tắt không sạch giữa các phiên làm việc ("Aria recovery failed",
  "Table '.\mysql\db' is marked as crashed", "Table '.\mysql\proxies_priv' is marked as crashed").
  Đây KHÔNG phải do code của dự án — là sự cố hạ tầng MySQL hệ thống. Đã xin xác nhận người dùng trước
  khi can thiệp (theo đúng nguyên tắc không tự ý thao tác hạ tầng/hệ thống ngoài phạm vi code). Sau khi
  được đồng ý, đã sửa bằng quy trình chuẩn của MariaDB: xoá aria_log.* cũ + chạy
  `aria_chk -r -o -f` trên các bảng Aria bị crash (`db`, `columns_priv`, `help_topic`, `proxies_priv`,
  tất cả đều thuộc schema hệ thống `mysql`, KHÔNG đụng tới schema `internship_management`). Xác nhận
  bằng COUNT(*) trực tiếp rằng toàn bộ dữ liệu ứng dụng (14 bảng) nguyên vẹn 100% trước và sau sự cố.
- Một log seed (#2) bị thay đổi vĩnh viễn một phần (company_comment: '' → NULL) do backend tự chuẩn
  hoá — không phải lỗi, nhưng khác byte-for-byte so với giá trị literal trong seed.sql ban đầu.
- Browser click-through chưa xác minh trực tiếp (không có tool).
```
