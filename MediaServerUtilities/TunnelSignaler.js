const signaller = {
    send: msg => {
        Tunnel.doExport('message', msg);
    },
    addEventListener: (_, cb) => {
        if(_.toLowerCase() !== 'message') return;
        Tunnel.onImport('message', function(data){
            const e = {type: 'message', data};
            cb(e);
        })
    }
};