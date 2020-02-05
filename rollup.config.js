const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');

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
        resolve({extensions: ['.js']}),
        commonjs({sourceMap: true})
    ],
};