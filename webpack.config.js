const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

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
            {
              loader: 'simple-functional-loader',
              ident: 'keep-react-component-display-name',
              options: {
                processor: source => source.replace(
                  /([\r\n](?:export )?)const (.+?) = (.+?)\(\((.*?)\) => {([\r\n])/g,
                  '$1const $2 = $3(function $2($4) {$5',
                ),
              },
            },
            prod && {
              loader: 'simple-functional-loader',
              ident: 'remove-console-debug',
              options: {
                processor: source => source.replace(/([\r\n])\s*console\.debug\(.+?\);/g, '$1'),
              },
            },
            {
              loader: 'simple-functional-loader',
              ident: 'use-ts2018-unsupported-bigint-literal',
              options: {
                processor: source => source.replace(/\bBigInt\((\d+)\)/g, '$1n'),
              },
            },
            {
              loader: 'ts-loader',
              options: {
                compilerOptions: {
                  jsx: prod ? 'react-jsx' : 'react-jsxdev',
                },
              },
            },
          ].filter(Boolean),
        },
        {
          test: /node_modules[\\\/]@material[\\\/]ripple[\\\/]foundation\.js$/,
          use: {
            loader: 'simple-functional-loader',
            ident: 'mdc-ripple-fix',
            options: {
              // mdc-ripple should not force using even number ripple size.
              processor: source => source.replace('initialSize - 1;', 'initialSize;'),
            },
          },
        },
        {
          test: /node_modules[\\\/]@rmwc[\\\/]list[\\\/]next[\\\/]collapsible-list\.js$/,
          use: {
            loader: 'simple-functional-loader',
            ident: 'rmwc-list-fix',
            options: {
              // temporary fix of RMWC CollapsibleList initial render jitter under React 18 concurrent mode
              processor: source => source.replace('maxHeight: this.childContainer',
                'maxHeight: this.childContainer && this.state.open'),
            },
          },
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
                    ['postcss-preset-env', { features: { 'case-insensitive-attributes': false } }],
                    ['css-byebye', { rulesToRemove: [/.*\.mdc-evolution-.*/, /.*\[dir=rtl].*/] }],
                    prod && 'cssnano',
                  ].filter(Boolean),
                },
              },
            },
            {
              loader: 'simple-functional-loader',
              ident: 'mdc-ripple-no-will-change',
              options: {
                // these will-change from @material/ripple/_ripple.scss break text subpixel rendering
                processor: source => source.replace(/will-change: ?transform, ?opacity;/, ''),
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
        {
          test: /\.png$/,
          use: {
            loader: 'file-loader',
            options: {
              name: '[name].[contenthash:10].[ext]',
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        favicon: './img/favicon.ico',
        chunks: ['main'],
      }),
      new HtmlWebpackPlugin({
        filename: 'lodestone.html',
        title: 'Redirecting...',
        chunks: ['lodestone'],
      }),
      new ForkTsCheckerWebpackPlugin({
        async: !prod,
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
                'classnames', 'style-loader', 'css-loader',
                '@popperjs', 'react-popper', 'react-fast-compare',
              ].join('|')})[\\\\/]`),
              /[\\/]sanitize\.scss$/,
            ].some(r => r.test(module.resource)),
            name: 'vendor-essential',
            priority: 1,
          },
          restVendors: {
            test: module => [
              /[\\/]node_modules[\\/]/,
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
  };
};

// suppress sass slash division warning (ignoreWarnings not work for this)
// TODO: remove this hack if upgraded RMWC to newer version
{
  const sassLoaderUtils = require('sass-loader/dist/utils');
  const { getSassOptions } = sassLoaderUtils;
  sassLoaderUtils.getSassOptions = async function () {
    const options = await getSassOptions.apply(this, arguments);
    const { warn } = options.logger;
    options.logger.warn = function (message) {
      if (message?.startsWith('Using / for division outside of calc() is deprecated')) return;
      if (message?.endsWith('repetitive deprecation warnings omitted.')) return;
      return warn.apply(this, arguments);
    };
    return options;
  };
}

// filter out logs like '[ForkTsCheckerWebpackPlugin] No errors found.', incredibly it can't be done by configuration
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
