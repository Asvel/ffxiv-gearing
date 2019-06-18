const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = function (env, argv) {
  const prod = argv && argv.mode === 'production';
  return {
    mode: prod ? 'production' : 'none',
    entry: './src/index.tsx',
    output: {
      filename: prod ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
      chunkFilename: prod ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
      path: __dirname + '/dist',
      hashDigestLength: 8,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js']
    },
    module: {
      rules: [
        { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },
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
        { test: /\.png$/, loader: 'file-loader' },
        { test: /\.svg$/, loader: 'svg-sprite-loader' },
        // {
        //   test: /gears-.*\.json$/,
        //   type: 'javascript/auto',
        //   use: [
        //     {
        //       loader: 'file-loader',
        //       options: {
        //         name: '[path][name].[ext]',
        //       },
        //     }
        //   ],
        // },
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
  };
};
