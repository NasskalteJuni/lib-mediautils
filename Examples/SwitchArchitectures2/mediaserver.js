const BrowserEnvironment = require('../../MediaServerUtilities/BrowserEnvironment.js');
BrowserEnvironment.debug = true;
const sfu = new BrowserEnvironment('sfu', {scripts: [require.resolve('../../dist/mediautils.js'), require.resolve('./mediaserver/sfu.js')]});
const mcu = new BrowserEnvironment('mcu', {scripts: [require.resolve('../../dist/mediautils.js'), require.resolve('./mediaserver/mcu.js')]});

module.exports = {mcu, sfu};