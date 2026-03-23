import PropTypes from 'prop-types'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const AdminRoute = ({ children }) => {
    const { user } = useAuth()

    if (!user || (!user.is_admin && user.role !== 'admin')) {
        return <Navigate to="/admin" replace />
    }
    return children
}

AdminRoute.propTypes = {
    children: PropTypes.node.isRequired,
}

export default AdminRoute
