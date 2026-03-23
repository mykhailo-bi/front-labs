import axios from 'axios'

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 7000,
})

const setAuthHeader = (accessToken) => {
    if (accessToken) {
        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`
    }
}

const clearAuthHeader = () => {
    delete apiClient.defaults.headers.common.Authorization
}

export { apiClient, setAuthHeader, clearAuthHeader }
