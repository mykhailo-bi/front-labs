import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import UserEditPage from './pages/UserEditPage'
import UserViewPage from './pages/UserViewPage'

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
                element={(
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                )}
            >
                <Route index element={<DashboardPage />} />
                <Route
                    path="users"
                    element={(
                        <AdminRoute>
                            <UsersPage />
                        </AdminRoute>
                    )}
                />
                <Route
                    path="users/new"
                    element={(
                        <AdminRoute>
                            <UserEditPage mode="create" />
                        </AdminRoute>
                    )}
                />
                <Route
                    path="users/:userId"
                    element={(
                        <AdminRoute>
                            <UserViewPage />
                        </AdminRoute>
                    )}
                />
                <Route
                    path="users/:userId/edit"
                    element={(
                        <AdminRoute>
                            <UserEditPage mode="edit" />
                        </AdminRoute>
                    )}
                />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
