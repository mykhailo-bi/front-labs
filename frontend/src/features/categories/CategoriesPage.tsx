import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreateCategoryModal } from '@/features/categories/components/CreateCategoryModal'
import { EditCategoryModal } from '@/features/categories/components/EditCategoryModal'
import {
    ApiError,
    createCategory,
    deleteCategory,
    fetchCategories,
    updateCategory,
    type Category,
} from '@/lib/api'
import { notify } from '@/lib/notify'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message
    if (error instanceof Error) return error.message
    return 'Unexpected error'
}

export function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const payload = await fetchCategories(1, 100)
            setCategories(payload.results)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const createNew = async (input: { name: string; slug: string; parent_id?: number }) => {
        setBusy('category:create')
        setError(null)
        try {
            await createCategory(input)
            await refresh()
            notify.success('Category created')
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
            throw err
        } finally {
            setBusy(null)
        }
    }

    const updateExisting = async (id: number, input: { name: string; slug: string; parent_id: number | null }) => {
        setBusy(`category:edit:${id}`)
        setError(null)
        try {
            await updateCategory(id, input)
            await refresh()
            notify.success('Category updated')
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setBusy(null)
        }
    }

    const deleteExisting = async (id: number) => {
        setBusy(`category:delete:${id}`)
        setError(null)
        try {
            await deleteCategory(id)
            await refresh()
            notify.success('Category deleted')
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        } finally {
            setBusy(null)
        }
    }

    return (
        <Card>
            <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <CardTitle>Categories</CardTitle>
                </div>
                <CreateCategoryModal
                    isSubmitting={busy === 'category:create'}
                    onValidationError={(message) => {
                        setError(message)
                        notify.error(message)
                    }}
                    onCreate={createNew}
                />
            </CardHeader>
            <CardContent className='space-y-4'>
                {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map((category) => {
                            const isSubmitting =
                                busy === `category:edit:${category.id}` ||
                                busy === `category:delete:${category.id}` ||
                                busy === 'category:create'
                            return (
                                <TableRow key={category.id}>
                                    <TableCell>{category.id}</TableCell>
                                    <TableCell>{category.name}</TableCell>
                                    <TableCell>{category.slug}</TableCell>
                                    <TableCell className='text-right'>
                                        <EditCategoryModal
                                            category={category}
                                            isSubmitting={isSubmitting}
                                            onValidationError={(message) => {
                                                setError(message)
                                                notify.error(message)
                                            }}
                                            onUpdate={updateExisting}
                                            onDelete={deleteExisting}
                                        />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
