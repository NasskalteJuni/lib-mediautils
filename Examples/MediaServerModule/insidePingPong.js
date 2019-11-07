Tunnel.onImport('ping', function(val){
    const t = setTimeout(function(){
        clearTimeout(t);
        console.log('incoming ball *pong*');
        console.log('('+val+')');
        val += ' *pong*';
        Tunnel.doExport('pong', val);
    }, Math.random() * 2000);
});