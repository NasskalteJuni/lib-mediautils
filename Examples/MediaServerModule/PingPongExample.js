const BrowserEnvironment = require('../../MediaServerUtilities/BrowserEnvironment.js');
// just start it in visible debugging mode this time
BrowserEnvironment.debug = true;
(async () => {
    const env = new BrowserEnvironment('ping-pong', {scripts: [require.resolve('./insidePingPong.js')]});
    await env.init();
    env.Tunnel.onExport('pong', function(val){
        const t = setTimeout(function () {
            clearTimeout(t);
            console.log('Incoming ball *ping*');
            console.log('('+val+')');
            val += ' *ping*';
            env.Tunnel.doImport('ping', val);
        }, Math.random() * 1000);
    });
    env.Tunnel.doImport('ping', '*ping*')
})();