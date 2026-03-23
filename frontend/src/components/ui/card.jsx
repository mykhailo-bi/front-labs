import { cn } from '../../lib/utils'

const Card = ({ className, ...props }) => (
    <div
        className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
        {...props}
    />
)

const CardHeader = ({ className, ...props }) => (
    <div className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />
)

const CardTitle = ({ className, children, ...props }) => (
    <h3 className={cn('text-sm font-semibold tracking-tight', className)} {...props}>{children}</h3>
)

const CardDescription = ({ className, children, ...props }) => (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>{children}</p>
)

const CardContent = ({ className, ...props }) => (
    <div className={cn('p-5 pt-0', className)} {...props} />
)

const CardFooter = ({ className, ...props }) => (
    <div className={cn('flex items-center p-5 pt-0', className)} {...props} />
)

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardDescription,
    CardContent,
}
