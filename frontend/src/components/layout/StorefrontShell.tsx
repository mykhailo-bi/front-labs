import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Heart, LogOut, ShoppingBag, ShoppingCart, UserRound, WalletCards } from 'lucide-react'
import { APP_PATHS } from '@/app/paths'
import { ThemeModeToggle } from '@/components/theme/ThemeModeToggle'
import { Button } from '@/components/ui/button'
import { ApiError, fetchCartSummary, type User } from '@/lib/api'

type StorefrontShellProps = {
    user: User
    onLogout: () => Promise<void>
}

export function StorefrontShell({ user, onLogout }: StorefrontShellProps) {
    const location = useLocation()
    const [cartUniqueItemsCount, setCartUniqueItemsCount] = useState(0)

    useEffect(() => {
        let isActive = true

        const loadCartBadge = async () => {
            try {
                const summary = await fetchCartSummary()
                if (!isActive) {
                    return
                }
                setCartUniqueItemsCount(summary.items.length)
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) {
                    if (isActive) {
                        setCartUniqueItemsCount(0)
                    }
                    return
                }
                if (isActive) {
                    setCartUniqueItemsCount(0)
                }
            }
        }

        void loadCartBadge()

        const handleCartUpdated = () => {
            void loadCartBadge()
        }
        window.addEventListener('cart:updated', handleCartUpdated)

        return () => {
            isActive = false
            window.removeEventListener('cart:updated', handleCartUpdated)
        }
    }, [location.pathname])

    const navItems = [
        { href: APP_PATHS.SHOP, title: 'Shop', icon: ShoppingBag },
        { href: APP_PATHS.CART, title: 'Cart', icon: ShoppingCart },
        { href: APP_PATHS.WISHLIST, title: 'Wishlist', icon: Heart },
        { href: APP_PATHS.SAVED, title: 'Saved', icon: WalletCards },
        { href: APP_PATHS.MY_ORDERS, title: 'Orders', icon: ShoppingCart },
        { href: APP_PATHS.ACCOUNT, title: 'Account', icon: UserRound },
    ]

    return (
        <div className='min-h-screen bg-background'>
            <header className='sticky top-0 z-20 border-b bg-background/95 backdrop-blur'>
                <div className='mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3'>
                    <Link to={APP_PATHS.SHOP} className='font-heading text-lg font-semibold tracking-tight'>
                        FrontLabs Store
                    </Link>
                    <nav className='hidden items-center gap-1 md:flex'>
                        {navItems.map((item) => {
                            const active = location.pathname === item.href
                            return (
                                <Button key={item.href} asChild variant={active ? 'default' : 'ghost'} size='sm'>
                                    <Link to={item.href}>
                                        <item.icon className='size-4' />
                                        {item.title}
                                        {item.href === APP_PATHS.CART && cartUniqueItemsCount > 0 ? (
                                            <span className='rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white'>
                                                {cartUniqueItemsCount}
                                            </span>
                                        ) : null}
                                    </Link>
                                </Button>
                            )
                        })}
                    </nav>
                    <div className='flex items-center gap-2'>
                        <span className='hidden text-sm text-muted-foreground sm:inline'>{user.username}</span>
                        <ThemeModeToggle />
                        <Button variant='outline' size='sm' onClick={() => void onLogout()}>
                            <LogOut className='size-4' />
                            Sign out
                        </Button>
                    </div>
                </div>
            </header>
            <main className='mx-auto w-full max-w-6xl px-4 py-5'>
                <Outlet />
            </main>
        </div>
    )
}
