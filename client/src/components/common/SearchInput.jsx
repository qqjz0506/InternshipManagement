import './common.css'

function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...' }) {
  return (
    <input
      type="text"
      className="search-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  )
}

export default SearchInput
