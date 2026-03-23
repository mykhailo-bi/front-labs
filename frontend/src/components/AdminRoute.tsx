import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type AdminRouteProps = {
    children: ReactNode
}

const AdminRoute = ({ children }: AdminRouteProps) => {
    const { user } = useAuth()

    if (!user || (!user.is_admin && user.role !== 'admin')) {
        return <Navigate to="/admin" replace />
    }
    return children
}

export default AdminRoute
