import { authRequest, request } from '@/lib/api/core'
import type { AggregateReport, User } from '@/lib/api/types'
import type { Tokens } from '@/lib/api/core'

export async function login(username_or_email: string, password: string): Promise<Tokens> {
    return request<Tokens>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ username_or_email, password }),
    })
}

export async function register(payload: {
    username: string
    email: string
    password: string
    firstname?: string
    lastname?: string
}): Promise<{ user: User; access: string; refresh: string }> {
    return request<{ user: User; access: string; refresh: string }>('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function requestPasswordReset(email: string): Promise<void> {
    await request<void>('/auth/password-reset/', {
        method: 'POST',
        body: JSON.stringify({ email }),
    })
}

export async function logout(refresh: string): Promise<void> {
    await authRequest<void>('/auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
    })
}

export async function fetchCurrentUser(): Promise<User> {
    return authRequest<User>('/me/')
}

export async function fetchAggregateReport(): Promise<AggregateReport> {
    return authRequest<AggregateReport>('/reports/aggregate/')
}
