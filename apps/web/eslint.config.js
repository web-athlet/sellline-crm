import next from '@sellline/config-eslint/next.js';

export default [
  ...next,
  {
    // shadcn/ui primitives + shadcn-managed hooks track upstream;
    // we treat them as vendored and skip repo lint rules that would
    // force local divergence from the registry.
    files: ['components/ui/**/*.{ts,tsx}', 'lib/hooks/use-toast.ts', 'lib/hooks/use-mobile.tsx'],
    rules: {
      'import/order': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'unicorn/filename-case': 'off',
      'react/display-name': 'off',
      'react/no-unknown-property': 'off',
    },
  },
];
