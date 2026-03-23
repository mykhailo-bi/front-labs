import PropTypes from 'prop-types'

const FormField = ({ label, name, type, value, onChange, required, children }) => (
    <label className="input-group" htmlFor={name}>
        <span>{label}</span>
        {children || (
            <input
                id={name}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                required={required}
            />
        )}
    </label>
)

FormField.propTypes = {
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onChange: PropTypes.func.isRequired,
    required: PropTypes.bool,
    children: PropTypes.node,
}

FormField.defaultProps = {
    type: 'text',
    required: false,
    children: null,
}

export default FormField
