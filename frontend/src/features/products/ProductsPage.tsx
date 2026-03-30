import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Pager } from '@/components/common/Pager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
    ApiError,
    archiveProduct,
    createProduct,
    fetchProducts,
    updateProduct,
    type PaginatedResponse,
    type Product,
} from '@/lib/api'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function ProductsPage() {
    const [products, setProducts] = useState<PaginatedResponse<Product> | null>(null)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [actionKey, setActionKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [name, setName] = useState('')
    const [sku, setSku] = useState('')
    const [description, setDescription] = useState('')
    const [price, setPrice] = useState('0.00')
    const [stock, setStock] = useState('0')
    const [isPublished, setIsPublished] = useState(true)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const nextProducts = await fetchProducts(page)
            setProducts(nextProducts)
        } catch (err) {
            setError(parseErrorMessage(err))
        } finally {
            setIsLoading(false)
        }
    }, [page])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const applyAction = async (key: string, callback: () => Promise<void>) => {
        setActionKey(key)
        setError(null)
        try {
            await callback()
            await refresh()
        } catch (err) {
            setError(parseErrorMessage(err))
        } finally {
            setActionKey(null)
        }
    }

    const createNewProduct = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const stockQty = Number.parseInt(stock, 10)
        if (Number.isNaN(stockQty) || stockQty < 0) {
            setError('Stock quantity must be a non-negative integer')
            return
        }

        await applyAction('product:create', async () => {
            await createProduct({
                name: name.trim(),
                sku: sku.trim() || undefined,
                description: description.trim() || undefined,
                price,
                stock_qty: stockQty,
                status: 'active',
                is_published: isPublished,
                availability: 'in_stock',
            })
            setName('')
            setSku('')
            setDescription('')
            setPrice('0.00')
            setStock('0')
            setIsPublished(true)
        })
    }

    return (
        <section className='space-y-4'>
            <Card>
                <CardHeader>
                    <CardTitle>Create Product</CardTitle>
                    <CardDescription>Add inventory directly from admin dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className='grid gap-3 md:grid-cols-2' onSubmit={(event) => void createNewProduct(event)}>
                        <div className='space-y-2'>
                            <Label htmlFor='product-name'>Name</Label>
                            <Input id='product-name' value={name} onChange={(event) => setName(event.target.value)} required />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='product-sku'>SKU</Label>
                            <Input id='product-sku' value={sku} onChange={(event) => setSku(event.target.value)} />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='product-price'>Price</Label>
                            <Input
                                id='product-price'
                                type='number'
                                min='0'
                                step='0.01'
                                value={price}
                                onChange={(event) => setPrice(event.target.value)}
                                required
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='product-stock'>Stock Qty</Label>
                            <Input
                                id='product-stock'
                                type='number'
                                min='0'
                                step='1'
                                value={stock}
                                onChange={(event) => setStock(event.target.value)}
                                required
                            />
                        </div>
                        <div className='space-y-2 md:col-span-2'>
                            <Label htmlFor='product-description'>Description</Label>
                            <Textarea
                                id='product-description'
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                            />
                        </div>
                        <div className='flex items-center gap-2 md:col-span-2'>
                            <Checkbox
                                id='product-published'
                                checked={isPublished}
                                onCheckedChange={(checked) => setIsPublished(checked === true)}
                            />
                            <Label htmlFor='product-published'>Published</Label>
                        </div>
                        <div className='md:col-span-2'>
                            <Button type='submit' disabled={actionKey === 'product:create'}>
                                {actionKey === 'product:create' ? 'Creating...' : 'Create Product'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Product Management</CardTitle>
                    <CardDescription>Publish, archive, and manage stock</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className='text-right'>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(products?.results ?? []).map((product) => {
                                const key = `product:${product.id}`
                                const isBusy = actionKey === key

                                return (
                                    <TableRow key={product.id}>
                                        <TableCell>{product.id}</TableCell>
                                        <TableCell>{product.name}</TableCell>
                                        <TableCell>{product.price}</TableCell>
                                        <TableCell>{product.stock_qty}</TableCell>
                                        <TableCell>
                                            <div className='flex items-center gap-2'>
                                                <Badge variant='secondary'>{product.status}</Badge>
                                                <Badge variant={product.is_published ? 'default' : 'outline'}>
                                                    {product.is_published ? 'Published' : 'Hidden'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className='text-right'>
                                            <div className='flex justify-end gap-2'>
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    disabled={isBusy}
                                                    onClick={() =>
                                                        void applyAction(key, async () => {
                                                            await updateProduct(product.id, {
                                                                is_published: !product.is_published,
                                                            })
                                                        })
                                                    }
                                                >
                                                    {product.is_published ? 'Hide' : 'Publish'}
                                                </Button>
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    disabled={isBusy || product.status === 'archived'}
                                                    onClick={() =>
                                                        void applyAction(key, async () => {
                                                            await archiveProduct(product.id)
                                                        })
                                                    }
                                                >
                                                    Archive
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    <Pager
                        page={page}
                        hasPrevious={Boolean(products?.previous)}
                        hasNext={Boolean(products?.next)}
                        onPageChange={setPage}
                    />
                    {isLoading ? <p className='text-sm text-muted-foreground'>Loading products...</p> : null}
                </CardContent>
            </Card>
        </section>
    )
}
