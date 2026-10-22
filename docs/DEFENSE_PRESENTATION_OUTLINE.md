# DÀN Ý THUYẾT TRÌNH BẢO VỆ ĐỒ ÁN

Không có số liệu hiệu năng/benchmark nào được bịa ra trong dàn ý này — mọi số liệu nhắc đến (số test, số bảng, số REQ...) phải lấy đúng từ tài liệu hiện hành tại thời điểm thuyết trình (`docs/PHASE_7C_FINAL_PREPARATION.md`, `docs/REQUIREMENT_TRACEABILITY_MATRIX.md`) — nếu chạy lại test/lint/build trước ngày bảo vệ và số liệu đổi, **phải cập nhật slide theo số liệu mới nhất**, không giữ số cũ.

## Slide 1 — Trang bìa

- **Mục đích**: giới thiệu tên đề tài, người thực hiện, GVHD, đơn vị.
- **Nội dung**: "XÂY DỰNG HỆ THỐNG QUẢN LÝ THỰC TẬP TỐT NGHIỆP" + thông tin cá nhân/môn học.
- **Hình ảnh cần chuẩn bị**: logo trường/khoa (nếu có quy định).
- **Tránh nói sai**: không cần tránh gì đặc biệt — chỉ là slide giới thiệu.

## Slide 2 — Bối cảnh và lý do chọn đề tài

- **Mục đích**: giải thích vì sao vấn đề này đáng giải quyết.
- **Nội dung**: quy trình thực tập thủ công hiện tại (giấy tờ/email) khó theo dõi tiến độ, dễ thất lạc minh chứng — hệ thống số hóa giúp 4 vai trò (Admin/Student/Lecturer/Company Mentor) cùng làm việc trên 1 nguồn dữ liệu.
- **Hình ảnh**: sơ đồ đơn giản "trước/sau" (thủ công vs hệ thống) — tự vẽ, không cần số liệu thật.
- **Tránh nói sai**: không nói "khảo sát X trường/Y doanh nghiệp" nếu chưa thực sự khảo sát — chỉ nói về vấn đề chung, không bịa dữ liệu khảo sát.

## Slide 3 — Mục tiêu và phạm vi

- **Mục đích**: nêu rõ ranh giới đồ án làm gì / không làm gì.
- **Nội dung**: liệt kê chức năng chính (Mục 2 `README.md`), và liệt kê rõ **không làm**: refresh token (`httpOnly` cookie)/CSRF protection, object storage cho file (lưu trực tiếp trên đĩa server), rate limiting đầy đủ cho mọi endpoint (hiện chỉ `POST /auth/login`), UI xuất Excel cho Student (Mục 16/18 `README.md`).
- **Hình ảnh**: không cần, có thể dùng bullet list 2 cột (Có/Không).
- **Tránh nói sai**: không nói "đã làm được X" nếu thực tế là 🟡/⬜ trong RTM — đối chiếu lại `docs/REQUIREMENT_TRACEABILITY_MATRIX.md` trước khi viết slide.

## Slide 4 — Vai trò và use case

- **Mục đích**: giới thiệu 4 vai trò và phạm vi dữ liệu của từng vai trò.
- **Nội dung**: bảng Mục 3 `README.md` (Admin/Student/Lecturer/Company Mentor + phạm vi dữ liệu).
- **Hình ảnh**: sơ đồ use-case đơn giản (4 actor, các hành động chính mỗi actor).
- **Tránh nói sai**: nhấn mạnh phân quyền ở **frontend chỉ là UX**, bảo mật thật ở backend (dễ bị hỏi xoáy nếu nói ngược).

## Slide 5 — Kiến trúc tổng thể

- **Mục đích**: cho thấy hiểu rõ luồng request đi qua từng lớp.
- **Nội dung**: sơ đồ Mục 5 `README.md` (Frontend → apiClient → Express → requireAuth → requireRole → Controller → Service/scopeService → mysql2 → MariaDB).
- **Hình ảnh**: vẽ lại sơ đồ này dạng box-arrow cho dễ nhìn trên slide.
- **Tránh nói sai**: không gọi `scopeService` là "ORM" hay nhầm lẫn vai trò của nó — nó là lớp enforce ownership/scope, không phải lớp truy vấn chung.

## Slide 6 — Thiết kế database và ERD

- **Mục đích**: cho thấy thiết kế dữ liệu chặt chẽ, có suy nghĩ về quan hệ.
- **Nội dung**: 14 bảng, các quan hệ chính (`users` ↔ 3 bảng profile qua `user_id` nullable; `internships` là bảng trung tâm; `internship_logs`/`reports`/`evaluations` là weak entity CASCADE theo `internship_id`).
- **Hình ảnh**: ERD đầy đủ (có thể export từ `docs/DATABASE_DESIGN.md` hoặc vẽ lại bằng tool ERD).
- **Tránh nói sai**: phân biệt rõ `ON DELETE RESTRICT` (các FK từ `internships` ra `students/periods/companies/mentors/lecturers/topics`) vs `ON DELETE CASCADE` (từ `logs/reports/evaluations` vào `internships`) vs `ON DELETE SET NULL` (`users` → 3 bảng profile) — câu hỏi phản biện rất hay xoáy vào đây (xem `DEFENSE_QA.md` Mục G).

## Slide 7 — Các chức năng chính

- **Mục đích**: liệt kê chức năng đã hoàn thiện, có bằng chứng.
- **Nội dung**: theo nhóm — Danh mục, Hồ sơ nghiệp vụ, Hồ sơ thực tập (workflow), Nhật ký, Báo cáo, Đánh giá, Thông báo, Cấu hình, Thống kê, Xuất Excel, Quản lý tài khoản.
- **Hình ảnh**: screenshot thật (chụp từ browser đã chạy, KHÔNG dùng ảnh minh họa giả) của 2-3 trang tiêu biểu (Admin Dashboard, Internship Detail, Statistics).
- **Tránh nói sai**: với mỗi chức năng liệt kê, nếu REQ tương ứng đang 🟡 (ví dụ export Excel đã có UI ở Admin/Lecturer/Company Mentor nhưng Student vẫn chưa có nút) — nói rõ giới hạn ngay trên slide hoặc chuẩn bị tinh thần trả lời khi được hỏi, không để hội đồng tự phát hiện rồi mất điểm bất ngờ.

## Slide 8 — Luồng nghiệp vụ thực tập

- **Mục đích**: minh họa workflow trạng thái + ai làm gì ở bước nào.
- **Nội dung**: sơ đồ trạng thái `pending → approved → in_progress → completed` (+ `rejected`/`cancelled`), gắn vai trò chịu trách nhiệm từng transition.
- **Hình ảnh**: state diagram (có thể vẽ bằng tay hoặc draw.io) đúng theo `ALLOWED_TRANSITIONS` thật (`server/utils/internshipStatus.js`) — **không tự vẽ thêm trạng thái/transition không có trong code**.
- **Tránh nói sai**: `completed` là trạng thái cuối tuyệt đối, không có đường lùi — nói rõ điều này tránh hội đồng hỏi "vậy sau completed muốn sửa thì sao" mà không có câu trả lời (câu trả lời đúng: phải tạo hồ sơ thực tập mới, không sửa lại hồ sơ cũ).

## Slide 9 — Phân quyền và bảo mật

- **Mục đích**: đây thường là phần được hỏi nhiều nhất — chuẩn bị kỹ.
- **Nội dung**: RBAC (route-level) + Data-scope (ownership) — 2 lớp độc lập; chống IDOR; field injection whitelist; bcrypt; JWT tối thiểu; error handler an toàn-mặc định.
- **Hình ảnh**: sơ đồ 2 lớp phân quyền (RBAC trên, Scope dưới) với ví dụ cụ thể 1 request đi qua cả 2 lớp.
- **Tránh nói sai**: không nói "hệ thống chống được mọi tấn công" — chỉ nói đúng những gì đã làm (Mục 16 `README.md`) và thừa nhận rõ những gì chưa làm (CSRF/rate limit/refresh token) khi được hỏi.

## Slide 10 — Kiểm thử

- **Mục đích**: chứng minh chất lượng bằng bằng chứng thật, không phải lời nói.
- **Nội dung**: số lượng test tự động hiện tại (lấy đúng số từ lần `npm test` gần nhất — xem README Mục 15), chạy trên **database test riêng** (không còn chung với database dev), phương pháp (HTTP thật + JWT thật, không mock), nhóm test (Auth/RBAC/IDOR/Field Injection/Business Rules/Users/CRUD/Security/Error Handling/Workflow/Logs/Reports/Settings/Phân trang/Thống kê/Múi giờ/DB Integrity/Export/Migration), VÀ Browser E2E tự động bằng Playwright (`npm run test:e2e`, chạy Chromium thật).
- **Hình ảnh**: screenshot thật kết quả `npm test` VÀ `npm run test:e2e` (terminal output, không dựng giả).
- **Tránh nói sai**: không nói 1 con số cụ thể nào (ví dụ số test backend/E2E) nếu chưa thực sự chạy lại gần ngày bảo vệ để xác nhận số đó còn đúng — luôn chạy `npm test` + `npm run test:e2e` lại trước khi chốt số liệu lên slide.

## Slide 11 — Demo

- **Mục đích**: slide chuyển tiếp sang phần demo trực tiếp.
- **Nội dung**: liệt kê ngắn các bước sẽ demo (theo `docs/FINAL_DEMO_SCRIPT.md`), không cần chi tiết từng field.
- **Hình ảnh**: có thể để trống hoặc 1 ảnh sơ đồ luồng demo.
- **Tránh nói sai**: nói rõ "phần UI/browser dưới đây là demo trực tiếp" — Browser E2E TỰ ĐỘNG (Playwright) đã verify được luồng chính, nhưng demo trực tiếp vẫn là bước riêng, không phải phát lại y hệt automated test, tránh hội đồng hiểu lầm 2 việc là một.

## Slide 12 — Hạn chế

- **Mục đích**: chủ động nêu giới hạn trước khi bị hỏi — thể hiện tự đánh giá trung thực, thường được đánh giá cao hơn là che giấu.
- **Nội dung**: UI xuất Excel cho Student còn thiếu (API đã sẵn sàng), phân trang server-side mới chỉ có ở API (chưa có UI dùng), không có xóa tài khoản (chỉ khóa/mở), notifications không có retry/hàng đợi (chỉ 1 `INSERT` đồng bộ), upload file báo cáo lưu trực tiếp trên đĩa server (không phải object storage), không CSRF/refresh token, rate limiting chỉ áp dụng cho đăng nhập, Playwright E2E mới bao phủ luồng chính (chưa phải full regression UI).
- **Hình ảnh**: không cần, bullet list rõ ràng.
- **Tránh nói sai**: đây là slide dễ "lỡ lời" nói giảm nhẹ giới hạn — giữ đúng từ ngữ đã dùng trong README/RTM, không tô vẽ.

## Slide 13 — Hướng phát triển

- **Mục đích**: cho thấy đã nghĩ xa hơn phạm vi hiện tại.
- **Nội dung**: UI export Excel cho Student (API đã sẵn sàng), UI dùng phân trang server-side đã có ở API, refresh token (`httpOnly` cookie) + CSRF protection + rate limiting đầy đủ hơn cho production, object storage cho file báo cáo thay vì lưu trên đĩa server, mở rộng Playwright E2E ra các nhánh phụ (từ chối đề tài, hủy hồ sơ, resubmit báo cáo).
- **Hình ảnh**: không cần.
- **Tránh nói sai**: không hứa hẹn "sẽ làm được" nếu không chắc — dùng từ "có thể mở rộng theo hướng..." thay vì khẳng định chắc chắn.

## Slide 14 — Kết luận

- **Mục đích**: tóm tắt đóng góp chính, khép lại phần thuyết trình.
- **Nội dung**: đã xây dựng được hệ thống đầy đủ 4 vai trò, phân quyền 2 lớp (RBAC + scope), quy trình nghiệp vụ hoàn chỉnh có kiểm chứng bằng test tự động thật, tài liệu đầy đủ theo từng phase phát triển.
- **Hình ảnh**: không cần.
- **Tránh nói sai**: không dùng từ "hoàn hảo"/"không lỗi" — dùng "đã kiểm chứng được những gì nêu trong tài liệu, các giới hạn còn lại đã ghi nhận minh bạch ở Slide 12".
