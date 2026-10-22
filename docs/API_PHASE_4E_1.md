# API PHASE 4E-1 — Migrate Evaluations from Mock Data to REST API

## 1. Mismatch check

```
PASS (2 mismatch thật phát hiện — sửa tối thiểu ở frontend, không sửa backend/schema)
```
Field-by-field: `id, internship_id, evaluator_role, attitude_score, skill_score, progress_score, discipline_score, overall_score, comment, is_published, published_at, created_at, updated_at` khớp 100% giữa `data/evaluations.js`, `LecturerEvaluationForm.jsx`/`CompanyEvaluationForm.jsx`/`AdminEvaluationDetailPage.jsx` và `evaluationService.js`/`schema.sql`. **Không có `evaluator_id`** ở cả 2 phía — evaluator identity suy ra hoàn toàn từ `internship.lecturer_id`/`internship.company_mentor_id` qua `evaluator_role`, đúng model yêu cầu, không tự thêm field. Đối chiếu dữ liệu thật qua `GET /api/evaluations` (Admin) — khớp byte-for-byte với mock (2 evaluation).

**Mismatch #1 — nghiêm trọng, chặn hoàn toàn flow "sửa nháp" (đã sửa, frontend-only):**
`LecturerEvaluationForm.jsx`/`CompanyEvaluationForm.jsx::handleSave` khi `existing` (sửa đánh giá nháp đã tồn tại) gửi NGUYÊN payload đầy đủ bao gồm cả `internship_id` và `evaluator_role` tới `updateItem(existing.id, payload)` — nhưng backend (`evaluationService.update()`) coi CẢ HAI field này là **immutable**, reject cứng 400 nếu có mặt trong payload update. Nếu không sửa, MỌI lần Lecturer/Company Mentor bấm "Lưu nháp" trên 1 đánh giá đã tồn tại (chưa công bố) sẽ luôn nhận 400 — tính năng sửa nháp hoàn toàn không hoạt động (chỉ tạo mới lần đầu mới work). **Fix:** tách rõ 2 nhánh — `addItem` (tạo mới) vẫn gửi đủ `internship_id`+`evaluator_role`+`is_published:false`+`published_at:null`; `updateItem` (sửa) chỉ gửi đúng các field điểm số + `comment`, không gửi lại 2 field immutable.

**Mismatch #2 — UI không phản ánh đúng trạng thái "đã công bố" (đã sửa, frontend-only):**
`LecturerEvaluationForm.jsx`/`CompanyEvaluationForm.jsx` tính `isPublished = existing?.is_published === true` — nhưng MySQL trả `is_published` dạng `TINYINT` (`0`/`1`, qua `mysql2`), không phải `true`/`false` JS thật. So sánh `=== true` với giá trị `1` luôn `false`, khiến form LUÔN coi đánh giá là "chưa công bố" dù thực tế đã công bố — input vẫn mở, nút "Lưu nháp"/"Công bố" vẫn hiện, mọi thao tác sửa sẽ bị backend từ chối 409 ("Đánh giá đã công bố") nhưng UI không hề khoá trước. Đây không phải lỗ hổng bảo mật (backend vẫn chặn đúng) nhưng là UX sai hoàn toàn. **Fix:** đổi thành `Boolean(existing?.is_published)` — xử lý đúng cả `1`/`0` và `true`/`false`.

Không có mismatch nào khác yêu cầu dừng. Không tự thêm `evaluator_id`, không tự thêm status, không tự thêm weighting.

## 2. Files created
```
client/src/api/evaluationApi.js
docs/API_PHASE_4E_1.md
```

## 3. Files modified
```
client/src/context/EvaluationsContext.jsx
client/src/components/evaluations/LecturerEvaluationForm.jsx   (mismatch #1 + #2)
client/src/components/evaluations/CompanyEvaluationForm.jsx    (mismatch #1 + #2)
client/src/pages/admin/AdminEvaluationDetailPage.jsx
client/src/pages/admin/AdminEvaluationsPage.jsx
client/src/pages/lecturer/LecturerEvaluationsPage.jsx
client/src/pages/company/CompanyEvaluationsPage.jsx
client/src/pages/student/StudentEvaluationsPage.jsx
```
Không sửa backend/schema. Không sửa `NotificationsContext`/`SettingsContext`/`UsersContext`.

## 4. API contract
```
client/src/api/evaluationApi.js — getAll, getById, create, update, remove
```
Map 1-1 vào `GET/POST/PUT/DELETE /api/evaluations`. Publish/unpublish dùng chung `update()` (không có action endpoint riêng — đúng backend hiện tại).

## 5. Context migration
```
EvaluationsContext.jsx → createApiResourceContext(evaluationApi, 'Evaluations')
```
Tái dùng factory có sẵn (naming `items`/`addItem`/`updateItem`/`deleteItem` đã tương thích sẵn). Thêm `isLoading`/`isMutating`/`error`.

## 6. Evaluator identity model
```
evaluation.evaluator_role = 'lecturer'  → evaluator = internship.lecturer_id
evaluation.evaluator_role = 'company'   → evaluator = internship.company_mentor_id
```
Không có `evaluator_id` ở bất kỳ đâu trong code/schema — xác nhận qua đọc toàn bộ `evaluationService.js`/`schema.sql`/`data/evaluations.js`. Không tự thêm.

## 7. Lecturer scope
```
GET/PUT chỉ evaluation có evaluator_role='lecturer' AND internship.lecturer_id = ownLecturerId
Create: evaluator_role bị ép cứng = 'lecturer' từ role tài khoản (gửi role khác → 403), internship
  phải thuộc phạm vi (internship.lecturer_id = own) — sai phạm vi → 403
Publish: chỉ 1 chiều (publish được, KHÔNG unpublish được — chỉ Admin) — test cả publish own (PASS)
  và unpublish own-đã-publish (403) đều đúng
```

## 8. Company Mentor scope
```
GET/PUT chỉ evaluation có evaluator_role='company' AND internship.company_mentor_id = ownMentorId
Create: evaluator_role bị ép cứng = 'company', internship phải thuộc phạm vi
Publish: cùng rule 1 chiều như Lecturer
```
Xác nhận Lecturer evaluation và Company evaluation COEXIST đúng trên cùng 1 Internship (test tạo cả 2 cho internship1, không xung đột).

## 9. Student read-only scope
```
GET: chỉ evaluation evaluator ĐÃ công bố (is_published=1) thuộc Internship của chính mình — kể cả
  evaluation thuộc internship của chính Student đó nhưng CHƯA công bố cũng KHÔNG xem được (test xác
  nhận: Student B với eval2 chưa công bố thuộc chính internship của mình → list rỗng)
POST/PUT/DELETE/publish: 403 toàn bộ (route-level, Student không nằm trong requireRole nào ngoài GET)
Không có UI mutation nào cho Student — đúng thực tế (chỉ đọc).
```

## 10. Admin scope
```
Full CRUD theo business rules — KHÔNG bypass: duplicate (internship_id,evaluator_role), score range,
  internship status gate (in_progress/completed), published lock (kể cả Admin cũng không sửa được
  điểm/comment khi đã published), immutable fields (internship_id, evaluator_role)
Admin là role DUY NHẤT được cả 2 chiều publish/unpublish (xác nhận qua code + test thật)
```

## 11. Unique constraint
```
UNIQUE(internship_id, evaluator_role) — test: tạo lecturer eval trùng internship đã có → 409;
  tạo company eval trên CÙNG internship đã có lecturer eval → 201 (coexist OK, không bị unique chặn
  nhầm vì khác evaluator_role)
```

## 12. Score validation
```
0 → PASS (boundary), 10 → PASS (boundary), -1 → 400, 11 → 400
Không tự thêm weighting giữa Lecturer/Company — mỗi evaluation có overall_score riêng, Admin tự đối
  chiếu (đúng UI hiện tại ở AdminEvaluationDetailPage.jsx — không có công thức gộp điểm).
```

## 13. Publish/unpublish rules
```
Lecturer/Company Mentor: publish (false→true) ĐƯỢC, unpublish (true→false) BỊ CHẶN (403, "chỉ Admin
  được phép") — đúng Phase 3B, re-verify lại bằng test thật ở Phase 4E-1 (không suy đoán).
Admin: cả 2 chiều đều được (đã test publish rồi unpublish liên tiếp, PASS cả hai).
```

## 14. Published lock
```
touchesScoreOrComment && existing.is_published → 409 cho MỌI role kể cả Admin (test: Admin PUT
  attitude_score trên eval đã publish → 409). Không có cách "unpublish trước rồi edit" dành riêng —
  backend cho phép (Admin unpublish rồi mới sửa được), đã test đúng chuỗi unpublish→edit vẫn theo
  đúng flow (không test riêng vì không phải yêu cầu bắt buộc, nhưng code xác nhận hợp lệ: sau khi
  is_published=0 thì touchesScoreOrComment check không còn chặn).
```

## 15. Immutable fields
```
internship_id, evaluator_role — cả 2 đều bị reject 400 nếu có mặt trong payload UPDATE (test riêng
  từng field, cả 2 đều PASS).
```

## 16. Async mutation audit
Tất cả điểm gọi `addItem`/`updateItem` trong `LecturerEvaluationForm.jsx`/`CompanyEvaluationForm.jsx`/`AdminEvaluationDetailPage.jsx` (trước đây đồng bộ, mock) nay đã `await` + kiểm tra `result.success` trước khi đóng modal — không còn Promise-as-object.

## 17. PUT semantics
Backend PARTIAL/merge (giống Internship/Log/Report) — xác nhận qua code VÀ test thật (PUT chỉ `{is_published}` không làm mất score/comment hiện có, verify bằng GET lại).

## 18. Loading/error UX
`items, isLoading, isMutating, error` áp dụng cho cả 5 page tiêu thụ chính (`AdminEvaluationsPage`, `AdminEvaluationDetailPage`, `LecturerEvaluationsPage`, `CompanyEvaluationsPage`, `StudentEvaluationsPage`); `isMutating` disable nút Lưu/Công bố trong 2 Form + nút Công bố/Bỏ công bố ở Admin Detail; lỗi hiển thị qua `error` state có sẵn trong form (field validation) hoặc `window.alert` (Admin toggle).

## 19. HTTP tests

| Test | Result |
|---|---|
| No token / invalid token | PASS (401 cả hai) |
| Admin GET list/detail | PASS |
| Admin POST missing/invalid evaluator_role | PASS (400 cả hai) |
| Admin POST internship không in_progress/completed | PASS (409) |
| Admin POST duplicate (internship_id, evaluator_role) | PASS (409) |
| Admin POST score ngoài 0-10 (âm, >10) | PASS (400 cả hai) |
| Admin POST company eval coexist với lecturer eval cùng internship | PASS (201) |
| Admin PUT immutable internship_id/evaluator_role | PASS (400 cả hai) |
| Admin publish → edit score (locked) → unpublish | PASS (200/409/200) |
| Admin DELETE | PASS (test record tạo-rồi-xoá) |
| Lecturer A GET/create/publish own scope | PASS |
| Lecturer A GET/update/publish Lecturer B | PASS (403 cả ba) |
| Lecturer A spoof evaluator_role=company | PASS (403) |
| Lecturer A create ngoài phạm vi (internship của Lecturer B) | PASS (403) |
| Lecturer A unpublish own đã publish | PASS (403) |
| Query bypass (Lecturer) | PASS (trả rỗng) |
| Mentor A GET/create/publish own scope | PASS |
| Mentor A GET/update/publish Mentor B | PASS (403 cả ba) |
| Mentor A spoof evaluator_role=lecturer | PASS (403) |
| Mentor A create ngoài phạm vi | PASS (403) |
| Mentor A unpublish own đã publish | PASS (403) |
| Query bypass (Mentor) | PASS (trả rỗng) |
| Student A GET own (published) | PASS |
| Student A GET B's (unpublished) | PASS (403) |
| Student B GET own nhưng CHƯA công bố | PASS (rỗng — không tự xem được bản nháp của chính mình) |
| Student POST/PUT/DELETE/publish | PASS (403 route-level, cả bốn) |
| Query bypass (Student) | PASS (trả rỗng) |
| Lint | PASS (exit 0, 39 warning — baseline không đổi) |
| Build | PASS (188 modules, 0 lỗi) |

## 20. Regression
```
Phase 2A-2F: PASS (health + 12 resource GET admin đều 200)
Phase 3A-3B: PASS (login 4 role, 403 role-based giữ nguyên)
Phase 4A:    PASS
Phase 4B-1 → 4B-4 + Topic Approval RBAC fix: PASS (departments=4, periods=3, students=14,
  lecturers=10, companies=10, company_mentors=7, topics=10 — không đổi)
Phase 4C:    PASS (internships=12, không đổi)
Phase 4D-1:  PASS (internship_logs=3, log #1 vẫn 'reviewed')
Phase 4D-2:  PASS (reports=2, report #1 vẫn 'approved')
```

## 21. Database integrity
```
14/14 tables
19/19 foreign keys
evaluations = 2 — khớp seed gốc byte-for-byte
UNIQUE(internship_id, evaluator_role) — xác nhận 0 vi phạm sau toàn bộ test
internships/reports/internship_logs không đổi (12/2/3)
no test data left (eval id 7/8/9 tạo-test-rồi-xoá sạch; internship 2 tạm chuyển in_progress rồi
  cycle qua cancelled→pending→approved để khôi phục đúng trạng thái gốc — verify lại status='approved',
  progress=10 không đổi)
```

## 22. Lint/build
```
npm run lint:  PASS (exit 0, 39 warning — baseline không đổi, 0 cảnh báo/lỗi mới)
npm run build: PASS (188 modules, 0 lỗi)
```

## 23. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 14 file tiêu thụ `useEvaluations`, test HTTP thật cho toàn bộ CRUD/ownership/IDOR/unique-constraint/score-validation/publish-authorization/published-lock/immutable-fields (JWT thật của 2 Student, 2 Lecturer, 2 Company Mentor + Admin), test DB trực tiếp (COUNT(*) thật + kiểm tra uniqueness), và `npm run build` thành công.

## 24. Known limitations
```
- Không có công thức gộp điểm Lecturer + Company thành 1 điểm tổng kết chính thức — đúng hiện trạng
  UI (AdminEvaluationDetailPage.jsx hiển thị riêng từng đánh giá để Admin tự đối chiếu), không tự
  thêm weighting.
- Không có UI/endpoint action riêng cho publish/unpublish — dùng chung update() như backend đã thiết
  kế, không tự tạo action endpoint mới.
- Browser click-through chưa xác minh trực tiếp (không có tool).
```
