import EmptyState from './EmptyState'
import './BarBreakdown.css'

// rows: [{ label, value }] — thanh ngang tỉ lệ theo giá trị lớn nhất, không phụ thuộc thư viện chart.
function BarBreakdown({ rows, emptyMessage = 'Chưa có dữ liệu.' }) {
  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  const maxValue = Math.max(1, ...rows.map((row) => row.value))

  return (
    <div className="breakdown-list">
      {rows.map((row) => (
        <div className="breakdown-row" key={row.label}>
          <span className="breakdown-label">{row.label}</span>
          <div className="breakdown-bar-track">
            <div className="breakdown-bar-fill" style={{ width: `${(row.value / maxValue) * 100}%` }} />
          </div>
          <span className="breakdown-value">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

export default BarBreakdown
