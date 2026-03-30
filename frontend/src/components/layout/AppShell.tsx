import { NavLink, Outlet } from 'react-router-dom'
import { APP_PATHS } from '@/app/paths'
import { ThemeModeToggle } from '@/components/theme/ThemeModeToggle'
import { Button } from '@/components/ui/button'
import type { User } from '@/lib/api'

type AppShellProps = {
    user: User
    onLogout: () => Promise<void>
}

const linkClassName = ({ isActive }: { isActive: boolean }) => {
    if (isActive) {
        return 'rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground'
    }
    return 'rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground'
}

export function AppShell({ user, onLogout }: AppShellProps) {
    return (
        <div className='min-h-screen bg-background'>
            <header className='border-b'>
                <div className='mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                        <h1 className='font-heading text-2xl font-medium'>Admin Dashboard</h1>
                        <p className='text-sm text-muted-foreground'>
                            Signed in as {user.username} ({user.email})
                        </p>
                    </div>
                    <div className='flex items-center gap-2'>
                        <ThemeModeToggle />
                        <Button variant='outline' onClick={() => void onLogout()}>
                            Logout
                        </Button>
                    </div>
                </div>
            </header>
            <div className='mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]'>
                <nav className='flex gap-2 lg:flex-col'>
                    <NavLink className={linkClassName} to={APP_PATHS.OVERVIEW} end>
                        Overview
                    </NavLink>
                    <NavLink className={linkClassName} to={APP_PATHS.USERS}>
                        Users
                    </NavLink>
                    <NavLink className={linkClassName} to={APP_PATHS.PRODUCTS}>
                        Products
                    </NavLink>
                    <NavLink className={linkClassName} to={APP_PATHS.ORDERS}>
                        Orders
                    </NavLink>
                </nav>
                <Outlet />
            </div>
        </div>
    )
}
