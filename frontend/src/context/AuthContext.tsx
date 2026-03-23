import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from 'react'
import { clearAuthHeader, setAuthHeader } from '../services/apiClient'
import { fetchMe, loginRequest, refreshAccess } from '../services/authService'

type AuthUser = {
    id?: number
    username?: string
    email?: string
    firstname?: string
    lastname?: string
    phone?: string
    role?: string
    status?: string
    is_admin?: boolean
    [key: string]: unknown
}

type AuthSession = {
    access?: string
    refresh?: string
    user?: AuthUser | null
} | null

type LoginPayload = {
    usernameOrEmail: string
    password: string
}

type AuthContextValue = {
    session: AuthSession
    user: AuthUser | null
    loading: boolean
    error: unknown
    login: (payload: LoginPayload) => Promise<AuthSession>
    logout: () => void
    refresh: () => Promise<AuthSession>
    ready: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'frontend.auth'

const persistSession = (session: Exclude<AuthSession, null>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

const readSession = (): AuthSession => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return null
        }
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') {
            return null
        }
        return parsed as AuthSession
    } catch (error) {
        return null
    }
}

const dropSession = () => {
    localStorage.removeItem(STORAGE_KEY)
}

const useSyncAuthHeader = (session: AuthSession) => {
    useEffect(() => {
        if (session?.access) {
            setAuthHeader(session.access)
        } else {
            clearAuthHeader()
        }
    }, [session])
}

const useBootstrapSession = (
    session: AuthSession,
    setSession: Dispatch<SetStateAction<AuthSession>>,
    setUser: Dispatch<SetStateAction<AuthUser | null>>,
    setError: Dispatch<SetStateAction<unknown>>,
    logout: () => void,
) => {
    const [bootstrapping, setBootstrapping] = useState(Boolean(session?.access && !session?.user))

    useEffect(() => {
        const bootstrap = async () => {
            if (!session?.access) {
                setBootstrapping(false)
                return
            }

            setBootstrapping(true)

            if (session.user) {
                setUser(session.user)
                setBootstrapping(false)
                return
            }

            try {
                const { data } = await fetchMe()
                const userData = data as AuthUser
                const nextSession = { ...session, user: data }
                setSession((currentSession: AuthSession) => {
                    if (!currentSession?.access || currentSession.access !== session.access) {
                        return currentSession
                    }
                    return { ...currentSession, user: userData }
                })
                setUser(userData)
                persistSession(nextSession)
            } catch (err) {
                setError(err)
                logout()
            } finally {
                setBootstrapping(false)
            }
        }
        bootstrap()
    }, [session?.access, logout, setSession, setUser, setError])

    return bootstrapping
}

const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<AuthSession>(() => readSession())
    const [user, setUser] = useState<AuthUser | null>(() => session?.user || null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<unknown>(null)

    const logout = useCallback(() => {
        dropSession()
        clearAuthHeader()
        setSession(null)
        setUser(null)
    }, [])

    useSyncAuthHeader(session)
    const bootstrapping = useBootstrapSession(session, setSession, setUser, setError, logout)

    const login = useCallback(async ({ usernameOrEmail, password }: LoginPayload) => {
        setLoading(true)
        setError(null)
        try {
            const { data: tokens } = await loginRequest({ usernameOrEmail, password })
            const baseSession = { access: tokens.access, refresh: tokens.refresh }
            setAuthHeader(baseSession.access)
            persistSession(baseSession)
            const { data: me } = await fetchMe()
            const userData = me as AuthUser
            const nextSession = { ...baseSession, user: userData }
            persistSession(nextSession)
            setSession(nextSession)
            setUser(userData)
            return nextSession
        } catch (err) {
            setError(err)
            clearAuthHeader()
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    const refresh = useCallback(async () => {
        if (!session?.refresh) {
            return null
        }
        try {
            const { data } = await refreshAccess(session.refresh)
            const nextSession = { ...session, access: data.access }
            setAuthHeader(nextSession.access)
            persistSession(nextSession)
            setSession(nextSession)
            return nextSession
        } catch (err) {
            logout()
            throw err
        }
    }, [session, logout])

    const value = useMemo<AuthContextValue>(() => ({
        session,
        user,
        loading: loading || bootstrapping,
        error,
        login,
        logout,
        refresh,
        ready: !bootstrapping,
    }), [session, user, loading, bootstrapping, error, login, logout, refresh])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return ctx
}

export { AuthProvider, useAuth }
