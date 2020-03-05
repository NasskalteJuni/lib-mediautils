/**
 * @function wrapTunnelAsSignaler
 * @param {Tunnel} tunnel the BrowserEnvironments Tunnel object to wrap and make it look like a Signaler
 * (which only allows sending and registering listeners for message events but nothing else)
 * */
module.exports = tunnel => ({
    send: msg => {
        tunnel.doExport('message', msg);
    },
    addEventListener: (_, cb) => {
        if(_.toLowerCase() !== 'message') return;
        tunnel.onImport('message', function(data){
            cb(data);
        });
    },
    close(){},
    closed: false
});
