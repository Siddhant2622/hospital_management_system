import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // ── TypeScript ────────────────────────────────────────────────────────
      // `any` is used intentionally throughout for API response handling,
      // catch blocks, and flexible event handlers in this codebase.
      '@typescript-eslint/no-explicit-any': 'off',

      // Unused vars: warn instead of error; prefix with _ to suppress per-var.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // Allow both @ts-ignore and @ts-expect-error — legacy code uses both.
      '@typescript-eslint/ban-ts-comment': 'off',

      // ── React Hooks ───────────────────────────────────────────────────────
      // The `set-state-in-effect` rule is overly strict for the data-fetching
      // pattern used throughout (calling `load()` inside useEffect is the
      // conventional React pattern and works correctly at runtime).
      'react-hooks/set-state-in-effect': 'off',

      // Missing deps: warn only, since many effects intentionally run once.
      'react-hooks/exhaustive-deps': 'warn',

      // ── React Refresh ─────────────────────────────────────────────────────
      // Context files export both a Provider component and a hook — this is
      // standard practice and does not break Fast Refresh in practice.
      'react-refresh/only-export-components': 'off',

      // ── General ───────────────────────────────────────────────────────────
      // Allow empty catch blocks (used intentionally for silent error handling).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
])
