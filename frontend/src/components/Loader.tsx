import { LoaderCircle } from 'lucide-react'

const Loader = () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading...
    </div>
)

export default Loader
