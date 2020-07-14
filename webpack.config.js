const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = function (env, argv) {
  const prod = argv && argv.mode === 'production';
  return [{
    mode: prod ? 'production' : 'none',
    entry: './src/index.tsx',
    output: {
      filename: prod ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
      chunkFilename: prod ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
      path: __dirname + '/dist',
      hashDigestLength: 8,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            require('simple-functional-loader').createLoader(function(source) {
              // Keep react component display name
              return source.replace(
                /([\r\n])const (.+?) = (.+?)\(\((.*?)\) => {([\r\n])/g,
                '$1const $2 = $3(function $2($4) {$5'
              );
            }),
            'awesome-typescript-loader',
          ],
        },
        {
          test: /node_modules[\\\/]@material[\\\/]ripple[\\\/]foundation\.js$/,
          use:
            require('simple-functional-loader').createLoader(function(source) {
              // mdc-ripple should not force using even number ripple size.
              return source.replace('initialSize - 1;', 'initialSize;');
            }),
        },
        {
          test: /\.s?css$/,
          use: [
            'style-loader',
            {
              loader: 'postcss-loader',
              options: {
                ident: 'postcss',
                plugins: [
                  require('postcss-preset-env')(),
                  prod && require('cssnano')(),
                ].filter(Boolean),
              }
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
        { test: /\.png$/, use: 'file-loader' },
        { test: /\.svg$/, use: 'svg-sprite-loader' },
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        favicon: './src/favicon.ico',
      }),
      // new webpack.HashedModuleIdsPlugin(),
    ],
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all'
          },
        }
      },
      moduleIds: 'hashed',
    },
    devtool: !prod && 'cheap-source-map',
    stats: 'errors-warnings',
    devServer: {
      contentBase: false,
      injectClient: false,
      injectHot: false,
    },
  }, {
    mode: prod ? 'production' : 'none',
    entry: './src/import.js',
    output: {
      filename: 'import.js',
      chunkFilename: '[name].[contenthash].bundle.js',
      path: __dirname + '/dist',
      hashDigestLength: 8,
      jsonpFunction: '__ffxiv_gearing_webpack_jsonp',
    },
    optimization: {
      moduleIds: 'hashed',
    },
  }, {
    mode: prod ? 'production' : 'none',
    entry: './src/lodestone.js',
    output: {
      filename: prod ? 'lodestone.[contenthash].bundle.js' : 'lodestone.bundle.js',
      path: __dirname + '/dist',
      hashDigestLength: 8,
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: 'lodestone.html',
        title: 'Redirecting...',
      }),
    ],
    optimization: {
      moduleIds: 'hashed',
    },
  }];
};

const { toPath } = webpack.Template;
webpack.Template.toPath = function (str) {
  return toPath(str).replace(/(gears-\d+)-json$/, '$1');
};
