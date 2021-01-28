const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const { createLoader } = require('simple-functional-loader');

module.exports = function (env, argv) {
  const prod = argv && argv.mode === 'production';
  return [{
    mode: prod ? 'production' : 'development',
    entry: './src/index.tsx',
    output: {
      filename: prod ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
      chunkFilename: prod ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
      hashDigestLength: 8,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            createLoader(function(source) {
              // Keep react component display name
              return source.replace(
                /([\r\n](?:export )?)const (.+?) = (.+?)\(\((.*?)\) => {([\r\n])/g,
                '$1const $2 = $3(function $2($4) {$5',
              );
            }),
            prod && createLoader(function(source) {
              // Remove console.debug(...)
              return source.replace(/([\r\n])\s*console\.debug\(.+?\);/g, '$1');
            }),
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                compilerOptions: {
                  jsx: prod ? 'react-jsx' : 'react-jsxdev',
                },
              },
            },
          ].filter(Boolean),
        },
        {
          test: /node_modules[\\\/]@material[\\\/]ripple[\\\/]foundation\.js$/,
          use:
            createLoader(function(source) {
              // mdc-ripple should not force using even number ripple size.
              return source.replace('initialSize - 1;', 'initialSize;');
            }),
        },
        {
          test: /\.s?css$/,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    'postcss-preset-env',
                    prod && 'cssnano',
                  ].filter(Boolean),
                },
              },
            },
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  includePaths: ['./node_modules'],
                },
              },
            },
          ],
        },
        { test: /\.svg$/, use: 'svg-sprite-loader' },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        favicon: './img/favicon.ico',
      }),
      new ForkTsCheckerWebpackPlugin({
        async: !prod,
        logger: {
          issues: 'webpack-infrastructure',
        },
      }),
    ],
    optimization: {
      // splitChunks: {
      //   cacheGroups: {
      //     commons: {
      //       test: /[\\/]node_modules[\\/]/,
      //       name: 'vendor',
      //       chunks: 'all',
      //     },
      //   },
      // },
    },
    devtool: !prod && 'cheap-source-map',
    stats: {
      preset: 'errors-warnings',
      builtAt: true,
      timings: true,
    },
    devServer: {
      hot: false,
      liveReload: false,
      injectClient: false,
      injectHot: false,
      static: false,
    },
  }, {
    mode: prod ? 'production' : 'none',
    entry: './src/import.js',
    output: {
      filename: 'import.js',
      chunkFilename: '[name].[contenthash].bundle.js',
      hashDigestLength: 8,
    },
    stats: 'errors-warnings',
  }, {
    mode: prod ? 'production' : 'none',
    entry: './src/lodestone.js',
    output: {
      filename: prod ? 'lodestone.[contenthash].bundle.js' : 'lodestone.bundle.js',
      hashDigestLength: 8,
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: 'lodestone.html',
        title: 'Redirecting...',
      }),
    ],
    stats: 'errors-warnings',
  }];
};

const { toPath } = webpack.Template;
webpack.Template.toPath = function (str) {
  return toPath(str).replace(/(gears-\d+)-json$/, '$1');
};
