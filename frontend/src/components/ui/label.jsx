import { cn } from '../../lib/utils'

const Label = ({ className, htmlFor, children, ...props }) => (
    <label className={cn('text-sm font-medium leading-none text-foreground', className)} htmlFor={htmlFor} {...props}>
        {children}
    </label>
)

export { Label }
