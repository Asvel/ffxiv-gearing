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
  },
  rules: {
    'getter-return': 'off',
    'no-restricted-globals': ['error', ...require('confusing-browser-globals')],
    'complexity': 'off',
    'max-depth': 'off',
    'prefer-const': ['error', { 'destructuring': 'all' }],
    'prefer-exponentiation-operator': 'error',
    'react/jsx-uses-react': 'off',
    'react/no-children-prop': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unused-vars': 'error',

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
      jsxPragma: '__REACT_17_NEW_JSX_TRANSFORM__',
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
