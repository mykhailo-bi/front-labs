import { authFormRequest, authRequest, paginated } from '@/lib/api/core'
import type { Order, User, UserInvite } from '@/lib/api/types'
import type { PaginatedResponse } from '@/lib/api/core'

export async function fetchUsers(page = 1, pageSize?: number): Promise<PaginatedResponse<User>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/users/?page=${page}${pageSizeQuery}`)
    return paginated<User>(data)
}

export async function updateUser(id: number, payload: Partial<Pick<User, 'status' | 'role'>>): Promise<User> {
    return authRequest<User>(`/users/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

export async function updateUserProfile(
    id: number,
    payload: Partial<{
        username: string
        email: string
        password: string
        firstname: string
        lastname: string
        role: 'admin' | 'customer'
        status: 'active' | 'suspended'
    }>,
): Promise<User> {
    return authRequest<User>(`/users/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

export async function deleteUser(id: number): Promise<void> {
    await authRequest<void>(`/users/${id}/`, {
        method: 'DELETE',
    })
}

export async function createUser(payload: {
    username: string
    email: string
    password: string
    firstname?: string
    lastname?: string
    role: 'admin' | 'customer'
    status: 'active' | 'suspended'
}): Promise<User> {
    return authRequest<User>('/users/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function fetchUserOrders(id: number, page = 1, pageSize?: number): Promise<PaginatedResponse<Order>> {
    const pageSizeQuery = pageSize ? `&page_size=${pageSize}` : ''
    const data = await authRequest<unknown>(`/users/${id}/orders/?page=${page}${pageSizeQuery}`)
    return paginated<Order>(data)
}

export async function createUserInvite(payload: { email: string; role: 'admin' | 'customer' }): Promise<UserInvite> {
    return authRequest<UserInvite>('/users/invites/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function exportUsersCsv(): Promise<string> {
    return authRequest<string>('/users/export/')
}

export async function importUsersCsv(file: File): Promise<{ created: number; updated: number; errors?: unknown[] }> {
    const form = new FormData()
    form.append('file', file)
    return authFormRequest<{ created: number; updated: number; errors?: unknown[] }>('/users/import/', form)
}
