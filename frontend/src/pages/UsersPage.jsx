import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteUser, listUsers } from '../services/userService'
import Loader from '../components/Loader'
import './UsersPage.css'

const useUsersData = () => {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const normalizeUsers = (payload) => {
        if (Array.isArray(payload)) {
            return payload
        }
        if (Array.isArray(payload?.results)) {
            return payload.results
        }
        return []
    }

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await listUsers()
            setUsers(normalizeUsers(data))
        } catch (err) {
            setUsers([])
            setError(err?.response?.data?.detail || 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }, [])

    const remove = useCallback(async (id) => {
        if (!window.confirm('Delete this user?')) {
            return
        }
        try {
            await deleteUser(id)
            await load()
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to delete user')
        }
    }, [load])

    useEffect(() => {
        load()
    }, [load])

    return { users, loading, error, load, remove }
}

const UsersPage = () => {
    const navigate = useNavigate()
    const { users, loading, error, remove } = useUsersData()

    return (
        <div className="page-card">
            <div className="toolbar">
                <div>
                    <h2 className="page-title">Users</h2>
                    <p className="muted">Manage platform users (admin only).</p>
                </div>
                <button type="button" className="btn" onClick={() => navigate('/admin/users/new')}>
                    + New user
                </button>
            </div>
            {loading && <Loader />}
            {error && <div className="error-text">{error}</div>}
            {!loading && !error && (
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.isArray(users) && users.map((user) => (
                            <tr key={user.id}>
                                <td>{user.id}</td>
                                <td>{user.username}</td>
                                <td>{user.email}</td>
                                <td><span className="chip">{user.role}</span></td>
                                <td>{user.status}</td>
                                <td>
                                    <div className="inline-actions">
                                        <Link to={`/admin/users/${user.id}`} className="btn secondary">
                                            View
                                        </Link>
                                        <Link to={`/admin/users/${user.id}/edit`} className="btn">
                                            Edit
                                        </Link>
                                        <button
                                            type="button"
                                            className="btn danger"
                                            onClick={() => remove(user.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

export default UsersPage
