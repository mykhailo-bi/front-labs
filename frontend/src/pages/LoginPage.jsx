import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

const AlertMessage = ({ children }) => (
    <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
        {children}
    </div>
)

const LoginForm = ({
    usernameOrEmail,
    password,
    formError,
    loading,
    error,
    onSubmit,
    onChangeUsername,
    onChangePassword,
}) => (
    <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="username">Username or email</Label>
            <Input
                id="username"
                name="username"
                value={usernameOrEmail}
                onChange={onChangeUsername}
                autoComplete="username"
                required
            />
        </div>

        <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={onChangePassword}
                autoComplete="current-password"
                required
            />
        </div>

        {formError && <AlertMessage>{formError}</AlertMessage>}
        {error && !formError && <AlertMessage>Unexpected error. Please try again.</AlertMessage>}

        <Button type="submit" className="w-full" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? 'Signing in...' : 'Login'}
        </Button>
    </form>
)

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
        <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.2),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.2),transparent)]" />

            <Card className="relative z-10 w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur">
                <CardHeader className="space-y-2">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Secure access
                    </div>
                    <CardTitle className="text-xl">Front Labs Admin</CardTitle>
                    <CardDescription>Sign in to continue to your operations dashboard.</CardDescription>
                </CardHeader>

                <CardContent>
                    <LoginForm
                        usernameOrEmail={usernameOrEmail}
                        password={password}
                        formError={formError}
                        loading={loading}
                        error={error}
                        onSubmit={handleSubmit}
                        onChangeUsername={(e) => setUsernameOrEmail(e.target.value)}
                        onChangePassword={(e) => setPassword(e.target.value)}
                    />
                </CardContent>
            </Card>
        </div>
    )
}

export default LoginPage
