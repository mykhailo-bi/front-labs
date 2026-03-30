import js from '@eslint/js'
import globals from 'globals'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
    recommendedConfig: js.configs.recommended,
})

export default [
    {
        ignores: ['dist', 'node_modules', 'eslint.config.js', 'src/components/ui/**'],
    },
    ...compat.extends('airbnb', 'airbnb-typescript'),
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            globals: globals.browser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: ['./tsconfig.app.json', './tsconfig.node.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            '@typescript-eslint/indent': ['error', 4, { SwitchCase: 1 }],
            '@typescript-eslint/semi': 'off',
            semi: 'off',
            'react/react-in-jsx-scope': 'off',
            'react/jsx-indent': ['error', 4],
            'react/jsx-indent-props': ['error', 4],
            'react/require-default-props': 'off',
            'react/function-component-definition': 'off',
            'react/jsx-one-expression-per-line': 'off',
            'react/jsx-filename-extension': ['error', { extensions: ['.tsx', '.jsx'] }],
            'import/prefer-default-export': 'off',
            'import/extensions': 'off',
            'object-curly-newline': 'off',
            'operator-linebreak': 'off',
            'max-len': 'off',
            'jsx-quotes': 'off',
            'no-void': 'off',
            'no-useless-return': 'off',
            'consistent-return': 'off',
            'no-nested-ternary': 'off',
            'no-restricted-syntax': 'off',
            'import/order': 'off',
            'react/jsx-props-no-spreading': 'off',
            'react/state-in-constructor': 'off',
            'react/sort-comp': 'off',
            'react/destructuring-assignment': 'off',
            'jsx-a11y/img-redundant-alt': 'off',
            '@typescript-eslint/quotes': 'off',
        },
    },
]
