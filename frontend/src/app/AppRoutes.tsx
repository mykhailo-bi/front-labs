import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { APP_PATHS } from '@/app/paths'
import { LoadingView } from '@/components/common/LoadingView'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { useSession } from '@/features/auth/useSession'
import { ImagesPage } from '@/features/images/ImagesPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { UsersPage } from '@/features/users/UsersPage'
import { notify } from '@/lib/notify'

export function AppRoutes() {
    const session = useSession()
    const location = useLocation()
    const navigate = useNavigate()

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

    if (session.isSessionLoading) {
        return <LoadingView text='Loading session...' />
    }

    if (!session.isAuthenticated) {
        if (location.pathname !== APP_PATHS.LOGIN) {
            return <Navigate to={APP_PATHS.LOGIN} replace />
        }
        return (
            <LoginPage
                onLogin={handleLogin}
                isLoading={session.isLoginLoading}
                error={session.loginError}
            />
        )
    }

    if (!session.user) {
        return <LoadingView text='Authentication required.' />
    }

    return (
        <Routes>
            <Route path={APP_PATHS.LOGIN} element={<Navigate to={APP_PATHS.OVERVIEW} replace />} />
            <Route element={<AppShell user={session.user} onLogout={handleLogout} />}>
                <Route path='/' element={<Navigate to={APP_PATHS.OVERVIEW} replace />} />
                <Route path={APP_PATHS.OVERVIEW} element={<OverviewPage />} />
                <Route path={APP_PATHS.USERS} element={<UsersPage currentUserId={session.user.id} />} />
                <Route path={APP_PATHS.PRODUCTS} element={<ProductsPage />} />
                <Route path={APP_PATHS.ORDERS} element={<OrdersPage />} />
                <Route path={APP_PATHS.CATEGORIES} element={<CategoriesPage />} />
                <Route path={APP_PATHS.IMAGES} element={<ImagesPage />} />
            </Route>
            <Route path='*' element={<Navigate to={APP_PATHS.OVERVIEW} replace />} />
        </Routes>
    )
}
