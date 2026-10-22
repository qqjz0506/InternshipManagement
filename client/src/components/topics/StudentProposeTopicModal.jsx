import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'
import { isRequired } from '../../utils/validators'

const TOPIC_STATUS_LABEL = {
  proposed: 'Đề xuất',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

// Sinh viên có 2 lựa chọn: chọn 1 đề tài có sẵn (đã duyệt) hoặc tự đề xuất đề tài mới.
// Đề tài mới tạo ra sẽ nằm trong TopicsContext dùng chung, status mặc định 'proposed'.
function StudentProposeTopicModal({
  isOpen,
  onClose,
  onSubmitExisting,
  onSubmitNew,
  topics,
  currentTopicId,
  submitError,
  isSubmitting,
}) {
  const [mode, setMode] = useState('existing')
  const [topicId, setTopicId] = useState('')
  const [newTopic, setNewTopic] = useState({ topic_name: '', description: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setMode('existing')
      setTopicId(currentTopicId ? String(currentTopicId) : '')
      setNewTopic({ topic_name: '', description: '' })
      setError('')
    }
  }, [isOpen, currentTopicId])

  const approvedTopics = topics.filter((topic) => topic.status === 'approved')

  function handleSubmit(event) {
    event.preventDefault()

    if (mode === 'existing') {
      if (!isRequired(topicId)) {
        setError('Vui lòng chọn 1 đề tài.')
        return
      }
      onSubmitExisting(Number(topicId))
      return
    }

    if (!isRequired(newTopic.topic_name)) {
      setError('Vui lòng nhập tên đề tài.')
      return
    }
    onSubmitNew(newTopic)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đề xuất đề tài">
      <form onSubmit={handleSubmit}>
        <div className="modal-toggle-group">
          <Button
            type="button"
            variant={mode === 'existing' ? 'primary' : 'secondary'}
            className="btn-sm"
            onClick={() => setMode('existing')}
          >
            Chọn đề tài có sẵn
          </Button>
          <Button
            type="button"
            variant={mode === 'new' ? 'primary' : 'secondary'}
            className="btn-sm"
            onClick={() => setMode('new')}
          >
            Tự đề xuất đề tài mới
          </Button>
        </div>

        {mode === 'existing' ? (
          <FormField label="Đề tài" htmlFor="topic_id" error={error}>
            <select id="topic_id" value={topicId} onChange={(event) => setTopicId(event.target.value)}>
              <option value="">-- Chọn đề tài --</option>
              {approvedTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.topic_code} - {topic.topic_name} ({TOPIC_STATUS_LABEL[topic.status]})
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <>
            <FormField label="Tên đề tài" htmlFor="topic_name" error={error}>
              <input
                id="topic_name"
                value={newTopic.topic_name}
                onChange={(event) => setNewTopic((prev) => ({ ...prev, topic_name: event.target.value }))}
              />
            </FormField>
            <FormField label="Mô tả" htmlFor="topic_description">
              <textarea
                id="topic_description"
                rows={3}
                value={newTopic.description}
                onChange={(event) => setNewTopic((prev) => ({ ...prev, description: event.target.value }))}
              />
            </FormField>
            <p className="form-hint">Đề tài tự đề xuất sẽ ở trạng thái "Đề xuất" cho đến khi được duyệt.</p>
          </>
        )}

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi đề xuất'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default StudentProposeTopicModal
