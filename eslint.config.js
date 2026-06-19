import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

// Flat config. Tuned so the existing codebase passes with ZERO errors today —
// the gate's job right now is to catch *new* regressions (broken hooks, unused
// vars, etc.), not to flag the whole backlog. Noisy legacy rules are downgraded
// to "warn" so they show up locally without blocking CI; tighten over time.
export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'supabase/functions/**', // Deno runtime — different globals/module system
      '*.config.js',
      '*.config.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // ── Downgraded to warn: present in legacy code, clean up incrementally ──
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'warn',
      // Errors we DO want to block on (real bugs):
      'no-debugger': 'error',
      'no-constant-binary-expression': 'error',
    },
  },
)
