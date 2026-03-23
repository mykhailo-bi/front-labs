import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { clearAuthHeader, setAuthHeader } from '../services/apiClient'
import { fetchMe, loginRequest, refreshAccess } from '../services/authService'

const AuthContext = createContext(null)

const STORAGE_KEY = 'frontend.auth'

const persistSession = (session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

const readSession = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return null
        }
        return JSON.parse(raw)
    } catch (error) {
        return null
    }
}

const dropSession = () => {
    localStorage.removeItem(STORAGE_KEY)
}

const useSyncAuthHeader = (session) => {
    useEffect(() => {
        if (session?.access) {
            setAuthHeader(session.access)
        } else {
            clearAuthHeader()
        }
    }, [session])
}

const useBootstrapSession = (session, setSession, setUser, setError, logout) => {
    const [bootstrapping, setBootstrapping] = useState(true)

    useEffect(() => {
        const bootstrap = async () => {
            if (!session?.access) {
                setBootstrapping(false)
                return
            }
            try {
                const { data } = await fetchMe()
                const nextSession = { ...session, user: data }
                setSession(nextSession)
                setUser(data)
                persistSession(nextSession)
            } catch (err) {
                setError(err)
                logout()
            } finally {
                setBootstrapping(false)
            }
        }
        bootstrap()
    }, [session, logout, setSession, setUser, setError])

    return bootstrapping
}

const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(() => readSession())
    const [user, setUser] = useState(() => session?.user || null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const logout = useCallback(() => {
        dropSession()
        clearAuthHeader()
        setSession(null)
        setUser(null)
    }, [])

    useSyncAuthHeader(session)
    const bootstrapping = useBootstrapSession(session, setSession, setUser, setError, logout)

    const login = useCallback(async ({ usernameOrEmail, password }) => {
        setLoading(true)
        setError(null)
        try {
            const { data: tokens } = await loginRequest({ usernameOrEmail, password })
            const baseSession = { access: tokens.access, refresh: tokens.refresh }
            setAuthHeader(baseSession.access)
            persistSession(baseSession)
            const { data: me } = await fetchMe()
            const nextSession = { ...baseSession, user: me }
            persistSession(nextSession)
            setSession(nextSession)
            setUser(me)
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

    const value = useMemo(() => ({
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

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
}

const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return ctx
}

export { AuthProvider, useAuth }
