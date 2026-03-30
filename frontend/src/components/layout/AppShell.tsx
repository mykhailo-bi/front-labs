import { Link, Outlet, useLocation } from 'react-router-dom'
import { ChevronsUpDown, LayoutDashboard, LogOut, Package, ShoppingCart, Users } from 'lucide-react'
import { APP_PATHS } from '@/app/paths'
import { ThemeModeToggle } from '@/components/theme/ThemeModeToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from '@/components/ui/sidebar'
import type { User } from '@/lib/api'
import { Separator } from '@/components/ui/separator'

type AppShellProps = {
    user: User
    onLogout: () => Promise<void>
}

export function AppShell({ user, onLogout }: AppShellProps) {
    const location = useLocation()
    const navItems = [
        { title: 'Overview', href: APP_PATHS.OVERVIEW, icon: LayoutDashboard },
        { title: 'Users', href: APP_PATHS.USERS, icon: Users },
        { title: 'Products', href: APP_PATHS.PRODUCTS, icon: Package },
        { title: 'Orders', href: APP_PATHS.ORDERS, icon: ShoppingCart },
    ]
    const currentPageTitle =
        navItems.find((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))?.title ??
        'Dashboard'
    const userInitial = user.username.charAt(0).toUpperCase()

    return (
        <SidebarProvider>
            <Sidebar collapsible='icon' variant='inset'>
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild size='lg'>
                                <Link to={APP_PATHS.OVERVIEW}>
                                    <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                                        <LayoutDashboard className='size-4' />
                                    </div>
                                    <div className='grid flex-1 text-left text-sm leading-tight'>
                                        <span className='truncate font-semibold'>Control Center</span>
                                    </div>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>

                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu className='px-2 gap-1'>
                                {navItems.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={location.pathname === item.href}
                                            tooltip={item.title}
                                            className='px-3 py-2'
                                        >
                                            <Link to={item.href}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>

                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                        size='lg'
                                        className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                                    >
                                        <Avatar>
                                            <AvatarFallback>{userInitial}</AvatarFallback>
                                        </Avatar>
                                        <div className='grid flex-1 text-left text-sm leading-tight'>
                                            <span className='truncate font-semibold'>{user.username}</span>
                                            <span className='truncate text-xs'>{user.email}</span>
                                        </div>
                                        <ChevronsUpDown className='ml-auto size-4' />
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align='start' side='top' className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg p-2'>
                                    <div className='flex justify-center py-1'>
                                        <ThemeModeToggle />
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant='destructive' onSelect={() => void onLogout()}>
                                        <LogOut className='size-4' />
                                        <span>Logout</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>

            <SidebarInset>
                <header className='flex h-16 shrink-0 items-center transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
                    <div className='flex items-center gap-2 px-4'>
                        <SidebarTrigger className='-ml-1' />
                        <Separator orientation='vertical' className='mr-1' />
                        <h1 className='text-sm md:text-base'>{currentPageTitle}</h1>
                    </div>
                </header>
                <div className='flex-1 p-3 md:p-5'>
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
