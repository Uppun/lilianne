process.env.NODE_ENV = 'production';

const autoprefixer = require('autoprefixer');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const InterpolateHtmlPlugin = require('./plugins/InterpolateHtmlPlugin');
const eslintFormatter = require('react-dev-utils/eslintFormatter');
const paths = require('./paths');
const getClientEnvironment = require('./env');

const baseConfig = require('./webpack.config.base');

// Webpack uses `publicPath` to determine where the app is being served from.
// It requires a trailing slash, or the file assets will get an incorrect path.
const publicPath = paths.servedPath;

// `publicUrl` is just like `publicPath`, but we will provide it to our app
// as %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
// Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
const publicUrl = publicPath.slice(0, -1);

const env = getClientEnvironment(publicUrl);

const cssFilename = 'static/css/[name].[contenthash:8].css';

// Some apps do not use client-side routing with pushState.
// For these, "homepage" can be set to "." to enable relative asset paths.
const shouldUseRelativeAssetPaths = publicPath === './';

// ExtractTextPlugin expects the build output to be flat.
// (See https://github.com/webpack-contrib/extract-text-webpack-plugin/issues/27)
// However, our output is structured with css, js and media folders.
// To have this structure working with relative paths, we have to use custom options.
const extractTextPluginOptions = shouldUseRelativeAssetPaths
  ? {publicPath: '../'.repeat(cssFilename.split('/').length - 1)}
  : {};

module.exports = Object.assign(baseConfig, {
  mode: 'production',

  bail: true,

  devtool: 'source-map',

  entry: [require.resolve('./polyfills'), paths.appIndexJs],

  output: {
    path: paths.appBuild,

    filename: 'static/js/[name].[chunkhash:8].js',
    chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js',

    publicPath: publicPath,

    devtoolModuleFilenameTemplate: info => path.relative(paths.appSrc, info.absoluteResourcePath),
  },

  optimization: {
    splitChunks: {
      chunks: 'all',
    },

    minimizer: [
      new UglifyJsPlugin({
        uglifyOptions: {
          ecma: 8,
          compress: {
            warnings: false,
          },
        },
        parallel: true,
        cache: true,
        sourceMap: true,
      }),
    ],
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
      },

      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract(
          Object.assign(
            {
              fallback: require.resolve('style-loader'),
              use: [
                {
                  loader: require.resolve('css-loader'),
                  options: {
                    importLoaders: 1,
                    minimize: true,
                    sourceMap: true,
                  },
                },
                {
                  loader: require.resolve('postcss-loader'),
                  options: {
                    ident: 'postcss',
                    plugins: () => [
                      require('postcss-flexbugs-fixes'),
                      autoprefixer(),
                    ],
                  },
                },
              ],
            },
            extractTextPluginOptions
          )
        ),
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: paths.appHtml,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
    
    new InterpolateHtmlPlugin(env.raw),

    new webpack.DefinePlugin(env.stringified),

    new ExtractTextPlugin({
      filename: cssFilename,
    }),

    new ManifestPlugin({
      fileName: 'asset-manifest.json',
    }),
  ],
});
