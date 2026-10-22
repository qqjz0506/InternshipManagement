# API PHASE 4B-3 — Migrate Companies + Company Mentors from Mock Data to REST API

## 1. Scope
Migrate **chỉ** `CompaniesContext` và `CompanyMentorsContext` sang REST API thật. Không migrate Topics/Internships/InternshipLogs/Reports/Evaluations/Notifications/Settings/Users. Không sửa database schema, RBAC architecture, không thêm `/api/users`.

## 2. Mismatch check

```
PASS (2 mismatch nghiêm trọng phát hiện trước khi code, đã sửa tối thiểu ở frontend — không sửa backend/schema)
```

**Field-by-field:** Company (`id, company_code, company_name, tax_code, address, phone, email, website, representative, status, created_at, updated_at`) và CompanyMentor (`id, user_id, company_id, full_name, email, phone, position, status, created_at, updated_at`) khớp 100% giữa `data/companies.js`/`data/companyMentors.js`, `CompanyFormModal.jsx`/`CompanyMentorFormModal.jsx` và `companyService.js`/`companyMentorService.js`/`schema.sql`. Đối chiếu dữ liệu thật qua `GET /api/companies`/`GET /api/company-mentors` (Admin) — khớp byte-for-byte với mock (company_code DN001-DN010, mentor user_id links 9→mentor1, 10→mentor2, 4→mentor7...). Không cần mapper.

**Mismatch #1 — nghiêm trọng, silent data loss (phát hiện qua đọc code, KHÔNG phải qua test):**
`CompanyMentorFormModal.jsx` dựng `formData` khi edit bằng cách liệt kê thủ công đúng 6 field hiển thị trên form (`full_name, email, phone, company_id, position, status`) — **không bao gồm `user_id`** — khác với `StudentFormModal.jsx`/`LecturerFormModal.jsx` (spread toàn bộ `initialData`). Với mock Context cũ (merge nông), việc thiếu `user_id` trong `changes` vô hại vì `{...item, ...changes}` tự giữ `user_id` cũ. Với backend thật (`companyMentorService.update()` destructure `user_id` rồi ghi `user_id ?? null`), **mọi lần Admin sửa bất kỳ field nào của 1 mentor đã có tài khoản liên kết sẽ âm thầm xóa liên kết đó** (`user_id` bị ghi đè thành `NULL`) — không có lỗi, không có cảnh báo, mất dữ liệu im lặng.
**Fix:** đổi `CompanyMentorFormModal.jsx` sang spread toàn bộ `initialData` (giống 2 modal kia) thay vì liệt kê field thủ công — `user_id` tự động được giữ nguyên qua mỗi lần sửa dù form không có input cho nó.

**Mismatch #2 — trùng lặp business logic/transaction (đúng cảnh báo mục 11 của yêu cầu):**
`CompanyMentorsPage.jsx::handleSubmit` khi phát hiện đổi `company_id`, tự chạy vòng lặp `internships.filter(...).forEach(updateInternship(id, {company_mentor_id: null}))` — đây là logic được viết từ thời Company Mentor còn mock (chưa có backend transaction). Backend (`companyMentorService.update()`, Phase 2B) đã tự làm đúng việc này trong **1 DB transaction thật** (`UPDATE company_mentors` + `UPDATE internships SET company_mentor_id = NULL`). Giữ nguyên code cũ sẽ: (a) chạy song song 2 cơ chế không đồng bộ — 1 cái sửa DB thật (mentor), 1 cái chỉ sửa state mock `InternshipsContext` (vô hại nhưng dư thừa và sai lệch dữ liệu hiển thị tạm thời), (b) vi phạm trực tiếp yêu cầu "Backend là source of truth cho transaction này, không tự làm change mentor company → manually update internships" (mục 11).
**Fix:** xóa vòng lặp `forEach(updateInternship(...))` khỏi `handleSubmit`. Sau khi `updateItem` (PUT thật) thành công, chỉ hiển thị 1 thông báo tham khảo chung chung (không tự tính số lượng từ mock data nữa, vì con số chính xác đã nằm trong `message` của response backend — xem Known limitations mục 18 về việc không thể lấy `message` qua `createApiResourceContext` hiện tại).

**Mismatch #3 — kế thừa từ Phase 4B-2, áp dụng lại cho CompanyMentor:**
`AdminAccountsPage.jsx`'s nhánh `role === 'company_mentor'` gọi `updateMentor(Number(linkedProfileId), { user_id: newUser.id })` — partial payload, cùng vấn đề PATCH-vs-PUT đã tìm thấy ở Phase 4B-2. **Fix:** merge full record (`{...target, user_id: newUser.id}`) giống Student/Lecturer.

## 3. Files created
```
client/src/api/companyApi.js
client/src/api/companyMentorApi.js
docs/API_PHASE_4B_3.md
```

## 4. Files modified
```
client/src/context/CompaniesContext.jsx
client/src/context/CompanyMentorsContext.jsx
client/src/pages/admin/CompaniesPage.jsx
client/src/pages/admin/CompanyMentorsPage.jsx            (xóa duplicate transaction logic — mismatch #2)
client/src/pages/admin/AdminAccountsPage.jsx              (mismatch #3)
client/src/components/companies/CompanyFormModal.jsx
client/src/components/companyMentors/CompanyMentorFormModal.jsx  (mismatch #1 — bug nghiêm trọng nhất phase này)
```
Không sửa backend, không sửa schema, không sửa `CompanyMentorDetailModal.jsx`/`CompanyProfilePage.jsx` (chỉ đọc `items`, không có mismatch).

## 5. Companies integration
```
CompaniesContext.jsx → createApiResourceContext(companyApi, 'Companies')
```
`GET /api/companies` khi mount — mở cho mọi role đã đăng nhập (Student cần đọc để tự đề xuất doanh nghiệp qua `StudentProposeCompanyModal`). CRUD qua `POST/PUT/DELETE`, chỉ Admin (route `requireRole('admin')`).

## 6. Company Mentors integration
```
CompanyMentorsContext.jsx → createApiResourceContext(companyMentorApi, 'CompanyMentors')
```
`GET /api/company-mentors` tự scope theo role (Admin: tất cả, Company Mentor: chính mình, Student/Lecturer: mentor liên quan qua JOIN `internships`). Test xác nhận query-param bypass `?company_id=` **không** vượt qua scope (Mentor A truy vấn `?company_id=1` của công ty khác vẫn chỉ nhận về đúng 1 record của chính mình).

## 7. User linking
```
user_id nullable, UNIQUE — backend validateReferences() kiểm tra: user tồn tại + chưa bị mentor khác link.
```
Test xác nhận: link user đã bị mentor khác dùng → `409`; `company_id` không tồn tại → `400`; `AdminAccountsPage.jsx` linking flow đã sửa (mismatch #3) hoạt động đúng full-PUT contract. Không có flow "unlink" riêng trong Frontend hiện tại (chỉ có flow "link lúc tạo tài khoản mới") — không tự thêm tính năng này (ngoài phạm vi phase).

## 8. Company change transaction
Backend transaction (`companyMentorService.update()`) xác nhận hoạt động đúng qua test thật: tạo mentor test gắn vào 1 Internship, đổi `company_id` của mentor → Internship đó tự động có `company_mentor_id = NULL` (verify qua GET lại Internship, không chỉ tin response). Message backend trả về số lượng chính xác (`"Đã gỡ phân công khỏi 1 hồ sơ thực tập do đổi doanh nghiệp."`). Frontend (`CompanyMentorsPage.jsx`) đã bỏ hoàn toàn logic tự lặp lại transaction này (mismatch #2) — chỉ gọi PUT, chờ thành công, hiển thị thông báo tham khảo.

## 9. Authorization / RBAC
Không đổi kiến trúc Phase 3B. Test thực tế: Company Mentor A GET/PUT Mentor B → `403`; Student/Lecturer POST `/companies`, `/company-mentors` → `403`; Company Mentor PUT chính mình → `403` (đúng thiết kế read-only, giống Lecturer). Route/middleware không sửa.

## 10. Loading / error handling
Giống pattern 4B-1/4B-2: `items, isLoading, isMutating, error` trên cả 2 Context; `CompaniesPage.jsx`/`CompanyMentorsPage.jsx` hiện loading/error banner, disable nút Lưu khi `isMutating`, không đóng modal nếu mutation fail, không optimistic update/delete (409 giữ nguyên state).

## 11. Tests

| Test | Result |
|---|---|
| Companies GET | PASS |
| Companies POST | PASS |
| Companies PUT | PASS |
| Companies DELETE | PASS (409 FK, không test xóa thật vì company nào cũng có mentor/internship) |
| Company validation | PASS (thiếu tax_code → 400) |
| Company duplicate | PASS (company_code 409, tax_code 409 riêng biệt) |
| Company FK | PASS (409 — company 1 có mentor + internship) |
| Company Mentor GET | PASS |
| Company Mentor POST | PASS |
| Company Mentor PUT | PASS |
| Company Mentor DELETE | PASS (test record tạo-rồi-xóa; id=1 thật 409 FK) |
| Mentor validation | PASS |
| Mentor duplicate (email) | PASS (409) |
| Mentor FK | PASS (409 — mentor 1 đang được phân công) |
| User linking | PASS (duplicate user_id → 409, invalid company_id → 400) |
| Company change transaction | PASS (verify bằng DB thật, không chỉ tin response) |
| Delete restriction | PASS |
| IDOR | PASS (Mentor A → Mentor B: 403) |
| Query-param bypass | PASS (`?company_id=` không vượt scope) |
| Lint | PASS (exit 0, 39 warning — baseline không đổi) |
| Build | PASS (188 modules, 0 lỗi) |
| Regression 2A-2F | PASS |
| Regression 3A-3B | PASS |
| Regression 4A | PASS |
| Regression 4B-1 | PASS (departments=4, periods=3) |
| Regression 4B-2 | PASS (students=14, lecturers=10) |
| DB integrity | PASS |

## 12. Browser verification
```
NOT VERIFIED
```
Không có browser automation tool. Đã xác minh qua: đọc toàn bộ 31 file tiêu thụ `useCompanies`/`useCompanyMentors` (không có dereference crash khi `items` rỗng lúc loading), test HTTP thật cho toàn bộ CRUD/ownership/IDOR/transaction, test DB trực tiếp (không chỉ tin response JSON), và `npm run build` thành công.

## 13. Known limitations
```
- Message chi tiết "Đã gỡ phân công khỏi N hồ sơ thực tập" từ backend không được hiển thị chính xác
  số N ở Frontend, vì apiClient.put() (Phase 4A) chỉ trả `data`, không trả `message`, và thay đổi
  contract này sẽ ảnh hưởng ngược tới 5 API module đã hoàn thành (department/internshipPeriod/
  student/lecturer/auth) — ngoài phạm vi an toàn của Phase 4B-3. Thay vào đó hiển thị thông báo
  tham khảo chung "đã tự động gỡ phân công (nếu có)" sau khi PUT thành công.
- Không có flow "unlink tài khoản" trong Frontend hiện tại (chỉ có "link lúc tạo tài khoản mới") —
  không tự thêm tính năng ngoài phạm vi.
- CompanyMentorsPage.jsx bỏ luôn phần tiền-kiểm-tra `isReferenced` (dùng mock internships) trước khi
  gọi DELETE — để backend là nguồn kiểm tra 409 duy nhất (tránh dữ liệu mock cũ cho kết quả sai lệch
  so với DB thật); UX giữ nguyên (vẫn hiện lỗi rõ ràng, chỉ khác là sau khi gọi API thay vì trước).
- Browser click-through chưa xác minh trực tiếp (không có tool).
```

## 14. Deferred work
Theo đúng mục 23 của yêu cầu — không migrate thêm Context nào khác trong phase này. Phase tiếp theo (nếu có) nên lưu ý: `TopicsContext`/`InternshipsContext` vẫn tham chiếu `company_id`/`company_mentor_id` bằng dữ liệu mock riêng (`data/internships.js`) — khi migrate các Context đó, cần đối chiếu lại xem id có còn mirror đúng DB thật hay không (đã xác nhận đúng cho Departments/Periods/Students/Lecturers/Companies/CompanyMentors tới thời điểm này).
