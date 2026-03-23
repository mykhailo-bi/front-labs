import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

const NAV_ITEMS = [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/data', label: 'Data' },
]

const Layout = () => {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    return (
        <div className="relative min-h-screen bg-background text-foreground">
            <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-70" />

            <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 md:px-6 md:py-7">
                <header className="sticky top-4 z-10 mb-6 rounded-xl border border-border/80 bg-card/90 px-4 py-3 shadow-sm backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Front Labs</p>
                                <p className="text-sm font-semibold">Admin Console</p>
                            </div>
                        </div>

                        <nav className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/50 p-1">
                            {NAV_ITEMS.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) => cn(
                                        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:bg-card hover:text-foreground',
                                    )}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>

                        <div className="flex items-center gap-3">
                            <div className="hidden items-center gap-2 sm:flex">
                                <Badge variant="outline" className="gap-1 border-border/80 bg-muted/70 text-xs">
                                    <ShieldCheck className="h-3 w-3" />
                                    {user?.role || 'user'}
                                </Badge>
                                <span className="text-sm font-medium text-muted-foreground">{user?.username}</span>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
                                <LogOut className="h-4 w-4" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </header>

                <main className="flex-1">
                    <Outlet />
                </main>

                <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                    <span>
                        <Link className="font-medium text-foreground" to="/admin">Dashboard Home</Link>
                    </span>
                    <span>Built for Front Labs operations team</span>
                </footer>
            </div>
        </div>
    )
}

export default Layout
