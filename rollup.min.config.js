const baseConfig = require('./rollup.config');
const terser = require('rollup-plugin-terser').terser;
baseConfig.plugins.push(terser());
baseConfig.output.file = baseConfig.output.file.replace(/\.js$/,'.min.js');

module.exports = baseConfig;