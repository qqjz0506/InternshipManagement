# API PHASE 4D-2 — Migrate Reports from Mock Data to REST API

## 1. Mismatch check

```
PASS (1 mismatch thật phát hiện — sửa tối thiểu ở frontend, không sửa backend/schema)
```
Field-by-field: `id, internship_id, report_type, file_name, submitted_at, status, reviewer_comment, company_comment, created_at, updated_at` khớp 100% giữa `data/reports.js`, `ReportFormModal.jsx`/`LecturerReportReviewModal.jsx`/`CompanyReportCommentModal.jsx` và `reportService.js`/`schema.sql`. `file_name` KHÔNG bị biến thành upload file thật — vẫn chỉ là chuỗi minh họa do client nhập, đúng yêu cầu mục 13 (không thêm multer/S3/storage nào). Đối chiếu dữ liệu thật qua `GET /api/reports` (Admin) — khớp byte-for-byte với mock (2 report).

**Mismatch thật phát hiện (frontend-only, đã sửa):** `StudentReportsPage.jsx::handleSubmit` gửi kèm `submitted_at: new Date().toISOString().slice(0,10)` khi tạo báo cáo mới — nhưng backend (`reportService.create()`) **reject cứng** bất kỳ `submitted_at` nào trong payload (`if (submitted_at !== undefined) throw 400`, vì ngày nộp luôn do server tự sinh qua `todayDateString()`). Nếu không sửa, MỌI lần Student nộp báo cáo qua Frontend thật sẽ luôn nhận `400` — tính năng nộp báo cáo sẽ hoàn toàn không hoạt động. **Fix:** bỏ `submitted_at` khỏi payload gửi lên, để backend tự sinh (đúng tinh thần "server authoritative" đã áp dụng nhất quán cho mọi field tương tự ở các phase trước — Topic ép `suggested_by_student_id`, Internship ép `status='pending'`, v.v.). Không sửa backend, không sửa schema — đây là lỗi 1 chiều của frontend cũ (viết từ thời còn mock, mock tự set ngày phía client).

Không có mismatch nào khác yêu cầu dừng.

## 2. Files created
```
client/src/api/reportApi.js
docs/API_PHASE_4D_2.md
```

## 3. Files modified
```
client/src/context/ReportsContext.jsx
client/src/pages/student/StudentReportsPage.jsx           (mismatch fix — mục 1)
client/src/pages/lecturer/LecturerReportsPage.jsx
client/src/pages/company/CompanyReportsPage.jsx
client/src/pages/admin/AdminReportsPage.jsx
client/src/pages/admin/AdminReportDetailPage.jsx
client/src/pages/lecturer/LecturerStudentDetailPage.jsx   (phần Report còn lại từ Phase 4D-1)
client/src/pages/company/CompanyStudentDetailPage.jsx     (phần Report còn lại từ Phase 4D-1)
client/src/components/reports/ReportFormModal.jsx
client/src/components/reports/LecturerReportReviewModal.jsx
client/src/components/reports/CompanyReportCommentModal.jsx
```
Không sửa backend/schema. Không sửa `EvaluationsContext`/`NotificationsContext`/`SettingsContext`/`UsersContext`.

## 4. API contract
```
client/src/api/reportApi.js — getAll, getById, create, update, remove
```
Map 1-1 vào `GET/POST/PUT/DELETE /api/reports`, forward đúng payload PARTIAL.

## 5. Context migration
```
ReportsContext.jsx → createApiResourceContext(reportApi, 'Reports')
```
Tái dùng factory có sẵn (naming `items`/`addItem`/`updateItem`/`deleteItem` đã tương thích sẵn, giống InternshipLogs/Topics). Thêm `isLoading`/`isMutating`/`error`.

## 6. Frontend mutation audit
Grep toàn bộ `useReports(`, mutation calls — 13 file tiêu thụ, 6 file có mutation thật:

| File | Mutation | Thay đổi |
|---|---|---|
| `StudentReportsPage.jsx` | `addItem` (nộp báo cáo) | async, bỏ `submitted_at` (mismatch), thêm `submitError`/loading |
| `LecturerReportsPage.jsx` | `updateItem` (duyệt + nhận xét) | async, `reviewError` |
| `CompanyReportsPage.jsx` | `updateItem` (nhận xét) | async, `commentError` |
| `AdminReportDetailPage.jsx` | `updateItem` (đổi status) | async, `window.alert` khi fail, thêm `isLoading` guard trước "không tìm thấy" |
| `LecturerStudentDetailPage.jsx` | `updateReport` (duyệt qua tab chi tiết SV) | async, `reportReviewError` |
| `CompanyStudentDetailPage.jsx` | `updateReport` (nhận xét qua tab chi tiết SV) | async, `reportCommentError` |

7 file còn lại (`StudentProgressPage`, dashboards, `AdminReportsPage` chỉ đọc) chỉ đọc `items` — `AdminReportsPage.jsx` được thêm `isLoading`/`error` display cho nhất quán dù không có mutation.

## 7. Async Promise audit
Toàn bộ điểm gọi `addItem`/`updateItem` trước đây đồng bộ (mock) nay đã `await` + kiểm tra `result.success` trước khi đóng modal/điều hướng — không còn Promise-as-object.

## 8. PUT semantics
Backend PARTIAL/merge (giống Internship/InternshipLog) — xác nhận qua code VÀ test thật (PUT chỉ `{status}` hoặc chỉ `{company_comment}` không làm mất field khác, verify bằng GET lại sau mỗi lần PUT).

## 9. Student ownership
```
Student A GET/DELETE report của Student B → 403
Student A POST spoof internship_id = Student B's internship → 403, không tạo được dưới danh nghĩa B
Student A PUT bất kỳ report nào (kể cả của chính mình) → 403 (route không cấp PUT cho Student — đúng
  "Sinh viên không có quyền sửa báo cáo sau khi đã nộp", xác nhận từ comment trong chính service)
Query bypass ?internship_id=<B> → trả [] (không leak)
```

## 10. Lecturer scope
```
Lecturer A GET/review report ngoài lecturer_id của mình → 403
Lecturer A review đúng scope (status + reviewer_comment) → 200
Lecturer A inject company_comment → 403 (reject toàn bộ)
Lecturer A set status ngoài {submitted, approved, rejected} (vd. 'draft') → 400
Query bypass ?internship_id=<khác scope> → trả [] (không leak)
```

## 11. Company Mentor scope
```
Mentor A GET/comment report ngoài company_mentor_id của mình → 403
Mentor A comment đúng scope (company_comment only) → 200
Mentor A inject status/reviewer_comment → 403 (reject toàn bộ)
Query bypass ?internship_id=<khác scope> → trả [] (không leak)
```

## 12. Review authorization
Đúng frontend thực tế: Lecturer có UI đổi `status`+`reviewer_comment` (`LecturerReportReviewModal`), Company Mentor chỉ có UI `company_comment` (`CompanyReportCommentModal`), Admin có full PUT (không bị whitelist field nhưng vẫn qua validate `status` enum). Student hoàn toàn không có PUT — test field-injection (`reviewer_comment`/`company_comment`) của Student đều bị chặn ở tầng route (403, không tới được service).

## 13. Status rules
```
STATUS_VALUES (schema): draft, submitted, approved, rejected
SETTABLE_STATUSES (thực tế dùng được qua API): submitted, approved, rejected — 'draft' tồn tại trong
  enum DB nhưng KHÔNG UI nào (Student/Lecturer/Admin) cho set giá trị này, đã xác nhận qua đọc code,
  không tự đoán/thêm. Không có transition matrix tường minh (khác Internship/InternshipLog) — bất kỳ
  giá trị nào trong SETTABLE_STATUSES đều được chuyển tới trực tiếp, không có khoá one-way hay lock
  nội dung nào (khác InternshipLogs — Reports KHÔNG có review lock, không tự thêm chỉ vì Logs có).
```

## 14. File/filename semantics
`file_name` giữ nguyên là chuỗi minh họa do client tự nhập (không có input "chọn file" thật, không có validate định dạng/extension ngoài required). Không thêm multer/filesystem storage/S3/Cloudinary/Firebase/upload-download API nào trong phase này.

## 15. Loading/error UX
`items, isLoading, isMutating, error` áp dụng cho `StudentReportsPage.jsx`/`LecturerReportsPage.jsx`/`CompanyReportsPage.jsx`/`AdminReportsPage.jsx`/`AdminReportDetailPage.jsx`; `submitError`/`isSubmitting` thêm vào cả 3 modal (không đóng modal nếu thất bại, chặn double-submit).

## 16. HTTP tests

| Test | Result |
|---|---|
| No token / invalid token | PASS (401 cả hai) |
| Admin GET list/detail | PASS |
| Admin POST invalid internship_id/report_type/submitted_at | PASS (400 cả ba) |
| Admin POST valid | PASS (201) |
| Admin PUT valid (status) | PASS (200) |
| Admin PUT invalid status value | PASS (400) |
| Admin PUT immutable internship_id/report_type/file_name/submitted_at | PASS (400 cả bốn) |
| Admin DELETE | PASS (test record tạo-rồi-xoá) |
| Student A GET own | PASS |
| Student A GET/DELETE Student B | PASS (403 cả hai) |
| Student A POST spoof internship_id | PASS (403) |
| Student A PUT (bất kỳ) | PASS (403, route-level) |
| Student A inject reviewer_comment/company_comment | PASS (403, route-level) |
| Query bypass (Student) | PASS (trả rỗng) |
| Lecturer A GET/review own scope | PASS |
| Lecturer A GET/review Lecturer B | PASS (403 cả hai) |
| Lecturer A inject company_comment | PASS (403) |
| Lecturer A inject internship_id | PASS (400, immutable check trước) |
| Lecturer A invalid status value | PASS (400) |
| Query bypass (Lecturer) | PASS (trả rỗng) |
| Mentor A GET/comment own scope | PASS |
| Mentor A GET/comment Mentor B | PASS (403 cả hai) |
| Mentor A inject status/reviewer_comment | PASS (403 cả hai) |
| Query bypass (Mentor) | PASS (trả rỗng) |
| Lint | PASS (exit 0, 39 warning — baseline không đổi) |
| Build | PASS (188 modules, 0 lỗi) |

## 17. Regression
```
Phase 2A-2F: PASS (health + 12 resource GET admin đều 200)
Phase 3A-3B: PASS (login 4 role, 403 role-based giữ nguyên)
Phase 4A:    PASS
Phase 4B-1 → 4B-4 + Topic Approval RBAC fix: PASS (departments=4, periods=3, students=14,
  lecturers=10, companies=10, company_mentors=7, topics=10 — không đổi)
Phase 4C:    PASS (internships=12, không đổi)
Phase 4D-1:  PASS (internship_logs=3, log #1 vẫn 'reviewed' — review lock không bị phá)
```

## 18. Database integrity
```
14/14 tables
19/19 foreign keys
reports = 2 — khớp seed gốc byte-for-byte (verify trực tiếp qua SQL sau khi phục hồi)
internships/internship_logs không đổi (12/3)
no test data left (report id=6 [Admin], id=7 [Student A] tạo-test-rồi-xoá sạch)
```

Sự cố trong lúc test: khi dùng `curl` với tiếng Việt gõ trực tiếp trong Bash argument để test Lecturer
review (báo cáo #1, `reviewer_comment`), ký tự bị mã hoá sai (lỗi công cụ dòng lệnh đã biết từ Phase
4B-1/Topic Approval fix) và ghi đè dữ liệu sai vào MỘT BẢN GHI SEED THẬT. Phát hiện ngay lập tức,
khắc phục bằng file UTF-8 + `--data-binary @file` (đúng quy tắc mục 15 của yêu cầu: "dùng UTF-8 file
payload, không inline Bash argument"); verify lại bằng SQL trực tiếp xác nhận report #1 khớp 100% với
seed gốc (`status=approved`, `reviewer_comment`/`company_comment` đúng nguyên văn).

## 19. Lint/build
```
npm run lint:  PASS (exit 0, 39 warning — baseline không đổi, 0 cảnh báo/lỗi mới)
npm run build: PASS (188 modules, 0 lỗi)
```

## 20. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 13 file tiêu thụ `useReports`, test HTTP thật cho toàn bộ CRUD/ownership/IDOR/review-authorization/field-injection (JWT thật của 2 Student, 2 Lecturer, 2 Company Mentor + Admin), test DB trực tiếp (COUNT(*) thật), và `npm run build` thành công.

## 21. Known limitations
```
- Reports KHÔNG có review lock / one-way status transition như InternshipLogs — đây là đặc điểm
  backend hiện tại (xác nhận qua đọc code, không phải thiếu sót của phase này), nên Admin/Lecturer có
  thể đổi qua lại giữa submitted/approved/rejected tự do, không bị khoá sau khi "approved".
- 'draft' status tồn tại trong DB enum nhưng không có UI nào tạo/set được giá trị này qua ứng dụng
  thật — không tự thêm UI cho trạng thái này (ngoài phạm vi phase).
- file_name vẫn chỉ là text minh họa, không có upload file thật — đúng yêu cầu, không tự mở rộng.
- Browser click-through chưa xác minh trực tiếp (không có tool).
```
