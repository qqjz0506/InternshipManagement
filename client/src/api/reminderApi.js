import { apiClient } from './apiClient'

// Shape của data khác nhau theo role currentUser (server tự quyết định — xem
// server/services/reminderService.js): { role: 'student', items: [{key, message}] } |
// { role: 'lecturer'|'company_mentor', items: [{internshipId, studentCode, studentName, issues}] } |
// { role: 'admin', items: [{periodId, periodCode, periodName, logOverdueCount, ...}] }.
export function getOverview() {
  return apiClient.get('/reminders/overview')
}
