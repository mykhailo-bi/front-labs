import { apiClient } from './apiClient'

const fetchAggregateReport = async () => apiClient.get('/reports/aggregate/')

const exportUsersCsv = async () => apiClient.get('/users/export/', {
    responseType: 'blob',
})

export { fetchAggregateReport, exportUsersCsv }
