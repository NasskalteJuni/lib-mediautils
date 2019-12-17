const isJSON = input => {
    if(typeof input !== "string") return false;
    try{
        JSON.parse(input);
    }catch(err){
        return false;
    }
    return true;
};
const signaller = {
    send: msg => {
        console.log('send', msg);
        // annoyingly, we now have to take care that we do not double-stringify messages...
        if(isJSON(msg)) msg = JSON.parse(msg);
        Tunnel.doExport('message', msg);
    },
    addEventListener: (_, cb) => {
        if(_.toLowerCase() !== 'message') return;
        Tunnel.onImport('message', function(imported){
            console.log('received', imported);
            const e = {type: 'message', data: JSON.stringify(imported)};
            cb(e);
        })
    }
};
const connections = new MediaUtilities.ConnectionManager({isYielding: () => true, verbose: true, signaller});
connections.addEventListener('streamadded', (stream, user) => {
    connections.forEach(con => {
        if(con.peer !== user){
            con.addMedia(stream);
        }
    });
});
connections.addEventListener('streamremoved', (stream, user) => {
    connections.forEach(con => {
        if(con.peer !== user){
            con.removeMedia(stream);
        }
    })
});