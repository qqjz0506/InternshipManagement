import EmptyState from './EmptyState'
import './DataTable.css'

// columns: [{ key, label, render?(row) }]
function DataTable({ columns, data, rowKey, emptyMessage }) {
  if (data.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
