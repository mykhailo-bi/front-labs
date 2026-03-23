import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

const Layout = () => {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="brand">Front Labs Admin</div>
                <nav className="nav">
                    <NavLink to="/admin" end className="nav-link">
                        Dashboard
                    </NavLink>
                    <NavLink to="/admin/users" className="nav-link">
                        Users
                    </NavLink>
                </nav>
                <div className="profile">
                    <div className="user-meta">
                        <div className="user-name">{user?.username}</div>
                        <div className="user-role">{user?.role}</div>
                    </div>
                    <button type="button" className="ghost" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </header>
            <main className="app-main">
                <Outlet />
            </main>
            <footer className="app-footer">
                <span>
                    <Link to="/admin">Home</Link>
                </span>
                <span>Built for Front Labs</span>
            </footer>
        </div>
    )
}

export default Layout
