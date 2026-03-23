import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Database, RefreshCcw } from 'lucide-react'
import Loader from '../components/Loader'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card'
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table'
import {
    DATA_SECTIONS,
    getDataSection,
    normalizeListPayload,
} from './adminDataSections'

const AdminDataSectionPage = () => {
    const { sectionId } = useParams()
    const section = useMemo(() => getDataSection(sectionId || ''), [sectionId])

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!section) {
            return
        }

        setLoading(true)
        setError('')

        try {
            const response = await section.load()
            setRows(normalizeListPayload(response.data))
        } catch (apiError) {
            setRows([])
            setError(apiError?.response?.data?.detail || 'Failed to load data table')
        } finally {
            setLoading(false)
        }
    }, [section])

    useEffect(() => {
        load()
    }, [load])

    if (!section) {
        return <Navigate replace to="/admin/data" />
    }

    return (
        <div className="space-y-4">
            <Card className="border-border/80 bg-card/95">
                <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
                            <Database className="h-3.5 w-3.5" />
                            {section.title}
                        </div>
                        <div className="flex gap-2">
                            <Button asChild type="button" variant="outline">
                                <Link to="/admin/data">All sections</Link>
                            </Button>
                            <Button type="button" variant="outline" onClick={load}>
                                <RefreshCcw className="h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                    <CardDescription>{section.description}</CardDescription>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {DATA_SECTIONS.map((item) => (
                            <Button
                                asChild
                                key={item.key}
                                size="sm"
                                variant={item.key === section.key ? 'default' : 'outline'}
                            >
                                <Link to={`/admin/data/${item.key}`}>{item.title}</Link>
                            </Button>
                        ))}
                    </div>
                </CardHeader>
            </Card>

            {loading && (
                <Card className="border-border/80 bg-card/95">
                    <CardContent className="p-5">
                        <Loader />
                    </CardContent>
                </Card>
            )}

            {error && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <Card className="border-border/80 bg-card/95">
                    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
                        <div>
                            <CardTitle>{section.title} table</CardTitle>
                            <CardDescription>Live API snapshot ({rows.length} rows)</CardDescription>
                        </div>
                        <Badge variant="outline">{rows.length} rows</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {section.columns.map((column) => (
                                        <TableHead key={column.header}>{column.header}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row, rowIndex) => (
                                    <TableRow key={row.id || `${section.key}-${rowIndex}`}>
                                        {section.columns.map((column) => (
                                            <TableCell key={`${column.header}-${row.id || rowIndex}`} className={column.className}>
                                                {column.render(row)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                            {rows.length === 0 && <TableCaption>No records available.</TableCaption>}
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

export default AdminDataSectionPage
