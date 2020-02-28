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
                includePaths: ['./node_modules'],
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
        favicon: './src/favicon.png',
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
    stats: {
      children: false,
      maxModules: 0,
    },
    serve: {
      devMiddleware: {
        logLevel: 'warn',
      },
      hotClient: false,
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
  }];
};

const { toPath } = webpack.Template;
webpack.Template.toPath = function (str) {
  return toPath(str).replace(/(gears-\d+)-json$/, '$1');
};
