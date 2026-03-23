import { apiClient } from './apiClient'

const listUsers = async (params = {}) => apiClient.get('/users/', { params })

const getUser = async (id) => apiClient.get(`/users/${id}/`)

const createUser = async (payload) => apiClient.post('/users/', payload)

const updateUser = async (id, payload) => apiClient.put(`/users/${id}/`, payload)

const deleteUser = async (id) => apiClient.delete(`/users/${id}/`)

export { listUsers, getUser, createUser, updateUser, deleteUser }
