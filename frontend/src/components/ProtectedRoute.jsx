import PropTypes from 'prop-types'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'

const ProtectedRoute = ({ children }) => {
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

ProtectedRoute.propTypes = {
    children: PropTypes.node.isRequired,
}

export default ProtectedRoute
