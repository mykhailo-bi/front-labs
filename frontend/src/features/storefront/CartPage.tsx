import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, checkout, fetchCart, fetchCartSummary, fetchStoreProducts, removeCartItem, updateCartItem, type CartItem, type Product } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function CartPage() {
    const [cartItems, setCartItems] = useState<CartItem[]>([])
    const [productsById, setProductsById] = useState<Record<number, Product>>({})
    const [summary, setSummary] = useState<{ total: string; currency: string } | null>(null)
    const [checkoutForm, setCheckoutForm] = useState({
        shipping_full_name: '',
        shipping_phone: '',
        shipping_address_line1: '',
        shipping_address_line2: '',
        shipping_city: '',
        shipping_state: '',
        shipping_postal_code: '',
        shipping_country: '',
        delivery_method: 'standard',
        payment_method: 'card',
        contact_phone: '',
    })
    const [isLoading, setIsLoading] = useState(true)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const [cartRes, summaryRes, productsRes] = await Promise.all([
                fetchCart(1, 200),
                fetchCartSummary(),
                fetchStoreProducts(1, 200),
            ])
            const map: Record<number, Product> = {}
            productsRes.results.forEach((product) => {
                map[product.id] = product
            })
            setProductsById(map)
            setCartItems(cartRes.results)
            setSummary({ total: summaryRes.total, currency: summaryRes.currency })
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const canCheckout = useMemo(() => (
        checkoutForm.shipping_full_name.trim() &&
            checkoutForm.shipping_phone.trim() &&
            checkoutForm.shipping_address_line1.trim() &&
            checkoutForm.shipping_city.trim() &&
            checkoutForm.shipping_postal_code.trim() &&
            checkoutForm.shipping_country.trim() &&
            cartItems.length > 0
    ), [checkoutForm, cartItems.length])

    const applyAction = async (key: string, callback: () => Promise<void>) => {
        setBusyKey(key)
        try {
            await callback()
            await refresh()
        } catch (err) {
            notify.error(parseErrorMessage(err))
        } finally {
            setBusyKey(null)
        }
    }

    return (
        <section className='grid gap-4 lg:grid-cols-3'>
            <Card className='lg:col-span-2'>
                <CardHeader>
                    <CardTitle>Shopping Cart</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                    {cartItems.map((item) => {
                        const product = productsById[item.product_id]
                        return (
                            <div key={item.id} className='flex flex-wrap items-center gap-3 rounded-md border p-3'>
                                <div className='min-w-40 flex-1'>
                                    <p className='font-medium'>{product?.name ?? `Product #${item.product_id}`}</p>
                                    <p className='text-sm text-muted-foreground'>${product?.price ?? '0.00'}</p>
                                </div>
                                <Input
                                    type='number'
                                    min={1}
                                    className='w-24'
                                    value={item.count}
                                    onChange={(event) => {
                                        const nextCount = Number(event.target.value)
                                        setCartItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, count: nextCount } : row)))
                                    }}
                                />
                                <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={Boolean(busyKey)}
                                    onClick={() => void applyAction(`cart:update:${item.id}`, async () => {
                                        await updateCartItem(item.id, { count: item.count })
                                        notify.success('Cart item updated')
                                    })}
                                >
                                    Update
                                </Button>
                                <Button
                                    size='sm'
                                    variant='destructive'
                                    disabled={Boolean(busyKey)}
                                    onClick={() => void applyAction(`cart:remove:${item.id}`, async () => {
                                        await removeCartItem(item.id)
                                        notify.success('Item removed')
                                    })}
                                >
                                    Remove
                                </Button>
                            </div>
                        )
                    })}
                    {isLoading ? <p className='text-sm text-muted-foreground'>Loading cart...</p> : null}
                    {!isLoading && cartItems.length === 0 ? <p className='text-sm text-muted-foreground'>Cart is empty.</p> : null}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Checkout</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <p className='text-sm text-muted-foreground'>Total: {summary ? `${summary.currency} ${summary.total}` : '--'}</p>
                    <div className='space-y-2'>
                        <Label htmlFor='shipping-full-name'>Full Name</Label>
                        <Input id='shipping-full-name' value={checkoutForm.shipping_full_name} onChange={(event) => setCheckoutForm((prev) => ({ ...prev, shipping_full_name: event.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='shipping-phone'>Phone</Label>
                        <Input id='shipping-phone' value={checkoutForm.shipping_phone} onChange={(event) => setCheckoutForm((prev) => ({ ...prev, shipping_phone: event.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='address-line1'>Address Line 1</Label>
                        <Input id='address-line1' value={checkoutForm.shipping_address_line1} onChange={(event) => setCheckoutForm((prev) => ({ ...prev, shipping_address_line1: event.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='address-city'>City</Label>
                        <Input id='address-city' value={checkoutForm.shipping_city} onChange={(event) => setCheckoutForm((prev) => ({ ...prev, shipping_city: event.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='address-postal'>Postal Code</Label>
                        <Input id='address-postal' value={checkoutForm.shipping_postal_code} onChange={(event) => setCheckoutForm((prev) => ({ ...prev, shipping_postal_code: event.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='address-country'>Country</Label>
                        <Input id='address-country' value={checkoutForm.shipping_country} onChange={(event) => setCheckoutForm((prev) => ({ ...prev, shipping_country: event.target.value }))} />
                    </div>
                    <Button
                        disabled={!canCheckout || Boolean(busyKey)}
                        onClick={() => void applyAction('checkout', async () => {
                            await checkout(checkoutForm)
                            notify.success('Order placed')
                        })}
                    >
                        Place order
                    </Button>
                </CardContent>
            </Card>
        </section>
    )
}
