-- Migration 005: chốt điểm tổng kết thực tập (internships.final_score/final_classification) cho
-- database đã tồn tại (đã chạy schema.sql cũ chưa có 2 cột này).
-- Chạy: mysql -u root --default-character-set=utf8mb4 internship_management < server/db/migrations/005_internship_final_score.sql
-- Hoặc: npm run db:migrate (idempotent — tự phát hiện nếu đã áp dụng, xem server/db/migrate.js)

USE internship_management;

ALTER TABLE internships
  ADD COLUMN final_score DECIMAL(3,1) NULL AFTER progress,
  ADD COLUMN final_classification VARCHAR(30) NULL AFTER final_score;

-- Backfill cho các hồ sơ ĐÃ 'completed' từ trước khi tính năng này tồn tại (final_score đang NULL) —
-- tính đúng công thức evaluationService.computeFinalResult() (trọng số HIỆN TẠI trong settings, vì
-- không còn cách nào biết trọng số tại đúng thời điểm các hồ sơ này hoàn thành trước đây).
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
WHERE i.status = 'completed'
  AND i.final_score IS NULL
  AND e.lecturer_score IS NOT NULL
  AND e.company_score IS NOT NULL;

UPDATE internships
SET final_classification = CASE
  WHEN final_score >= 9 THEN 'Xuất sắc'
  WHEN final_score >= 8 THEN 'Giỏi'
  WHEN final_score >= 6.5 THEN 'Khá'
  WHEN final_score >= 5 THEN 'Trung bình'
  ELSE 'Không đạt'
END
WHERE status = 'completed' AND final_score IS NOT NULL AND final_classification IS NULL;
