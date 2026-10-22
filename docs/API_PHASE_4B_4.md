# API PHASE 4B-4 — Migrate Topics from Mock Data to REST API

## 1. Scope
Migrate **chỉ** `TopicsContext` sang REST API thật (`/api/topics`). Không migrate Internships/InternshipLogs/Reports/Evaluations/Notifications/Settings/Users.

## 2. Mismatch check

```
PASS (1 blocker RBAC phát hiện — KHÔNG tự sửa, báo cáo + vá tối thiểu phần ảnh hưởng; 1 bug async phát hiện và sửa)
```

**Field-by-field:** `id, topic_code, topic_name, description, suggested_by_student_id, company_id, status, created_at, updated_at` khớp 100% giữa `data/topics.js`, `TopicFormModal.jsx`, `StudentProposeTopicModal.jsx` và `topicService.js`/`schema.sql`. Đối chiếu dữ liệu thật qua `GET /api/topics` (Admin) — khớp byte-for-byte với mock (10 topic, đúng suggested_by_student_id/company_id/status từng dòng). Xác nhận `suggested_by_student_id` và `company_id` **không** bị enforce mutual exclusivity ở backend (đúng Database Design mục I.4, cũng đúng với yêu cầu mục 11) — không tự thêm rule này ở frontend.

**🔴 Blocker phát hiện — mismatch RBAC giữa UI hiện có và backend route policy — ĐÃ RESOLVE (xem mục 18):**
`LecturerStudentDetailPage.jsx` có UI "Duyệt đề tài"/"Từ chối" (`handleTopicDecision`) gọi PUT Topic — nhưng `topicRoutes.js` lúc đó chỉ cho phép `requireRole('admin')` ở PUT, **Lecturer không hề có quyền này ở backend**. Tại thời điểm Phase 4B-4, blocker này được báo cáo và CHƯA tự sửa (chỉ vá async để 403 hiển thị đúng thay vì no-op im lặng). Người dùng sau đó đã quyết định kiến trúc: cấp cho Lecturer quyền **status-only** (chỉ đổi `status` thành `approved`/`rejected`, đúng scope Internship mình phụ trách) — đã triển khai và test đầy đủ, xem **mục 18 — Lecturer Topic Approval (RBAC fix)**.

**Bug async phát hiện và sửa (frontend-only, không phải mismatch field/backend):**
`StudentInternshipPage.jsx::handleProposeNewTopic` gọi `addTopic(...)` rồi dùng ngay `created.id` đồng bộ (`const created = addTopic(...); updateInternship(internship.id, {topic_id: created.id})`) — đúng với mock Context cũ (`addItem` đồng bộ, trả item ngay). Với `createApiResourceContext` (API thật), `addItem` là **async**, trả `Promise<{success, item}>` — nếu không `await`, `created` sẽ là 1 Promise object, `created.id` là `undefined`, dẫn tới `updateInternship(..., {topic_id: undefined})` (internship mất liên kết đề tài hoặc lỗi set state). **Fix:** chuyển `handleProposeNewTopic` sang `async/await`, chỉ gọi `updateInternship` sau khi `addTopic` trả `success: true`, hiển thị lỗi qua modal nếu thất bại (không đóng modal, không optimistic).

## 3. Files created
```
client/src/api/topicApi.js
docs/API_PHASE_4B_4.md
```

## 4. Files modified
```
client/src/context/TopicsContext.jsx
client/src/pages/admin/TopicsPage.jsx
client/src/components/topics/TopicFormModal.jsx
client/src/pages/student/StudentInternshipPage.jsx     (bug async propose-topic — mục 2)
client/src/components/topics/StudentProposeTopicModal.jsx  (thêm submitError/isSubmitting)
client/src/pages/lecturer/LecturerStudentDetailPage.jsx     (blocker RBAC — mục 2 + mục 18)
```

**Files sửa thêm ở bước fix blocker (sau khi có quyết định kiến trúc — xem mục 18):**
```
server/routes/topicRoutes.js
server/controllers/topicController.js
server/services/topicService.js
```

## 5. Topics integration
```
TopicsContext.jsx → createApiResourceContext(topicApi, 'Topics')
```
`GET /api/topics` khi mount — mở cho mọi role đã đăng nhập (không scope theo ownership ở GET, vì Topic là ngân hàng đề tài dùng chung, đúng thiết kế Phase 2C — không phải lỗi thiếu authorization). CRUD Admin qua `TopicsPage.jsx`/`TopicFormModal.jsx` theo pattern loading/error/submitError/isSubmitting giống 4B-1→4B-3.

## 6. Student propose-topic flow
```
StudentProposeTopicModal (chọn đề tài có sẵn HOẶC tự đề xuất)
  → StudentInternshipPage.handleProposeNewTopic (async)
  → TopicsContext.addItem (POST /api/topics, suggested_by_student_id = student.id)
  → backend (topicController.create) ÉP LẠI suggested_by_student_id/company_id/status từ JWT,
    không tin giá trị client gửi dù client đã gửi đúng
  → thành công: updateInternship(internship.id, {topic_id: topic mới}) + đóng modal
  → thất bại: hiển thị lỗi trong modal, KHÔNG đóng, KHÔNG update Internship
```
Test thực tế (JWT thật, không suy luận tĩnh): Student A đề xuất với `suggested_by_student_id` = chính mình → `201`; Student A cố gửi `suggested_by_student_id` = Student B → `403`, backend KHÔNG tạo topic dưới danh nghĩa B (xác nhận qua response + không có topic rác nào gắn B được tạo).

## 7. Ownership / RBAC
```
GET    — mọi role (không scope — Topic là shared reference data)
POST   — Admin (toàn quyền) hoặc Student (chỉ cho chính mình, backend ép identity từ JWT)
PUT    — Admin (toàn quyền) HOẶC Lecturer (CHỈ status, đúng scope — xem mục 18) — Student/CompanyMentor vẫn 403
DELETE — CHỈ Admin
```
Không sửa `authMiddleware`/`scopeService`. `authorizationMiddleware`/route cho PUT đã đổi theo quyết định kiến trúc ở mục 18 (status-only, không phải full PUT).

## 8. Full-payload PUT audit
Rà toàn bộ `updateTopic(...)`/`updateItem` cho Topics trong project:
- `TopicsPage.jsx` (Admin form) — đã gửi full object từ trước (giống Department/Period/Student/Lecturer/Company/CompanyMentor forms), không cần sửa.
- `LecturerStudentDetailPage.jsx::handleTopicDecision` — TRƯỚC đây gửi partial `{status: decision}`. Dù route này 403 với Lecturer ngay ở middleware (payload không bao giờ tới được service), vẫn sửa để gửi full `{...topic, status: decision}` cho đúng nguyên tắc (phòng trường hợp quyền được cấp lại ở phase sau — không để lại 1 quả bom hẹn giờ full-payload khác).
- Không còn nơi nào khác gọi `updateTopic`/`updateItem` cho Topics trong toàn project (đã grep xác nhận 14 file tiêu thụ `useTopics()`, chỉ 3 file có gọi mutation: `TopicsPage.jsx` (add/update/delete), `StudentInternshipPage.jsx` (add), `LecturerStudentDetailPage.jsx` (update)).

## 9. Loading / error handling
`items, isLoading, isMutating, error` — áp dụng cho `TopicsPage.jsx` (banner + disable nút) và `StudentProposeTopicModal.jsx` (submitError + disable nút trong lúc Student đang gửi đề xuất).

## 10. Mock dependency
```
Departments → API
Internship Periods → API
Students → API
Lecturers → API
Companies → API
Company Mentors → API
Topics → API
Others (Internships, InternshipLogs, Reports, Evaluations, Notifications, Settings, Users) → mock
```
`data/topics.js` vẫn còn trên đĩa, không còn consumer (đã grep xác nhận).

## 11. Tests

| Test | Result |
|---|---|
| Topics GET Admin | PASS (200) |
| Topics GET Student | PASS (200 — không scope, đúng thiết kế) |
| Topics GET Lecturer | PASS (200) |
| Topics GET Company Mentor | PASS (200) |
| Admin POST | PASS (201) |
| Admin PUT | PASS (200) |
| Admin DELETE | PASS (test record tạo-rồi-xoá) |
| Validation | PASS (400 thiếu topic_name) |
| Duplicate topic_code | PASS (409) |
| Invalid student FK | PASS (400) |
| Invalid company FK | PASS (400) |
| Student propose own topic | PASS (201) |
| Student spoof another student | PASS (403, không tạo topic dưới danh nghĩa B) |
| Student PUT own/other topic | PASS (403 cả hai — route admin-only, không phải lỗi ownership riêng) |
| Student DELETE own/other topic | PASS (403 cả hai) |
| Query-param bypass | N/A — endpoint không có query scoping theo ownership (chỉ `search`/`status`, không có `?student_id=`/`?company_id=` giới hạn quyền truy cập) |
| Delete referenced topic | PASS (409 — topic id=1 đang dùng bởi internship) |
| 401 no token | PASS |
| 403 unauthorized role (PUT/DELETE non-admin) | PASS |

**Bổ sung sau fix blocker (mục 18):**

| Test | Result |
|---|---|
| Lecturer A duyệt topic đúng scope (proposed→approved) | PASS (200, status đổi, field khác không đổi — verify DB) |
| Lecturer A từ chối topic đúng scope (proposed→rejected) | PASS (200, verify DB) |
| Lecturer B (sai scope) duyệt topic của Lecturer A | PASS (403) |
| Lecturer field injection: status + topic_name | PASS (403, reject toàn bộ request) |
| Lecturer field injection: status + topic_code | PASS (403) |
| Lecturer field injection: status + suggested_by_student_id | PASS (403) |
| Lecturer field injection: status + company_id | PASS (403) |
| Lecturer gửi status ngoài approved/rejected (vd. 'proposed') | PASS (400) |
| Lecturer duyệt lại topic đã không còn 'proposed' | PASS (403 — one-way transition) |
| Student duyệt/từ chối topic | PASS (403, route-level) |
| Company Mentor duyệt/từ chối topic | PASS (403, route-level) |
| Admin full CRUD topic (regression) | PASS (full-payload PUT vẫn hoạt động đúng) |

## 12. Database integrity
```
14/14 tables
19/19 foreign keys
topics = 10 (khớp seed gốc)
internships = 12 (không đổi)
topic_code UNIQUE — xác nhận 0 trùng lặp
no test data left (topic id=14 tạo-rồi-xoá sạch)
```

## 13. Regression
```
Phase 2A-2F: PASS (health + 12 resource GET admin đều 200)
Phase 3A-3B: PASS (login 4 role, 403 role-based giữ nguyên)
Phase 4A:    PASS
Phase 4B-1:  PASS (departments=4, periods=3)
Phase 4B-2:  PASS (students=14, lecturers=10)
Phase 4B-3:  PASS (companies=10, company_mentors=7)
```

## 14. Lint / Build
```
npm run lint:  PASS (exit 0, 39 warning — baseline không đổi, 0 mới)
npm run build: PASS (188 modules, 0 lỗi)
```

## 15. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 14 file tiêu thụ `useTopics()`, test HTTP thật cho toàn bộ CRUD/ownership/IDOR/spoof-protection, test DB trực tiếp, `npm run build` thành công. Phân biệt rõ: HTTP verification (PASS, có bằng chứng) ≠ DB verification (PASS, có bằng chứng) ≠ browser click-through (KHÔNG làm được, không claim).

## 16. Known limitations
```
- BLOCKER ở Phase 4B-4 ĐÃ RESOLVE — xem mục 18. (Lịch sử: Lecturer UI "Duyệt/Từ chối đề tài"
  (LecturerStudentDetailPage.jsx) từng luôn nhận 403 vì route PUT chỉ cho admin; đã được cấp quyền
  status-only có scope, không phải mở full PUT.)
- Query-param bypass test không áp dụng được cho Topics vì endpoint này vốn không có tham số scope
  theo quyền sở hữu (thiết kế từ Phase 2C: Topic là ngân hàng đề tài dùng chung toàn hệ thống).
- Lecturer chỉ có thể hành động khi topic đang ở status 'proposed' (one-way transition, giống pattern
  evaluation publish ở Phase 3B) — nếu Admin đã tự duyệt/từ chối trước, Lecturer không còn tác động
  được nữa (phải nhờ Admin đổi lại qua full PUT nếu cần duyệt lại).
- Browser click-through chưa xác minh trực tiếp (không có tool).
```

## 17. Deferred work
Không migrate thêm Context nào khác trong phase này (đúng mục 20). Khuyến nghị phase sau (nếu migrate `InternshipsContext`) đối chiếu kỹ lại ownership cho các thao tác tương tự khác trên `LecturerStudentDetailPage.jsx` (log/report review) khi Internships thật sự chuyển sang API.

## 18. Lecturer Topic Approval (RBAC fix — sau Phase 4B-4)

### Quyết định kiến trúc
```
Admin           → full Topic CRUD (không đổi)
Student         → POST topic của chính mình (không đổi)
Lecturer (MỚI)  → PUT CHỈ { status }, giá trị CHỈ approved/rejected, CHỈ cho Topic đang 'proposed'
                   VÀ đang gắn với 1 Internship do chính Lecturer đó hướng dẫn
Student/CompanyMentor → vẫn không được approve/reject (403)
```
Đây là **status-only authorization qua cùng 1 endpoint hiện có** (`PUT /api/topics/:id`), theo đúng pattern đã có sẵn trong codebase (`internshipLogService`/`reportService` dùng `LECTURER_EDITABLE_FIELDS`/`COMPANY_EDITABLE_FIELDS` để giới hạn field theo role trên cùng 1 route) — **không tạo endpoint riêng** (`PUT /api/topics/:id/status`), để nhất quán kiến trúc toàn hệ thống thay vì phát minh thêm 1 kiểu route mới.

### Endpoint
```
PUT /api/topics/:id   (route không đổi — route tier: requireRole('admin', 'lecturer'))
```

### Lecturer scope rule
```
EXISTS (SELECT 1 FROM internships WHERE topic_id = :topicId AND lecturer_id = :ownLecturerId)
```
**Không** dùng `suggested_by_student_id` để suy ra quyền (1 Lecturer bất kỳ không mặc nhiên có quyền duyệt đề tài do 1 Student bất kỳ đề xuất). Quyền chỉ phát sinh khi Topic đó đang thực sự được gắn vào 1 Internship (`internships.topic_id`) do chính Lecturer đang hướng dẫn (`internships.lecturer_id`) — đúng tinh thần `LecturerStudentDetailPage.jsx` (trang chỉ mở được cho Internship thuộc phạm vi Lecturer, xem `useMyAssignedInternships`).

### Allowed fields (Lecturer)
```
status  — CHỈ 2 giá trị: approved, rejected
```

### Forbidden fields (Lecturer) — reject toàn bộ request, không silently bỏ qua
```
topic_code, topic_name, description, suggested_by_student_id, company_id
```
Gửi kèm bất kỳ field nào ở trên cùng `status` → `403 "Giảng viên không được sửa field: <tên field>."` — toàn bộ request bị từ chối (không có chuyện 200 rồi lặng lẽ bỏ qua field lạ).

### Business rule bổ sung
```
Chỉ cho phép hành động khi topic.status hiện tại === 'proposed' (one-way transition, giống pattern
evaluation publish Phase 3B — Lecturer không "undo" được quyết định của mình hay của Admin).
```

### Backend changes
```
server/routes/topicRoutes.js        — PUT: requireRole('admin', 'lecturer')
server/controllers/topicController.js — validateLecturerStatusPayload() (reject field lạ, validate
                                        status ∈ {approved, rejected}); update() route theo role
server/services/topicService.js     — canLecturerApproveTopic(topicId, lecturerId) (JOIN internships);
                                        update(id, payload, currentUser) branch riêng cho lecturer
                                        (check scope + status==='proposed' + UPDATE chỉ cột status),
                                        nhánh admin giữ nguyên 100% logic cũ
```

### Frontend changes
```
client/src/pages/lecturer/LecturerStudentDetailPage.jsx
  - handleTopicDecision gửi ĐÚNG { status: decision } (không gửi full topic nữa — đúng contract mới)
  - disable nút Duyệt/Từ chối khi isMutating (tránh double-click)
  - lỗi backend (403/400/409) hiển thị qua window.alert, không optimistic update
```

### Security tests
Xem bảng bổ sung ở mục 11 — toàn bộ PASS, test bằng JWT thật của 2 Lecturer khác nhau (lecturer@example.com/lecturer2@example.com), verify bằng DB trực tiếp (không chỉ tin response JSON) rằng `topic_code`/`topic_name`/`description`/`suggested_by_student_id`/`company_id` không đổi sau khi Lecturer duyệt, chỉ `status` thay đổi.

### Lưu ý vận hành
Backend chạy bằng `node server.js` (không có file-watcher/nodemon trong môi trường test) — đã restart thủ công sau khi sửa code backend để đảm bảo test phản ánh đúng code mới.

### Sự cố nhỏ trong lúc test (đã khắc phục, không ảnh hưởng kết quả cuối)
Khi dùng `curl` với tiếng Việt gõ trực tiếp trong Bash argument để "khôi phục" topic 6 về trạng thái ban đầu, ký tự bị mã hoá sai (lỗi công cụ dòng lệnh đã biết từ Phase 4B-1) và **vô tình ghi đè dữ liệu sai vào topic_name/description của topic 6 — một bản ghi seed thật**, không phải bản ghi test. Phát hiện ngay lập tức, khắc phục bằng cách ghi payload ra file UTF-8 rồi gửi lại bằng `--data-binary @file`; đã verify lại bằng SQL trực tiếp xác nhận topic 6 khớp 100% với dữ liệu seed gốc (`Tối ưu hóa quy trình CI/CD cho dự án phần mềm` / `Xây dựng pipeline CI/CD tự động triển khai ứng dụng.`).
