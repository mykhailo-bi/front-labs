import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'

type ProtectedRouteProps = {
    children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { session, ready } = useAuth()
    const location = useLocation()

    if (!ready) {
        return <Loader />
    }

    if (!session?.access) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }
    return children
}

export default ProtectedRoute
