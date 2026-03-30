const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

const TOKENS_KEY = 'admin_dashboard_tokens'

export type Tokens = {
    access: string
    refresh: string
}

export type PaginatedResponse<T> = {
    count: number
    next: string | null
    previous: string | null
    results: T[]
}

export class ApiError extends Error {
    status: number
    details: unknown

    constructor(message: string, status: number, details: unknown) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.details = details
    }
}

export function getStoredTokens(): Tokens | null {
    const raw = localStorage.getItem(TOKENS_KEY)
    if (!raw) {
        return null
    }

    try {
        const parsed = JSON.parse(raw) as Partial<Tokens>
        if (parsed.access && parsed.refresh) {
            return { access: parsed.access, refresh: parsed.refresh }
        }
    } catch {
        return null
    }

    return null
}

export function setStoredTokens(tokens: Tokens): void {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

export function clearStoredTokens(): void {
    localStorage.removeItem(TOKENS_KEY)
}

function getErrorMessage(payload: unknown): string {
    if (!payload) {
        return 'Request failed'
    }

    if (typeof payload === 'string') {
        return payload
    }

    if (typeof payload === 'object') {
        const maybe = payload as Record<string, unknown>

        if (typeof maybe.message === 'string') {
            return maybe.message
        }

        if (typeof maybe.detail === 'string') {
            return maybe.detail
        }

        const nonField = maybe.non_field_errors
        if (Array.isArray(nonField) && nonField.length > 0) {
            return String(nonField[0])
        }

        for (const value of Object.values(maybe)) {
            if (typeof value === 'string') {
                return value
            }
            if (Array.isArray(value) && value.length > 0) {
                return String(value[0])
            }
        }
    }

    return 'Request failed'
}

async function parseResponse(response: Response): Promise<unknown> {
    if (response.status === 204) {
        return null
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
        return response.json()
    }

    return response.text()
}

type RequestOptions = {
    method?: string
    body?: string
    authToken?: string
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
    }

    if (options.body) {
        headers['Content-Type'] = 'application/json'
    }

    if (options.authToken) {
        headers.Authorization = `Bearer ${options.authToken}`
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body,
    })

    const payload = await parseResponse(response)
    if (!response.ok) {
        throw new ApiError(getErrorMessage(payload), response.status, payload)
    }

    return payload as T
}

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(current: Tokens): Promise<string> {
    if (!refreshPromise) {
        refreshPromise = request<{ access: string }>('/auth/refresh/', {
            method: 'POST',
            body: JSON.stringify({ refresh: current.refresh }),
        })
            .then((result) => result.access)
            .finally(() => {
                refreshPromise = null
            })
    }

    return refreshPromise
}

export async function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const current = getStoredTokens()
    if (!current) {
        throw new ApiError('Not authenticated', 401, null)
    }

    try {
        return await request<T>(path, { ...options, authToken: current.access })
    } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
            throw error
        }

        try {
            const newAccess = await refreshAccessToken(current)
            setStoredTokens({ ...current, access: newAccess })
            return await request<T>(path, { ...options, authToken: newAccess })
        } catch {
            clearStoredTokens()
            throw new ApiError('Session expired. Please log in again.', 401, null)
        }
    }
}

export async function authFormRequest<T>(path: string, formData: FormData): Promise<T> {
    const current = getStoredTokens()
    if (!current) {
        throw new ApiError('Not authenticated', 401, null)
    }

    const doFetch = async (access: string) => {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${access}`,
                Accept: 'application/json',
            },
            body: formData,
        })
        const payload = await parseResponse(response)
        if (!response.ok) {
            throw new ApiError(getErrorMessage(payload), response.status, payload)
        }
        return payload as T
    }

    try {
        return await doFetch(current.access)
    } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
            throw error
        }
        try {
            const newAccess = await refreshAccessToken(current)
            setStoredTokens({ ...current, access: newAccess })
            return await doFetch(newAccess)
        } catch {
            clearStoredTokens()
            throw new ApiError('Session expired. Please log in again.', 401, null)
        }
    }
}

export function paginated<T>(payload: unknown): PaginatedResponse<T> {
    const data = payload as Partial<PaginatedResponse<T>>
    return {
        count: Number(data.count ?? 0),
        next: (data.next as string | null) ?? null,
        previous: (data.previous as string | null) ?? null,
        results: Array.isArray(data.results) ? data.results : [],
    }
}
