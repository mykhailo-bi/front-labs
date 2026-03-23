import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import { createUser, getUser, updateUser } from '../services/userService'
import FormField from '../components/FormField'
import Loader from '../components/Loader'

const initialState = {
    username: '',
    email: '',
    firstname: '',
    lastname: '',
    phone: '',
    role: 'customer',
    status: 'active',
    password: '',
}

const useUserForm = (mode, userId) => {
    const isCreate = mode === 'create'
    const [form, setForm] = useState(initialState)
    const [loading, setLoading] = useState(!isCreate)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isCreate) {
            return
        }
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const { data } = await getUser(userId)
                setForm({
                    username: data.username || '',
                    email: data.email || '',
                    firstname: data.firstname || '',
                    lastname: data.lastname || '',
                    phone: data.phone || '',
                    role: data.role || 'customer',
                    status: data.status || 'active',
                    password: '',
                })
            } catch (err) {
                setError(err?.response?.data?.detail || 'User not found')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [isCreate, userId])

    const handleChange = (event) => {
        const { name, value } = event.target
        setForm((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setSubmitting(true)
        setError('')
        try {
            if (isCreate) {
                await createUser({ ...form, password: form.password || undefined })
            } else {
                const payload = { ...form }
                if (!payload.password) {
                    delete payload.password
                }
                await updateUser(userId, payload)
            }
            return true
        } catch (err) {
            setError(err?.response?.data?.detail || 'Save failed')
            return false
        } finally {
            setSubmitting(false)
        }
    }

    return { form, loading, error, submitting, handleChange, handleSubmit, setError }
}

const UserEditPage = ({ mode }) => {
    const isCreate = mode === 'create'
    const { userId } = useParams()
    const navigate = useNavigate()
    const {
        form,
        loading,
        error,
        submitting,
        handleChange,
        handleSubmit,
    } = useUserForm(mode, userId)

    const onSubmit = async (event) => {
        const ok = await handleSubmit(event)
        if (ok) {
            navigate('/admin/users', { replace: true })
        }
    }

    return (
        <div className="page-card">
            <div className="toolbar">
                <div>
                    <h2 className="page-title">{isCreate ? 'Create user' : 'Edit user'}</h2>
                    <p className="muted">Admin-only user management form.</p>
                </div>
            </div>
            {loading && <Loader />}
            {error && <div className="error-text">{error}</div>}
            {!loading && !error && (
                <form onSubmit={onSubmit}>
                    <FormField label="Username" name="username" value={form.username} onChange={handleChange} required />
                    <FormField label="Email" name="email" type="email" value={form.email} onChange={handleChange} required />
                    <FormField label="First name" name="firstname" value={form.firstname} onChange={handleChange} />
                    <FormField label="Last name" name="lastname" value={form.lastname} onChange={handleChange} />
                    <FormField label="Phone" name="phone" value={form.phone} onChange={handleChange} />
                    <FormField label="Role" name="role" value={form.role} onChange={handleChange}>
                        <select id="role" name="role" value={form.role} onChange={handleChange}>
                            <option value="admin">Admin</option>
                            <option value="customer">Customer</option>
                        </select>
                    </FormField>
                    <FormField label="Status" name="status" value={form.status} onChange={handleChange}>
                        <select id="status" name="status" value={form.status} onChange={handleChange}>
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </FormField>
                    <FormField label="Password" name="password" type="password" value={form.password} onChange={handleChange} required={isCreate} />
                    <div className="form-actions">
                        <button type="submit" className="btn" disabled={submitting}>
                            {submitting ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className="btn secondary" onClick={() => navigate(-1)}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}

UserEditPage.propTypes = {
    mode: PropTypes.oneOf(['create', 'edit']).isRequired,
}

export default UserEditPage
