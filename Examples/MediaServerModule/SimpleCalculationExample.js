const BrowserEnvironment = require('../../MediaServerUtilities/BrowserEnvironment.js');
const ReadLine = require('readline');
(async () => {
    const scripts = [require.resolve('./insideBrowserCalculation.js')];
    const env = new BrowserEnvironment('messaging-example',{scripts});
    await env.init();
    await env.Tunnel.onExport('product', res => console.log('Result:', res));
    const rl = ReadLine.createInterface({input: process.stdin, output: process.stdout, terminal: false});
    console.log('Type numbers separated by "," (example: 2,3,4)');
    rl.on('line', line => {
        const numbers = line.split(",").filter(n => n.trim().length > 0).map(n => +n).filter(n => !isNaN(n));
        console.log('multiplying', ...numbers,'...');
        env.Tunnel.doImport('multiply', numbers);
    })
})();
