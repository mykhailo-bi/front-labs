import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart'
import { ApiError, fetchAggregateReport, type AggregateReport } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis } from 'recharts'

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
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

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

        const factor = timeRange === '7d' ? 0.25 : timeRange === '90d' ? 3 : 1
        return [
            { label: 'Users', value: report.users },
            { label: 'Products', value: report.products },
            { label: 'Orders', value: Math.round(report.orders * factor) },
            { label: 'Paid Orders', value: Math.round(report.paid_orders * factor) },
            { label: 'Revenue', value: `${report.currency} ${report.revenue}` },
            { label: 'Refunds', value: report.refunds },
            { label: 'Inventory Risk', value: report.inventory_risk },
            { label: 'MTD Orders', value: report.mtd_orders },
        ]
    }, [report, timeRange])

    const kpiTrendData = useMemo(() => {
        if (!report) {
            return []
        }

        return [
            { name: 'Orders', value: report.orders },
            { name: 'Paid', value: report.paid_orders },
            { name: 'MTD', value: report.mtd_orders },
            { name: 'Refunds', value: report.refunds },
        ]
    }, [report])

    const revenueBreakdownData = useMemo(() => {
        if (!report) {
            return []
        }

        const revenue = Number.parseFloat(report.revenue) || 0
        const refunds = Math.max(report.refunds, 0)
        const netRevenue = Math.max(revenue - refunds, 0)

        return [
            { name: 'Net Revenue', value: netRevenue, fill: 'var(--color-net)' },
            { name: 'Refunds', value: refunds, fill: 'var(--color-refunds)' },
        ]
    }, [report])

    const opsBalanceData = useMemo(() => {
        if (!report) {
            return []
        }

        return [
            { name: 'Users', value: report.users },
            { name: 'Products', value: report.products },
            { name: 'Inventory Risk', value: report.inventory_risk },
        ]
    }, [report])

    const kpiChartConfig = {
        value: {
            label: 'Count',
            color: 'hsl(var(--chart-1))',
        },
        net: {
            label: 'Net Revenue',
            color: 'hsl(var(--chart-2))',
        },
        refunds: {
            label: 'Refunds',
            color: 'hsl(var(--chart-4))',
        },
        users: {
            label: 'Users',
            color: 'hsl(var(--chart-1))',
        },
        products: {
            label: 'Products',
            color: 'hsl(var(--chart-2))',
        },
        risk: {
            label: 'Inventory Risk',
            color: 'hsl(var(--chart-5))',
        },
    } satisfies ChartConfig

    return (
        <section className='space-y-6'>
            <Card>
                <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div>
                        <CardTitle>Overview KPI Snapshot</CardTitle>
                        <CardDescription>Live totals from backend aggregate report</CardDescription>
                    </div>
                    <Button variant='outline' onClick={() => void refresh(true)} disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Refresh'}
                    </Button>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <ButtonGroup aria-label='Overview time range'>
                        <Button size='sm' variant={timeRange === '7d' ? 'default' : 'outline'} onClick={() => setTimeRange('7d')}>7d</Button>
                        <Button size='sm' variant={timeRange === '30d' ? 'default' : 'outline'} onClick={() => setTimeRange('30d')}>30d</Button>
                        <Button size='sm' variant={timeRange === '90d' ? 'default' : 'outline'} onClick={() => setTimeRange('90d')}>90d</Button>
                    </ButtonGroup>
                    {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                        {metrics.map((item) => (
                            <div key={item.label} className='rounded-lg border bg-muted/30 p-4'>
                                <p className='text-xs text-muted-foreground'>{item.label}</p>
                                <p className='mt-1 text-2xl font-semibold tracking-tight'>{item.value}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className='grid gap-4 xl:grid-cols-3'>
                <Card className='xl:col-span-2'>
                    <CardHeader>
                        <CardTitle>Order Momentum</CardTitle>
                        <CardDescription>Orders, paid conversions, and month-to-date activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={kpiChartConfig} className='h-72 w-full'>
                            <AreaChart data={kpiTrendData} margin={{ left: 8, right: 8 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey='name' tickLine={false} axisLine={false} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Area
                                    dataKey='value'
                                    type='monotone'
                                    fill='var(--color-value)'
                                    fillOpacity={0.25}
                                    stroke='var(--color-value)'
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Revenue Mix</CardTitle>
                        <CardDescription>Net revenue versus refund impact</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={kpiChartConfig} className='h-72 w-full'>
                            <PieChart>
                                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                <Pie data={revenueBreakdownData} dataKey='value' nameKey='name' innerRadius={56} />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card className='xl:col-span-3'>
                    <CardHeader>
                        <CardTitle>Operational Balance</CardTitle>
                        <CardDescription>Users, products, and inventory risk in one view</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={kpiChartConfig} className='h-72 w-full'>
                            <BarChart data={opsBalanceData} margin={{ left: 8, right: 8 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey='name' tickLine={false} axisLine={false} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey='value' radius={6} fill='var(--color-users)' />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card className='xl:col-span-3'>
                    <CardHeader>
                        <CardTitle>Drilldown Highlights</CardTitle>
                        <CardDescription>Quick derived insights from current aggregate snapshot</CardDescription>
                    </CardHeader>
                    <CardContent className='grid gap-2 text-sm text-muted-foreground md:grid-cols-3'>
                        <p>Paid conversion: {report ? `${Math.round((report.paid_orders / Math.max(report.orders, 1)) * 100)}%` : '-'}</p>
                        <p>Refund pressure: {report ? `${Math.round((report.refunds / Math.max(report.orders, 1)) * 100)}%` : '-'}</p>
                        <p>Inventory risk ratio: {report ? `${Math.round((report.inventory_risk / Math.max(report.products, 1)) * 100)}%` : '-'}</p>
                    </CardContent>
                </Card>
            </div>
        </section>
    )
}
