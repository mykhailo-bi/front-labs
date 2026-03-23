import { apiClient } from './apiClient'

const fetchAggregateReport = async () => apiClient.get('/reports/aggregate/')

const listProducts = async (params = {}) => apiClient.get('/products/', { params })

const listOrders = async (params = {}) => apiClient.get('/orders/', { params })

const listReviews = async (params = {}) => apiClient.get('/reviews/', { params })

const listCategories = async (params = {}) => apiClient.get('/categories/', { params })

const listImages = async (params = {}) => apiClient.get('/images/', { params })

const listAddresses = async (params = {}) => apiClient.get('/addresses/', { params })

const exportUsersCsv = async () => apiClient.get('/users/export/', {
    responseType: 'blob',
})

export {
    fetchAggregateReport,
    listProducts,
    listOrders,
    listReviews,
    listCategories,
    listImages,
    listAddresses,
    exportUsersCsv,
}
