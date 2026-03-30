import { Laptop, Moon, Sun } from 'lucide-react'
import { useThemeMode, type ThemeMode } from '@/components/theme/ThemeModeProvider'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'

const themeModeOptions: Array<{
    value: ThemeMode
    Icon: typeof Sun
}> = [
    {
        value: 'light',
        Icon: Sun,
    },
    {
        value: 'dark',
        Icon: Moon,
    },
    {
        value: 'system',
        Icon: Laptop,
    },
]

export function ThemeModeToggle() {
    const { mode, setMode } = useThemeMode()

    return (
        <ButtonGroup aria-label='Theme mode'>
            {themeModeOptions.map(({ value, Icon }) => {
                const isActive = mode === value

                return (
                    <Button
                        key={value}
                        type='button'
                        size='icon'
                        variant={isActive ? 'default' : 'outline'}
                        aria-pressed={isActive}
                        onClick={() => setMode(value)}
                    >
                        <Icon aria-hidden='true' />
                    </Button>
                )
            })}
        </ButtonGroup>
    )
}
