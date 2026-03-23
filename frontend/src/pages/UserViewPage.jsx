import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getUser } from '../services/userService'
import Loader from '../components/Loader'

const UserViewPage = () => {
    const { userId } = useParams()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const { data } = await getUser(userId)
                setUser(data)
            } catch (err) {
                setError(err?.response?.data?.detail || 'User not found')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [userId])

    return (
        <div className="page-card">
            <div className="toolbar">
                <div>
                    <h2 className="page-title">User details</h2>
                    <p className="muted">View user profile and metadata.</p>
                </div>
                <button type="button" className="btn" onClick={() => navigate(-1)}>
                    Back
                </button>
            </div>
            {loading && <Loader />}
            {error && <div className="error-text">{error}</div>}
            {user && !loading && !error && (
                <div className="details-grid">
                    <div><strong>ID:</strong> {user.id}</div>
                    <div><strong>Username:</strong> {user.username}</div>
                    <div><strong>Email:</strong> {user.email}</div>
                    <div><strong>First name:</strong> {user.firstname || '—'}</div>
                    <div><strong>Last name:</strong> {user.lastname || '—'}</div>
                    <div><strong>Phone:</strong> {user.phone || '—'}</div>
                    <div><strong>Role:</strong> {user.role}</div>
                    <div><strong>Status:</strong> {user.status}</div>
                    <div><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</div>
                    <div><strong>Updated:</strong> {new Date(user.updated_at).toLocaleString()}</div>
                </div>
            )}
            {user && !loading && !error && (
                <div className="form-actions" style={{ marginTop: '18px' }}>
                    <Link to={`/users/${user.id}/edit`} className="btn">
                        Edit user
                    </Link>
                </div>
            )}
        </div>
    )
}

export default UserViewPage
