import { apiClient } from './apiClient'

const loginRequest = async ({ usernameOrEmail, password }) => apiClient.post('/auth/login/', {
    username_or_email: usernameOrEmail,
    password,
})

const refreshAccess = async (refresh) => apiClient.post('/auth/refresh/', { refresh })

const fetchMe = async () => apiClient.get('/me/')

export { loginRequest, refreshAccess, fetchMe }
