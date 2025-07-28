import { globalIgnores } from '@eslint/config-helpers';
import EslintConfigPrettier from 'eslint-config-prettier/flat';
import neostandard from 'neostandard';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  globalIgnores(['.work/', 'dist/', '**/*.d.ts']),
  ...neostandard({
    ts: true,
    env: ['node'],
    semi: true,
  }),
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      camelcase: 'off',
      'lines-between-class-members': 'off',
      'no-dupe-class-members': 'off',
      'no-useless-constructor': 'off',
      'no-void': ['error', { allowAsStatement: true }],

      'import-x/export': 'off',
      'import-x/order': [
        'error',
        {
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/lines-between-class-members': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'memberLike',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allowSingleOrDouble',
          trailingUnderscore: 'allowSingleOrDouble',
        },
        { selector: 'memberLike', modifiers: ['requiresQuotes'], format: null },
        { selector: 'import', format: null },
        {
          selector: 'variableLike',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allowSingleOrDouble',
          trailingUnderscore: 'allowSingleOrDouble',
        },
      ],
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['protected-constructors', 'private-constructors'] },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/test-common/**/*', 'src/test/**/*', 'src/test-v4/**/*'],
    rules: {
      // In test program 'any' may appear on `expect` expressions
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  EslintConfigPrettier
);
