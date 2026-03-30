import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

type MetricCardProps = {
    label: string
    value: string | number
}

export function MetricCard({ label, value }: MetricCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle>{value}</CardTitle>
            </CardHeader>
        </Card>
    )
}
