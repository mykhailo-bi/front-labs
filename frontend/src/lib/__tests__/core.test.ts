import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    ApiError,
    authFormRequest,
    authRequest,
    clearStoredTokens,
    getStoredTokens,
    paginated,
    request,
    setStoredTokens,
} from '@/lib/api/core'

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

function textResponse(body: string, status = 200): Response {
    return new Response(body, {
        status,
        headers: { 'content-type': 'text/plain' },
    })
}

describe('api/core', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('stores and reads tokens from localStorage', () => {
        setStoredTokens({ access: 'access-token', refresh: 'refresh-token' })

        expect(getStoredTokens()).toEqual({
            access: 'access-token',
            refresh: 'refresh-token',
        })

        clearStoredTokens()
        expect(getStoredTokens()).toBeNull()
    })

    it('returns null for malformed token payload', () => {
        localStorage.setItem('admin_dashboard_tokens', '{broken-json')

        expect(getStoredTokens()).toBeNull()
    })

    it('makes request with default method and parses json', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
        vi.stubGlobal('fetch', fetchMock)

        const result = await request<{ ok: boolean }>('/ping')

        expect(result.ok).toBe(true)
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/ping', {
            method: 'GET',
            headers: { Accept: 'application/json' },
            body: undefined,
        })
    })

    it('adds content-type and authorization when body and token are provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1 }))
        vi.stubGlobal('fetch', fetchMock)

        await request('/orders', {
            method: 'POST',
            body: JSON.stringify({ value: 1 }),
            authToken: 'token-1',
        })

        expect(fetchMock).toHaveBeenCalledWith('/api/v1/orders', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer token-1',
            },
            body: '{"value":1}',
        })
    })

    it('throws ApiError with payload message for failed requests', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Denied' }, 403)))

        await expect(request('/secure')).rejects.toMatchObject({
            name: 'ApiError',
            message: 'Denied',
            status: 403,
        })
    })

    it('uses text payload for non-json responses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse('Forbidden', 403)))

        await expect(request('/secure')).rejects.toMatchObject({
            name: 'ApiError',
            message: 'Forbidden',
            status: 403,
        })
    })

    it('returns null payload for 204 response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

        const result = await request<null>('/empty')
        expect(result).toBeNull()
    })

    it('authRequest refreshes token after 401 and retries request', async () => {
        setStoredTokens({ access: 'old-access', refresh: 'refresh-1' })

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ detail: 'Expired' }, 401))
            .mockResolvedValueOnce(jsonResponse({ access: 'new-access' }))
            .mockResolvedValueOnce(jsonResponse({ ok: true }))
        vi.stubGlobal('fetch', fetchMock)

        const result = await authRequest<{ ok: boolean }>('/me')

        expect(result.ok).toBe(true)
        expect(getStoredTokens()).toEqual({ access: 'new-access', refresh: 'refresh-1' })
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('authRequest clears tokens when refresh fails', async () => {
        setStoredTokens({ access: 'old-access', refresh: 'refresh-1' })

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ detail: 'Expired' }, 401))
            .mockResolvedValueOnce(jsonResponse({ detail: 'Bad refresh' }, 401))
        vi.stubGlobal('fetch', fetchMock)

        await expect(authRequest('/me')).rejects.toMatchObject({
            name: 'ApiError',
            message: 'Session expired. Please log in again.',
            status: 401,
        })
        expect(getStoredTokens()).toBeNull()
    })

    it('authRequest throws when no stored tokens exist', async () => {
        await expect(authRequest('/me')).rejects.toMatchObject({
            name: 'ApiError',
            message: 'Not authenticated',
            status: 401,
        })
    })

    it('authFormRequest retries after refresh', async () => {
        setStoredTokens({ access: 'old-access', refresh: 'refresh-1' })

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ detail: 'Expired' }, 401))
            .mockResolvedValueOnce(jsonResponse({ access: 'new-access' }))
            .mockResolvedValueOnce(jsonResponse({ uploaded: true }))
        vi.stubGlobal('fetch', fetchMock)

        const formData = new FormData()
        formData.set('name', 'img.png')
        const result = await authFormRequest<{ uploaded: boolean }>('/upload', formData)

        expect(result.uploaded).toBe(true)
        expect(getStoredTokens()).toEqual({ access: 'new-access', refresh: 'refresh-1' })
    })

    it('authFormRequest throws Session expired when refresh fails', async () => {
        setStoredTokens({ access: 'old-access', refresh: 'refresh-1' })

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ detail: 'Expired' }, 401))
            .mockResolvedValueOnce(jsonResponse({ detail: 'Bad refresh' }, 401))
        vi.stubGlobal('fetch', fetchMock)

        const formData = new FormData()
        await expect(authFormRequest('/upload', formData)).rejects.toMatchObject({
            name: 'ApiError',
            message: 'Session expired. Please log in again.',
            status: 401,
        })
        expect(getStoredTokens()).toBeNull()
    })

    it('paginated normalizes unknown payload', () => {
        const normalized = paginated<number>({ count: '12', results: [1, 2, 3] })
        expect(normalized).toEqual({
            count: 12,
            next: null,
            previous: null,
            results: [1, 2, 3],
        })

        expect(paginated<number>({})).toEqual({
            count: 0,
            next: null,
            previous: null,
            results: [],
        })
    })

    it('creates ApiError with details', () => {
        const error = new ApiError('Boom', 500, { trace: true })
        expect(error.name).toBe('ApiError')
        expect(error.status).toBe(500)
        expect(error.details).toEqual({ trace: true })
    })
})
