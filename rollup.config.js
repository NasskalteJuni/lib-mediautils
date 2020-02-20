const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const jsdoc = require('rollup-plugin-jsdoc');
const path = require('path');

module.exports = {
    input: './MediaServerUtilities/index.js',
    output: {
        file: './dist/mediautils.js',
        format: 'iife',
        name: 'MediaUtilities',
        globals: 'MediaUtilities',
        exports: 'named'
    },
    plugins: [
        jsdoc({args:  ['--destination', path.resolve('./dist/docs'), '--package', path.resolve('./package.json')], config: path.resolve('./jsdoc.config.js')}),
        resolve({extensions: ['.js']}),
        commonjs({sourceMap: true})
    ],
};