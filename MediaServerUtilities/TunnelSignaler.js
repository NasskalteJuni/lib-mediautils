/**
 * @function wrapTunnelAsSignaler
 * @param Tunnel [Tunnel] the BrowserEnvironments Tunnel object to wrap and make it look like a Signaler
 * (which only allows sending and registering listeners for message events but nothing else)
 * */
module.exports = Tunnel => ({
    send: msg => {
        Tunnel.doExport('message', msg);
    },
    addEventListener: (_, cb) => {
        if(_.toLowerCase() !== 'message') return;
        Tunnel.onImport('message', function(data){
            cb(data);
        });
    }
});
