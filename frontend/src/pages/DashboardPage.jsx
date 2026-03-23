import './DashboardPage.css'
import { useAuth } from '../context/AuthContext'

const DashboardPage = () => {
    const { user } = useAuth()

    return (
        <div className="page-card">
            <h2 className="page-title">Dashboard</h2>
            <p className="muted">Welcome back, {user?.firstname || user?.username}.</p>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Role</div>
                    <div className="stat-value">{user?.role}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Email</div>
                    <div className="stat-value">{user?.email}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Status</div>
                    <div className="stat-value chip">{user?.status || 'active'}</div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage
