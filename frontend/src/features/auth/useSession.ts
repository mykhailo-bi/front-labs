import { useCallback, useEffect, useState } from 'react'
import {
    ApiError,
    clearStoredTokens,
    fetchCurrentUser,
    getStoredTokens,
    login,
    logout,
    setStoredTokens,
    type Tokens,
    type User,
} from '@/lib/api'
import { notify } from '@/lib/notify'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function useSession() {
    const [tokens, setTokens] = useState<Tokens | null>(() => getStoredTokens())
    const [user, setUser] = useState<User | null>(null)
    const [isSessionLoading, setIsSessionLoading] = useState(Boolean(tokens))
    const [isLoginLoading, setIsLoginLoading] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(null)

    const applyTokens = useCallback((next: Tokens | null) => {
        setTokens(next)
        if (next) {
            setStoredTokens(next)
            return
        }
        clearStoredTokens()
    }, [])

    useEffect(() => {
        if (!tokens) {
            setUser(null)
            setIsSessionLoading(false)
            return
        }

        let active = true
        setIsSessionLoading(true)

        void fetchCurrentUser()
            .then((currentUser) => {
                if (!active) {
                    return
                }
                if (!currentUser.is_admin) {
                    applyTokens(null)
                    const message = 'Admin access required for this dashboard'
                    setLoginError(message)
                    notify.error(message)
                    return
                }
                setUser(currentUser)
            })
            .catch((error) => {
                if (!active) {
                    return
                }
                applyTokens(null)
                const message = parseErrorMessage(error)
                setLoginError(message)
                notify.error(message)
            })
            .finally(() => {
                if (active) {
                    setIsSessionLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [applyTokens, tokens])

    const signIn = useCallback(
        async (username: string, password: string) => {
            setLoginError(null)
            setIsLoginLoading(true)
            try {
                const nextTokens = await login(username, password)
                applyTokens(nextTokens)
                const currentUser = await fetchCurrentUser()
                if (!currentUser.is_admin) {
                    applyTokens(null)
                    throw new Error('Admin access required for this dashboard')
                }
                setUser(currentUser)
            } catch (error) {
                const message = parseErrorMessage(error)
                setLoginError(message)
                notify.error(message)
                throw error
            } finally {
                setIsLoginLoading(false)
            }
        },
        [applyTokens],
    )

    const signOut = useCallback(async () => {
        try {
            if (tokens?.refresh) {
                await logout(tokens.refresh)
            }
        } finally {
            applyTokens(null)
            setUser(null)
        }
    }, [applyTokens, tokens])

    return {
        user,
        isAuthenticated: Boolean(tokens && user),
        isSessionLoading,
        isLoginLoading,
        loginError,
        signIn,
        signOut,
    }
}
