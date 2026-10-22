import './InfoCard.css'

// title + hành động tùy chọn (nút phân công/đề xuất) + nội dung dạng danh sách key-value hoặc children tùy ý
function InfoCard({ title, action, emptyMessage, isEmpty, children }) {
  return (
    <div className="info-card">
      <div className="info-card-header">
        <h3>{title}</h3>
        {action}
      </div>
      {isEmpty ? <p className="info-card-empty">{emptyMessage}</p> : children}
    </div>
  )
}

export default InfoCard
