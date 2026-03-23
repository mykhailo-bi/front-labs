import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Clock3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar'
import AdminSidebar from './AdminSidebar'

const resolvePageMeta = (pathname) => {
    if (pathname === '/admin') {
        return {
            title: 'Operations Dashboard',
            description: 'Real-time platform health and activity metrics.',
            badge: 'Overview',
        }
    }

    if (/^\/admin\/users\/[^/]+\/edit$/.test(pathname)) {
        return {
            title: 'Edit User',
            description: 'Update access role, status, and profile details.',
            badge: 'Users',
        }
    }

    if (/^\/admin\/users\/[^/]+$/.test(pathname)) {
        return {
            title: 'User Details',
            description: 'Inspect account metadata and audit context.',
            badge: 'Users',
        }
    }

    if (pathname === '/admin/users/new') {
        return {
            title: 'Create User',
            description: 'Provision a new account and permissions.',
            badge: 'Users',
        }
    }

    if (pathname.startsWith('/admin/users')) {
        return {
            title: 'User Management',
            description: 'Manage accounts, roles, and status in one place.',
            badge: 'Users',
        }
    }

    if (pathname.startsWith('/admin/data')) {
        return {
            title: 'Data Explorer',
            description: 'Live API snapshots for core commerce entities.',
            badge: 'Data',
        }
    }

    return {
        title: 'Admin Console',
        description: 'Operational controls and reporting workspace.',
        badge: 'Admin',
    }
}

const Layout = () => {
    const { user, logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const pageMeta = useMemo(() => resolvePageMeta(location.pathname), [location.pathname])

    const handleLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    return (
        <SidebarProvider defaultOpen>
            <AdminSidebar onLogout={handleLogout} user={user} />
            <SidebarInset>
                <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-fade opacity-70" />

                <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur">
                    <div className="flex h-16 items-center gap-3 px-4 md:px-6">
                        <SidebarTrigger className="shrink-0" />
                        <Separator className="h-5" orientation="vertical" />

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{pageMeta.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{pageMeta.description}</p>
                        </div>

                        <Badge className="hidden sm:inline-flex" variant="outline">{pageMeta.badge}</Badge>
                    </div>
                </header>

                <main className="flex-1">
                    <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">
                        <Outlet />
                    </div>
                </main>

                <footer className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground md:px-6">
                    Administrative workspace for platform operations.
                </footer>
            </SidebarInset>
        </SidebarProvider>
    )
}

export default Layout
