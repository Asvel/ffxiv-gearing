module.exports = {
  ignorePatterns: ['/dist', '/data/in', '/data/out'],
  extends: [
    'alloy',
    'alloy/react',
    'alloy/typescript',
  ],
  env: {
    browser: true,
  },
  rules: {
    'getter-return': 'off',
    'complexity': 'off',
    'max-depth': 'off',
    'prefer-const': ['error', { 'destructuring': 'all' }],
    'prefer-exponentiation-operator': 'error',
    'react/no-children-prop': 'off',
    'react/jsx-fragments': 'off',  // FIXME
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-require-imports': 'off',

    // stylistic
    'comma-dangle': ['error', 'always-multiline'],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
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
      tsconfigRootDir: __dirname,
      project: ['./tsconfig.json'],
    },
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
    },
  }, {
    files: ['*.js'],
    excludedFiles: 'src/*',
    env: {
      node: true,
    },
  }, {
    files: ['*.js'],
    rules: {
      '@typescript-eslint/prefer-optional-chain': 'off',
    },
  }],
};
