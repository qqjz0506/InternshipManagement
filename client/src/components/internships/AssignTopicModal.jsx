import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import FormField from '../common/FormField'

const TOPIC_STATUS_LABEL = {
  proposed: 'Đề xuất',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

function AssignTopicModal({ isOpen, onClose, onSubmit, topics, currentTopicId, submitError, isSubmitting }) {
  const [topicId, setTopicId] = useState('')

  useEffect(() => {
    if (isOpen) {
      setTopicId(currentTopicId ? String(currentTopicId) : '')
    }
  }, [isOpen, currentTopicId])

  function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    onSubmit(topicId ? Number(topicId) : null)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chọn đề tài">
      <form onSubmit={handleSubmit}>
        <FormField label="Đề tài" htmlFor="topic_id">
          <select id="topic_id" value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            <option value="">-- Bỏ chọn đề tài --</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.topic_code} - {topic.topic_name} ({TOPIC_STATUS_LABEL[topic.status]})
              </option>
            ))}
          </select>
        </FormField>

        {submitError && <p className="form-field-error">{submitError}</p>}

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default AssignTopicModal
