module.exports = {
  ignorePatterns: ['/dist', '/data/in', '/data/out'],
  extends: [
    'alloy',
    'alloy/react',
    'alloy/typescript',
    'plugin:react-hooks/recommended',
  ],
  env: {
    browser: true,
    es2020: true,
  },
  rules: {
    'getter-return': 'off',
    'no-restricted-globals': ['error', ...require('confusing-browser-globals')],
    'complexity': 'off',
    'max-depth': 'off',
    'max-nested-callbacks': 'off',
    'max-params': 'off',
    'prefer-const': ['error', { 'destructuring': 'all' }],
    'prefer-exponentiation-operator': 'error',
    'react/jsx-uses-react': 'off',
    'react/no-children-prop': 'off',
    '@typescript-eslint/consistent-type-assertions': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',  // should not be used with 'verbatimModuleSyntax'
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-require-imports': 'off',

    // stylistic
    'no-multi-spaces': ['error', { ignoreEOLComments: true }],
    'comma-dangle': ['error', 'always-multiline'],
    'quotes': ['error', 'single', { allowTemplateLiterals: true }],
    'semi': 'error',
  },
  settings: {
    react:{
      version: 'detect',
    },
  },
  overrides: [{
    files: ['*.ts', '*.tsx'],
    parserOptions: {
      projectService: true,
    },
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignoreMixedLogicalExpressions: true }],
      '@typescript-eslint/require-array-sort-compare': 'error',
    },
  }, {
    files: [
      'src/views/@material/**/*.ts',
      'src/views/@rmwc/**/*.ts',
      'src/views/@rmwc/**/*.tsx',
    ],
    rules: {
      'comma-dangle': 'off',
      'no-param-reassign': 'off',
      'no-return-assign': 'off',
      'prefer-arrow-callback': ['error', { 'allowNamedFunctions': true }],
      'symbol-description': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/method-signature-style': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/prefer-function-type': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      'react/jsx-no-constructed-context-values': 'off',
      'react/jsx-no-useless-fragment': 'off',
      'react/self-closing-comp': 'off',
      'react-hooks/refs': 'off',
    },
  }, {
    files: ['*.js'],
    excludedFiles: 'src/*',
    env: {
      node: true,
    },
  }],
};
