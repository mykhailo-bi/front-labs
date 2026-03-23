import { Link } from 'react-router-dom'
import { ArrowRight, Database, Table2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card'
import { DATA_SECTIONS } from './adminDataSections'

const AdminDataPage = () => (
    <div className="space-y-4">
        <Card className="border-border/80 bg-card/95">
            <CardHeader className="space-y-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    Data Explorer
                </div>
                <div>
                    <CardTitle>Entity tables</CardTitle>
                    <CardDescription>
                        Each API snapshot table now lives on its own dedicated page.
                    </CardDescription>
                </div>
            </CardHeader>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DATA_SECTIONS.map((section) => (
                <Card className="border-border/80 bg-card/95" key={section.key}>
                    <CardHeader className="space-y-2 pb-3">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            <Table2 className="h-3.5 w-3.5" />
                            {section.title}
                        </div>
                        <CardDescription>{section.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full justify-between" variant="outline">
                            <Link to={`/admin/data/${section.key}`}>
                                Open table
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
)

export default AdminDataPage
