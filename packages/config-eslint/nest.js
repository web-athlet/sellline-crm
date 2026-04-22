import base from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Nest DI relies on emitDecoratorMetadata; auto-converting value
      // imports to type-only imports erases the runtime class reference and
      // breaks constructor injection. Keep value imports for injected classes.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
