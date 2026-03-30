import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { APP_PATHS } from '@/app/paths'
import { LoadingView } from '@/components/common/LoadingView'
import { AppShell } from '@/components/layout/AppShell'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { useSession } from '@/features/auth/useSession'
import { ImagesPage } from '@/features/images/ImagesPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { UsersPage } from '@/features/users/UsersPage'
import { ErrorPage } from '@/features/errors/ErrorPage'
import { register, requestPasswordReset } from '@/lib/api'
import { notify } from '@/lib/notify'

export function AppRoutes() {
    const session = useSession()
    const location = useLocation()
    const navigate = useNavigate()
    const [isRegisterLoading, setIsRegisterLoading] = useState(false)
    const [registerError, setRegisterError] = useState<string | null>(null)
    const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false)
    const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null)

    const handleLogin = async (username: string, password: string) => {
        try {
            await session.signIn(username, password)
            notify.success('Signed in successfully')
            navigate(APP_PATHS.OVERVIEW, { replace: true })
        } catch {
            return
        }
    }

    const handleLogout = async () => {
        await session.signOut()
        notify.success('Signed out successfully')
        navigate(APP_PATHS.LOGIN, { replace: true })
    }

    const handleRegister = async (payload: { username: string; email: string; password: string }) => {
        setRegisterError(null)
        setIsRegisterLoading(true)
        try {
            await register(payload)
            notify.success('Account created successfully. You can now sign in.')
            navigate(APP_PATHS.LOGIN, { replace: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Registration failed'
            setRegisterError(message)
        } finally {
            setIsRegisterLoading(false)
        }
    }

    const handleForgotPassword = async (email: string) => {
        setForgotPasswordError(null)
        setIsForgotPasswordLoading(true)
        try {
            await requestPasswordReset(email)
            notify.success('If this email exists, reset instructions have been sent.')
            navigate(APP_PATHS.LOGIN, { replace: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to send reset instructions'
            setForgotPasswordError(message)
        } finally {
            setIsForgotPasswordLoading(false)
        }
    }

    if (session.isSessionLoading) {
        return <LoadingView text='Loading session...' />
    }

    const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/'

    if (!session.isAuthenticated) {
        const isPublicAuthRoute =
            location.pathname === APP_PATHS.LOGIN ||
            location.pathname === APP_PATHS.REGISTER ||
            location.pathname === APP_PATHS.FORGOT_PASSWORD ||
            location.pathname === APP_PATHS.ERROR_400 ||
            location.pathname === APP_PATHS.ERROR_403 ||
            location.pathname === APP_PATHS.ERROR_404 ||
            location.pathname === APP_PATHS.ERROR_409 ||
            location.pathname === APP_PATHS.ERROR_429 ||
            location.pathname === APP_PATHS.ERROR_500 ||
            location.pathname === APP_PATHS.ERROR_503

        if (isAdminRoute) {
            return <Navigate to={APP_PATHS.LOGIN} replace />
        }

        if (location.pathname === APP_PATHS.REGISTER) {
            return <RegisterPage onRegister={handleRegister} isLoading={isRegisterLoading} error={registerError} />
        }

        if (location.pathname === APP_PATHS.FORGOT_PASSWORD) {
            return (
                <ForgotPasswordPage
                    onRequestReset={handleForgotPassword}
                    isLoading={isForgotPasswordLoading}
                    error={forgotPasswordError}
                />
            )
        }

        if (location.pathname === APP_PATHS.ERROR_400) {
            return <ErrorPage code={400} />
        }

        if (location.pathname === APP_PATHS.ERROR_403) {
            return <ErrorPage code={403} />
        }

        if (location.pathname === APP_PATHS.ERROR_404) {
            return <ErrorPage code={404} />
        }

        if (location.pathname === APP_PATHS.ERROR_409) {
            return <ErrorPage code={409} />
        }

        if (location.pathname === APP_PATHS.ERROR_429) {
            return <ErrorPage code={429} />
        }

        if (location.pathname === APP_PATHS.ERROR_500) {
            return <ErrorPage code={500} />
        }

        if (location.pathname === APP_PATHS.ERROR_503) {
            return <ErrorPage code={503} />
        }

        if (!isPublicAuthRoute) {
            return <Navigate to={APP_PATHS.ERROR_404} replace />
        }

        return <LoginPage onLogin={handleLogin} isLoading={session.isLoginLoading} error={session.loginError} />
    }

    if (!session.user) {
        return <LoadingView text='Authentication required.' />
    }

    const isAdminUser = session.user.role === 'admin'

    if (isAdminRoute && !isAdminUser) {
        return <ErrorPage code={403} onLogout={() => void handleLogout()} />
    }

    return (
        <Routes>
            <Route path={APP_PATHS.ERROR_400} element={<ErrorPage code={400} />} />
            <Route path={APP_PATHS.ERROR_403} element={<ErrorPage code={403} onLogout={() => void handleLogout()} />} />
            <Route path={APP_PATHS.ERROR_404} element={<ErrorPage code={404} />} />
            <Route path={APP_PATHS.ERROR_409} element={<ErrorPage code={409} />} />
            <Route path={APP_PATHS.ERROR_429} element={<ErrorPage code={429} />} />
            <Route path={APP_PATHS.ERROR_500} element={<ErrorPage code={500} />} />
            <Route path={APP_PATHS.ERROR_503} element={<ErrorPage code={503} />} />
            <Route path={APP_PATHS.LOGIN} element={<Navigate to={APP_PATHS.OVERVIEW} replace />} />
            <Route path={APP_PATHS.REGISTER} element={<Navigate to={APP_PATHS.OVERVIEW} replace />} />
            <Route path={APP_PATHS.FORGOT_PASSWORD} element={<Navigate to={APP_PATHS.OVERVIEW} replace />} />
            <Route element={<AppShell user={session.user} onLogout={handleLogout} />}>
                <Route path='/' element={<Navigate to={APP_PATHS.OVERVIEW} replace />} />
                <Route path={APP_PATHS.OVERVIEW} element={<OverviewPage />} />
                <Route path={APP_PATHS.USERS} element={<UsersPage currentUserId={session.user.id} />} />
                <Route path={APP_PATHS.PRODUCTS} element={<ProductsPage />} />
                <Route path={APP_PATHS.ORDERS} element={<OrdersPage />} />
                <Route path={APP_PATHS.CATEGORIES} element={<CategoriesPage />} />
                <Route path={APP_PATHS.IMAGES} element={<ImagesPage />} />
            </Route>
            <Route path='*' element={<Navigate to={APP_PATHS.ERROR_404} replace />} />
        </Routes>
    )
}
