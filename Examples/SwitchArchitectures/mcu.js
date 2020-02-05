const BrowserEnvironment = require('../../MediaServerUtilities/BrowserEnvironment.js');
BrowserEnvironment.debug = true;
const env = new BrowserEnvironment('mcu', {scripts: [require.resolve('../../dist/bundle.min.js'), require.resolve('../../MediaServerUtilities/TunnelSignaler.js'), require.resolve('./mediaServerClientFile.js')]});
env.init().then(() => console.log('started browser environment'));

module.exports = env;