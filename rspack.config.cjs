const fs = require('fs');
const rspack = require('@rspack/core');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

// require('browserslist')() can't match lightningcss built-in browserslist-rs
const targets = fs.readFileSync('./.browserslistrc', 'utf8').split(/\r?\n/).filter(Boolean);

module.exports = function (env, argv) {
  const prod = argv && argv.mode === 'production';
  return {
    mode: prod ? 'production' : 'development',
    entry: {
      main: {
        import: './src/index.tsx',
      },
      import: {
        import: './src/import.js',
        filename: 'import.js',
      },
      lodestone: {
        import: './src/lodestone.js',
      },
      serviceworker: {
        import: './src/serviceworker.js',
        filename: 'serviceworker.js',
      },
    },
    output: {
      filename: prod ? '[name].[contenthash].js' : '[name].bundle.js',
      chunkFilename: prod ? '[name].[contenthash].js' : '[name].bundle.js',
      hashDigestLength: 10,
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
            prod && {
              loader: 'simple-functional-loader',
              ident: 'remove-console-debug',
              options: {
                // 'drop_console' option of SWC doesn't support distinguishing types
                processor: source => source.replace(/\n\s*console\.debug\(.+?\);/g, ''),
              },
            },
            {
              loader: 'builtin:swc-loader',
              options: {
                env: {
                  targets,
                },
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    jsx: true,
                  },
                  transform: {
                    react: {
                      runtime: 'automatic',
                      useBuiltins: true,
                    },
                  },
                },
              },
            },
          ].filter(Boolean),
        },
        {
          test: /\.s?css$/,
          use: [
            'style-loader',
            'css-loader',
            // lightningcss does not keep properties order currently:
            // https://github.com/parcel-bundler/lightningcss/issues/572
            // it may or may not cause issues, stay with postcss for now
            // {
            //   loader: 'builtin:lightningcss-loader',
            //   options: {
            //     minify: prod,  // LightningCssMinimizerRspackPlugin not works with style-loader
            //     // targets,
            //   },
            // },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    ['postcss-preset-env', { features: { 'text-decoration-shorthand': false } }],
                    prod && ['cssnano', { preset: ['default', { cssDeclarationSorter: false }] }],
                  ].filter(Boolean),
                },
              },
            },
            {
              loader: 'sass-loader',
              options: {
                api: 'modern-compiler',
              },
            },
          ],
        },
        {
          test: /\.svg$/,
          use: {
            loader: 'simple-functional-loader',
            ident: 'svg-to-symbol',
            options: {
              processor: source => source
                .replace(/<(\/?)svg/g, '<$1symbol')
                .replace(/ (width|height)="\d+"/g, ''),
            },
          },
          type: 'asset/source',
        },
        {
          test: /\.png$/,
          type: 'asset/resource',
          generator: {
            filename: '[name].[contenthash][ext]',  // this [ext] seems to already contain prefix dot
          },
        },
      ],
    },
    plugins: [
      new rspack.DefinePlugin((changelog => ({
        __PATCH__: JSON.stringify(/更新游戏数据至(\d+\.\d+)/.exec(changelog)[1]),
        __VERSION__: JSON.stringify(/### `([^`]+)`/.exec(changelog)[1]),
        __BUILD_DATE__: Date.now(),
      }))(fs.readFileSync('./CHANGELOG.md', 'utf8'))),
      new rspack.HtmlRspackPlugin({
        template: './src/index.html',
        favicon: './img/favicon.ico',
        chunks: ['main'],
      }),
      new rspack.HtmlRspackPlugin({
        filename: 'lodestone.html',
        title: '跳转中...',
        chunks: ['lodestone'],
      }),
      {
        apply: compiler => {
          compiler.hooks.compilation.tap('FixFaviconPath', compilation => {
            rspack.HtmlRspackPlugin.getCompilationHooks(compilation)
              .beforeAssetTagGeneration.tapPromise('FixFaviconPath', async data => {
                if (data.assets.favicon?.startsWith('dist/')) {
                  data.assets.favicon = data.assets.favicon.slice(5);
                }
              });
          });
        },
      },
      new rspack.CaseSensitivePlugin(),
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: './src/tsconfig.json',
        },
        logger: 'webpack-infrastructure',
      }),
    ],
    optimization: {
      concatenateModules: prod && !argv.analyze,
      splitChunks: {
        chunks: 'initial',
        cacheGroups: {
          defaultVendors: false,
          default: false,
          essentialVendors: {
            test: module => [
              new RegExp(`[\\\\/]node_modules[\\\\/](${[
                'react', 'react-dom', 'scheduler', 'object-assign',
                'mobx', 'mobx-state-tree', 'mobx-react-lite',
                'clsx', 'style-loader', 'css-loader', '@popperjs',
              ].join('|')})[\\\\/]`),
              /[\\/]sanitize\.scss$/,
            ].some(r => r.test(module.resource)),
            name: 'vendor-essential',
            priority: 1,
          },
          restVendors: {
            test: module => [
              /[\\/]node_modules[\\/]/,
              /[\\/]@material[\\/]/,
              /[\\/]@rmwc[\\/]/,
              /[\\/]img[\\/]/,
              /[\\/]material\.scss$/,
            ].some(r => r.test(module.resource)),
            name: 'vendor-rest',
          },
          data: {
            test: /[\\/]data[\\/]out[\\/](?!lodestoneIds\.js$).+/,
            name: 'data',
          },
        },
      },
    },
    performance: {
      hints: false,
    },
    stats: {
      preset: 'errors-warnings',
      builtAt: true,
      timings: true,
    },
    devtool: !prod && 'cheap-source-map',
    devServer: {
      client: false,
      hot: false,
      liveReload: false,
      static: false,
    },
    lazyCompilation: false,
    experiments: {
      rspackFuture: {
        bundlerInfo: {
          force: false,
        },
      },
    },
  };
};

// filter out logs like '[ForkTsCheckerWebpackPlugin] No errors found.', 'ignoreWarnings' only works on warning
{
  const infrastructureLogger = require('fork-ts-checker-webpack-plugin/lib/infrastructure-logger');
  const { getInfrastructureLogger } = infrastructureLogger;
  infrastructureLogger.getInfrastructureLogger = function () {
    const ret = getInfrastructureLogger.apply(this, arguments);
    const { info } = ret;
    ret.info = function () {
      if (/^\u001b\[3[26]m/.test(arguments[0])) return;
      info.apply(this, arguments);
    };
    return ret;
  };
}
