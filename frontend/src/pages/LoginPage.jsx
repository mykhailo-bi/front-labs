import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import './LoginPage.css'
import { useAuth } from '../context/AuthContext'

const LoginPage = () => {
    const { login, session, loading, error, ready } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [usernameOrEmail, setUsernameOrEmail] = useState('')
    const [password, setPassword] = useState('')
    const [formError, setFormError] = useState('')

    if (ready && session?.access) {
        return <Navigate to="/admin" replace />
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setFormError('')
        try {
            await login({ usernameOrEmail, password })
            const redirectTo = location.state?.from?.pathname || '/admin'
            navigate(redirectTo, { replace: true })
        } catch (err) {
            const apiMessage = err?.response?.data?.detail || 'Invalid credentials'
            setFormError(apiMessage)
        }
    }

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <h1>Front Labs Admin</h1>
                <p className="muted">Sign in to manage users.</p>
                <form onSubmit={handleSubmit} className="login-form">
                    <label className="input-group" htmlFor="username">
                        <span>Username or Email</span>
                        <input
                            id="username"
                            name="username"
                            value={usernameOrEmail}
                            onChange={(e) => setUsernameOrEmail(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </label>
                    <label className="input-group" htmlFor="password">
                        <span>Password</span>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    {formError && <div className="error-text">{formError}</div>}
                    {error && !formError && (
                        <div className="error-text">Unexpected error. Please try again.</div>
                    )}
                    <button type="submit" className="btn" disabled={loading}>
                        {loading ? 'Signing in…' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default LoginPage
