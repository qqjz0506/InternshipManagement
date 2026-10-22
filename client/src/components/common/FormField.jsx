import './common.css'

function FormField({ label, htmlFor, error, children }) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <span className="form-field-error">{error}</span>}
    </div>
  )
}

export default FormField
