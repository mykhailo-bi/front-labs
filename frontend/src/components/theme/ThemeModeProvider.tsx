import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeModeContextValue = {
    mode: ThemeMode
    setMode: (mode: ThemeMode) => void
}

const THEME_MODE_STORAGE_KEY = 'theme-mode'
const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

const readStoredThemeMode = (): ThemeMode => {
    if (typeof window === 'undefined') {
        return 'system'
    }

    const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY)
    if (storedThemeMode === 'light' || storedThemeMode === 'dark' || storedThemeMode === 'system') {
        return storedThemeMode
    }

    return 'system'
}

const getResolvedTheme = (mode: ThemeMode): 'light' | 'dark' => {
    if (mode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode
}

const applyThemeModeToDocument = (mode: ThemeMode) => {
    const resolvedTheme = getResolvedTheme(mode)
    const rootElement = document.documentElement

    rootElement.classList.toggle('dark', resolvedTheme === 'dark')
    rootElement.style.colorScheme = resolvedTheme
}

type ThemeModeProviderProps = {
    children: ReactNode
}

export function ThemeModeProvider({ children }: ThemeModeProviderProps) {
    const [mode, setMode] = useState<ThemeMode>(readStoredThemeMode)

    useEffect(() => {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
        applyThemeModeToDocument(mode)

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleThemeChange = () => {
            if (mode === 'system') {
                applyThemeModeToDocument('system')
            }
        }

        mediaQuery.addEventListener('change', handleThemeChange)

        return () => {
            mediaQuery.removeEventListener('change', handleThemeChange)
        }
    }, [mode])

    const value = useMemo(
        () => ({
            mode,
            setMode,
        }),
        [mode],
    )

    return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}

export function useThemeMode() {
    const context = useContext(ThemeModeContext)

    if (!context) {
        throw new Error('useThemeMode must be used within ThemeModeProvider')
    }

    return context
}
