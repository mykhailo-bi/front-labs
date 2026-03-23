import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { fetchAggregateReport, exportUsersCsv } from '../services/adminService'
import { listUsers } from '../services/userService'
import './DashboardPage.css'

const STAT_ITEMS = [
    { label: 'Users', key: 'users' },
    { label: 'Products', key: 'products' },
    { label: 'Total orders', key: 'orders' },
    { label: 'Paid orders', key: 'paid_orders' },
    { label: 'Refund requests', key: 'refunds' },
    { label: 'Inventory at risk', key: 'inventory_risk' },
    { label: 'Orders this month', key: 'mtd_orders' },
]

const normalizeUsers = (payload) => {
    if (Array.isArray(payload)) {
        return payload
    }
    if (Array.isArray(payload?.results)) {
        return payload.results
    }
    return []
}

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}

const useDashboardData = () => {
    const [stats, setStats] = useState(null)
    const [recentUsers, setRecentUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [{ data: reportData }, { data: usersData }] = await Promise.all([
                fetchAggregateReport(),
                listUsers({ ordering: '-created_at' }),
            ])
            setStats(reportData)
            setRecentUsers(normalizeUsers(usersData).slice(0, 5))
        } catch (err) {
            setStats(null)
            setRecentUsers([])
            setError(err?.response?.data?.detail || 'Failed to load dashboard metrics')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    return { stats, recentUsers, loading, error, setError, reload: load }
}

const DashboardHeader = ({ fullName, exporting, onRefresh, onExport, onCreateUser }) => (
    <div className="toolbar">
        <div>
            <h2 className="page-title">Admin dashboard</h2>
            <p className="muted">Welcome back, {fullName}. Here is your platform snapshot.</p>
        </div>
        <div className="inline-actions">
            <button type="button" className="btn secondary" onClick={onRefresh}>Refresh</button>
            <button type="button" className="btn" disabled={exporting} onClick={onExport}>
                {exporting ? 'Exporting...' : 'Export users CSV'}
            </button>
            <button type="button" className="btn" onClick={onCreateUser}>+ New user</button>
        </div>
    </div>
)

const StatsGrid = ({ stats }) => (
    <div className="stats-grid">
        {STAT_ITEMS.map((item) => (
            <div className="stat-card" key={item.key}>
                <div className="stat-label">{item.label}</div>
                <div className="stat-value">{stats[item.key]}</div>
            </div>
        ))}
        <div className="stat-card">
            <div className="stat-label">Revenue ({stats.currency})</div>
            <div className="stat-value">{stats.revenue}</div>
        </div>
    </div>
)

const RecentUsersTable = ({ users, onOpenManagement }) => (
    <div className="dashboard-panel">
        <div className="toolbar compact">
            <h3 className="dashboard-subtitle">Recently created users</h3>
            <button type="button" className="btn secondary" onClick={onOpenManagement}>
                Open user management
            </button>
        </div>
        <table className="table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {users.map((recentUser) => (
                    <tr key={recentUser.id}>
                        <td>{recentUser.id}</td>
                        <td>{recentUser.username}</td>
                        <td>{recentUser.email}</td>
                        <td><span className="chip">{recentUser.role}</span></td>
                        <td>{recentUser.status}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
)

const SessionMeta = ({ user }) => (
    <div className="dashboard-footer-meta">
        <span className="chip">Role: {user?.role}</span>
        <span className="muted">Signed in as {user?.email}</span>
        <span className="muted">Status: {user?.status || 'active'}</span>
    </div>
)

const DashboardPage = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { stats, recentUsers, loading, error, setError, reload } = useDashboardData()
    const [exporting, setExporting] = useState(false)

    const fullName = useMemo(() => {
        if (user?.firstname || user?.lastname) {
            return [user.firstname, user.lastname].filter(Boolean).join(' ')
        }
        return user?.username
    }, [user])

    const handleExportUsers = useCallback(async () => {
        setExporting(true)
        setError('')
        try {
            const { data } = await exportUsersCsv()
            downloadBlob(new Blob([data], { type: 'text/csv' }), 'users.csv')
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to export users')
        } finally {
            setExporting(false)
        }
    }, [setError])

    const openCreateUser = useCallback(() => navigate('/admin/users/new'), [navigate])
    const openUserManagement = useCallback(() => navigate('/admin/users'), [navigate])

    return (
        <div className="page-card">
            <DashboardHeader
                fullName={fullName}
                exporting={exporting}
                onRefresh={reload}
                onExport={handleExportUsers}
                onCreateUser={openCreateUser}
            />

            {loading && <Loader />}
            {error && <div className="error-text">{error}</div>}

            {!loading && !error && stats && (
                <>
                    <StatsGrid stats={stats} />
                    <RecentUsersTable users={recentUsers} onOpenManagement={openUserManagement} />
                </>
            )}

            {!loading && !error && !stats && <div className="muted">No dashboard data available.</div>}

            <SessionMeta user={user} />
            {!loading && !error && stats && recentUsers.length === 0 && (
                <div className="muted dashboard-empty">No users found yet.</div>
            )}
        </div>
    )
}

export default DashboardPage
