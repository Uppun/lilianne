process.env.NODE_ENV = 'development';

const autoprefixer = require('autoprefixer');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const InterpolateHtmlPlugin = require('./plugins/InterpolateHtmlPlugin');
const WatchMissingNodeModulesPlugin = require('./plugins/WatchMissingNodeModulesPlugin');
const eslintFormatter = require('react-dev-utils/eslintFormatter');
const getClientEnvironment = require('./env');
const paths = require('./paths');

const baseConfig = require('./webpack.config.base');

// Webpack uses `publicPath` to determine where the app is being served from.
// In development, we always serve from the root. This makes config easier.
const publicPath = '/';

// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_PATH%/xyz looks better than %PUBLIC_PATH%xyz.
const publicUrl = '';

const env = getClientEnvironment(publicUrl);

module.exports = Object.assign(baseConfig, {
  mode: 'development',

  devtool: 'cheap-module-source-map',

  entry: [
    require.resolve('webpack-hot-middleware/client') + '?reload=true',
    require.resolve('./polyfills'),
    require.resolve('react-error-overlay'),
    paths.appIndexJs,
  ],

  output: {
    filename: 'static/js/[name].js',
    chunkFilename: 'static/js/[name].chunk.js',

    publicPath: publicPath,

    devtoolModuleFilenameTemplate: info => path.resolve(info.absoluteResourcePath),
  },

  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },

  module: {
    strictExportPresence: true,

    rules: [
      {
        test: /\.(js|jsx)$/,
        enforce: 'pre',
        use: [
          {
            options: {
              formatter: eslintFormatter,
            },
            loader: require.resolve('eslint-loader'),
          },
        ],
        include: paths.appSrc,
      },

      {
        // prettier-ignore
        exclude: [
          /\.html$/,
          /\.(js|jsx)$/,
          /\.css$/,
          /\.json$/,
          /\.bmp$/,
          /\.gif$/,
          /\.jpe?g$/,
          /\.png$/,
        ],
        loader: require.resolve('file-loader'),
        options: {
          name: 'static/media/[name].[hash:8].[ext]',
        },
      },

      {
        test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
        loader: require.resolve('url-loader'),
        options: {
          limit: 10000,
          name: 'static/media/[name].[hash:8].[ext]',
        },
      },

      {
        test: /\.(js|jsx)$/,
        include: paths.appSrc,
        loader: require.resolve('babel-loader'),
        options: {
          cacheDirectory: true,
        },
      },

      {
        test: /\.css$/,
        use: [
          require.resolve('style-loader'),
          {
            loader: require.resolve('css-loader'),
            options: {
              importLoaders: 1,
            },
          },
          {
            loader: require.resolve('postcss-loader'),
            options: {
              ident: 'postcss',
              plugins: () => [
                // prettier-ignore
                require('postcss-flexbugs-fixes'),
                autoprefixer(),
              ],
            },
          },
        ],
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: paths.appHtml,
    }),

    new InterpolateHtmlPlugin(env.raw),

    new webpack.DefinePlugin(env.stringified),

    new webpack.HotModuleReplacementPlugin(),

    new WatchMissingNodeModulesPlugin(paths.appNodeModules),
  ],
});
