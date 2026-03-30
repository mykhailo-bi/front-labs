import { useCallback, useEffect, useMemo, useState } from 'react'
import { MetricCard } from '@/components/common/MetricCard'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { ApiError, fetchAggregateReport, type AggregateReport } from '@/lib/api'
import { notify } from '@/lib/notify'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

export function OverviewPage() {
    const [report, setReport] = useState<AggregateReport | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async (showSuccessToast = false) => {
        setIsLoading(true)
        setError(null)
        try {
            const nextReport = await fetchAggregateReport()
            setReport(nextReport)
            if (showSuccessToast) {
                notify.success('Overview refreshed')
            }
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

    const metrics = useMemo(() => {
        if (!report) {
            return []
        }

        return [
            { label: 'Users', value: report.users },
            { label: 'Products', value: report.products },
            { label: 'Orders', value: report.orders },
            { label: 'Paid Orders', value: report.paid_orders },
            { label: 'Revenue', value: `${report.currency} ${report.revenue}` },
            { label: 'MTD Orders', value: report.mtd_orders },
        ]
    }, [report])

    return (
        <section className='space-y-4'>
            <Card>
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                    <CardDescription>Live totals from backend aggregate report</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant='outline' onClick={() => void refresh(true)} disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Refresh'}
                    </Button>
                    {error ? <p className='mt-3 text-sm text-destructive'>{error}</p> : null}
                </CardContent>
            </Card>
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                {metrics.map((item) => (
                    <MetricCard key={item.label} label={item.label} value={item.value} />
                ))}
            </div>
        </section>
    )
}
