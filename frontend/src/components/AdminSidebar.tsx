import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
    ChevronDown,
    Database,
    LayoutDashboard,
    LogOut,
    ShieldCheck,
    Table2,
    Users,
} from 'lucide-react'
import { Button } from './ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarSeparator,
} from './ui/sidebar'

const PRIMARY_NAV_ITEMS = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/admin/users', label: 'Users', icon: Users },
]

const ADMIN_NAV_ITEMS = [
    { to: '/admin/data', label: 'Data Explorer', icon: Database, exact: true },
]

const DATA_TABLE_NAV_ITEMS = [
    { to: '/admin/data/users', label: 'Users Table' },
    { to: '/admin/data/products', label: 'Products Table' },
    { to: '/admin/data/orders', label: 'Orders Table' },
    { to: '/admin/data/reviews', label: 'Reviews Table' },
    { to: '/admin/data/categories', label: 'Categories Table' },
    { to: '/admin/data/images', label: 'Images Table' },
    { to: '/admin/data/addresses', label: 'Addresses Table' },
]

const getUserLabel = (user) => {
    if (user?.firstname || user?.lastname) {
        return [user.firstname, user.lastname].filter(Boolean).join(' ')
    }
    return user?.username || 'Operator'
}

const getUserInitials = (user) => {
    const label = getUserLabel(user)
    const initials = label
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('')

    return initials || 'OP'
}

const isRouteActive = (pathname, item) => {
    if (item.exact) {
        return pathname === item.to
    }
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

const AdminSidebar = ({ user, onLogout }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const isAdmin = user?.is_admin || user?.role === 'admin'

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="p-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            className="p-3"
                            type="button"
                            variant="outline"
                        >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sidebar-primary text-[10px] font-semibold text-sidebar-primary-foreground">
                                {getUserInitials(user)}
                            </span>
                            <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                                <span className="block truncate text-sm font-medium text-sidebar-foreground">{getUserLabel(user)}</span>
                                <span className="block truncate text-xs text-sidebar-foreground/70">{user?.role || 'user'}</span>
                            </span>
                            <ChevronDown className="h-4 w-4 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="start" className="w-56" side="bottom">
                        <DropdownMenuLabel className="space-y-0.5">
                            <p className="truncate text-sm font-medium text-foreground">{getUserLabel(user)}</p>
                            <p className="truncate text-xs font-normal text-muted-foreground">{user?.email || 'No email'}</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                onSelect={(event) => {
                                    event.preventDefault()
                                    navigate('/admin')
                                }}
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Dashboard
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={(event) => {
                                    event.preventDefault()
                                    navigate('/admin/users')
                                }}
                            >
                                <Users className="h-4 w-4" />
                                User management
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={(event) => {
                                    event.preventDefault()
                                    navigate('/admin/data')
                                }}
                            >
                                <Database className="h-4 w-4" />
                                Data explorer
                            </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onSelect={(event) => {
                                event.preventDefault()
                                onLogout()
                            }}
                            variant="destructive"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarHeader>

            <SidebarSeparator />

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {PRIMARY_NAV_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.to}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isRouteActive(location.pathname, item)}
                                        tooltip={item.label}
                                    >
                                        <NavLink end={item.exact} to={item.to}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.label}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {isAdmin && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Admin</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {ADMIN_NAV_ITEMS.map((item) => (
                                    <SidebarMenuItem key={item.to}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isRouteActive(location.pathname, item)}
                                            tooltip={item.label}
                                        >
                                            <NavLink end={item.exact} to={item.to}>
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.label}</span>
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}

                                {DATA_TABLE_NAV_ITEMS.map((item) => (
                                    <SidebarMenuItem key={item.to}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isRouteActive(location.pathname, item)}
                                            size="sm"
                                            tooltip={item.label}
                                        >
                                            <NavLink to={item.to}>
                                                <Table2 className="h-4 w-4" />
                                                <span>{item.label}</span>
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarSeparator />

            <SidebarFooter className="p-0" />

            <SidebarRail />
        </Sidebar>
    )
}

export default AdminSidebar
