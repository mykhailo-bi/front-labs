import { useCallback, useEffect, useState } from 'react'
import { Pager } from '@/components/common/Pager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { CreateProductModal } from '@/features/products/components/CreateProductModal'
import {
    ApiError,
    archiveProduct,
    createProduct,
    fetchProducts,
    setProductImages,
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

const PAGE_SIZE = 10

export function ProductsPage() {
    const [products, setProducts] = useState<PaginatedResponse<Product> | null>(null)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(true)
    const [actionKey, setActionKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const nextProducts = await fetchProducts(page, PAGE_SIZE)
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

    const createNewProduct = async (input: {
        name: string
        sku?: string
        description?: string
        price: string
        stock_qty: number
        is_published: boolean
        image_ids: number[]
    }) => {
        setActionKey('product:create')
        setError(null)
        try {
            const createdProduct = await createProduct({
                name: input.name,
                sku: input.sku,
                description: input.description,
                price: input.price,
                stock_qty: input.stock_qty,
                is_published: input.is_published,
                status: 'active',
                availability: 'in_stock',
            })

            if (input.image_ids.length > 0) {
                await setProductImages(createdProduct.id, input.image_ids)
            }

            await refresh()
        } catch (err) {
            setError(parseErrorMessage(err))
            throw err
        } finally {
            setActionKey(null)
        }
    }

    const totalPages = products ? Math.max(1, Math.ceil(products.count / PAGE_SIZE)) : 1
    const isServerPaginated =
        Boolean(products?.next || products?.previous) ||
        (products ? products.results.length < products.count : false)
    const visibleProducts = products
        ? isServerPaginated
            ? products.results
            : products.results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        : []
    const hasPreviousPage = isServerPaginated ? Boolean(products?.previous) : page > 1
    const hasNextPage = isServerPaginated ? Boolean(products?.next) : page < totalPages

    return (
        <section className='space-y-4'>
            {error ? <p className='text-sm text-destructive'>{error}</p> : null}

            <Card>
                <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div>
                        <CardTitle>Product Management</CardTitle>
                        <CardDescription>Publish, archive, and manage stock</CardDescription>
                    </div>
                    <CreateProductModal
                        isSubmitting={actionKey === 'product:create'}
                        onValidationError={setError}
                        onCreate={createNewProduct}
                    />
                </CardHeader>
                <CardContent className='space-y-4'>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Images</TableHead>
                                <TableHead className='text-right'>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleProducts.map((product) => {
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
                                        <TableCell>
                                            {(product.image_ids ?? []).length}
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
                        totalPages={totalPages}
                        hasPrevious={hasPreviousPage}
                        hasNext={hasNextPage}
                        disabled={isLoading}
                        onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
                    />
                    {isLoading ? <p className='text-sm text-muted-foreground'>Loading products...</p> : null}
                </CardContent>
            </Card>
        </section>
    )
}
