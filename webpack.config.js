/**
 * Webpack is currently only used for executing closure compiler tasks for type checking.
 * It is not used for packaging.
*/

/* eslint import/no-extraneous-dependencies: 0 */
const ClosureCompiler = require('google-closure-compiler-js').webpack;
const path = require('path');

module.exports = {
  target: 'node',
  // devtool: 'eval-source-map',
  entry: [
    path.join(__dirname, 'source', 'index.js'),
  ],
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'output.js',
  },
  externals: ['http', 'url'],
  plugins: [
    new ClosureCompiler({
      options: {
        checksOnly: true,
        languageIn: 'ECMASCRIPT6',
        languageOut: 'ECMASCRIPT5_STRICT',
        compilationLevel: 'ADVANCED',
        warningLevel: 'DEFAULT',
        // applyInputSourceMaps: true,
        processCommonJsModules: true,
      },
    }),
  ],
};
