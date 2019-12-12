const Socket = require('faye-websocket');
const session = require('./session.js');
const sockets = {};
const broadcast = (msg, exclude=[]) => Object.keys(sockets).filter(user => exclude.indexOf(user) === -1).forEach(receiver => sockets[receiver].send(JSON.stringify(msg)));
const timestamp = () => new Date().toISOString();

module.exports = server => server.on('upgrade', (req, sock, body) => {
    if(Socket.isWebSocket(req)){
        session(req, {}, () => {
            if(!req.session || !req.session.user) return sock.destroy();
            const user = req.session.user;
            if(sockets[user]) sockets[user].close();
            let ws = new Socket(req, sock, body);
            sockets[user] = ws;

            broadcast({type: 'user:connected', sender: 'server', data: user, receiver: '*', sent: timestamp(), transmitted: timestamp()}, [user]);
            ws.send(JSON.stringify({type: 'user:list', sender: 'server', data: Object.keys(sockets).filter(u => u !== user), receiver: user, sent: timestamp(), transmitted: timestamp()}));

            ws.on('message', function(event) {
                const msg = JSON.parse(event.data);
                if(msg.type.toString().startsWith('user:')){
                    return ws.send({type: 'error', data: 'invalid type', sender: 'server', receiver: user, sent: timestamp(), transmitted: timestamp()})
                }
                msg.sender = user;
                msg.transmitted = new Date().toISOString();
                if(msg.receiver === 'server'){
                    console.log();
                }else if(msg.receiver) {
                    if (sockets[msg.receiver]) sockets[msg.receiver].send(JSON.stringify(msg));
                    else ws.send(JSON.stringify({type: 'error', sender: 'server', data: 'user away', sent: timestamp(), transmitted: timestamp()}));
                }else{
                    broadcast(msg)
                }
            });

            ws.on('close', function(event) {
                broadcast({type:'user:disconnected', data: user, sender: 'server', receiver: '*', sent: timestamp(), transmitted: timestamp()});
                sockets[user] = null;
                delete sockets[user];
                ws = null;
            });
        });
    }
});