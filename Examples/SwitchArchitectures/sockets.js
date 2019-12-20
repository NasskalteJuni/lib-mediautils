const Socket = require('faye-websocket');
const session = require('./session.js');
const mcu = require('./mcu.js');
const sockets = {};
const broadcast = (msg, exclude=[]) => Object.keys(sockets).filter(user => exclude.indexOf(user) === -1).forEach(receiver => sockets[receiver].send(JSON.stringify(msg)));
const timestamp = () => new Date().toISOString();
let architecture = 'mesh';

// handle mcu communication
const handleMcuToSocketCommunication = () => {
    mcu.Tunnel.onExport(function(msg){
        const socket = sockets[msg.receiver];
        if(socket){
            msg.sender = "@mcu";
            socket.send(JSON.stringify(msg));
        }else{
            // inform the mcu that by now, no socket for that user exists any more and therefore, drop the user
            mcu.Tunnel.doImport({type: 'user:disconnected', receiver: '@mcu', sender: '@server', sent: timestamp(), transmitted: timestamp()});
        }
    });
};
if(mcu.isInitialized) handleMcuToSocketCommunication();
else mcu.addEventListener('initialized', handleMcuToSocketCommunication);

// handle normal user browser web socket communication
module.exports = server => server.on('upgrade', (req, sock, body) => {
    if(Socket.isWebSocket(req)){
        session(req, {}, () => {
            if(!req.session || !req.session.user) return sock.destroy();
            const user = req.session.user;
            if(sockets[user]) sockets[user].close();
            let ws = new Socket(req, sock, body);
            const error = msg => ws.send(JSON.stringify({type: 'error', sender: '@server', receiver: user, data: msg, sent: timestamp(), transmitted: timestamp()}));
            sockets[user] = ws;

            mcu.Tunnel.doImport('message', {type: 'user:connected', data: user, sender: '@server', receiver: '@mcu', sent: timestamp(), transmitted: timestamp()});
            broadcast({type: 'user:connected', sender: '@server', data: user, receiver: '*', sent: timestamp(), transmitted: timestamp()}, [user]);
            ws.send(JSON.stringify({type: 'architecture:change', sender: '@server', data: architecture, receiver: user, sent: new Date().toISOString(), transmitted: new Date().toISOString()}));
            ws.send(JSON.stringify({type: 'user:list', sender: '@server', data: Object.keys(sockets).filter(u => u !== user), receiver: user, sent: timestamp(), transmitted: timestamp()}));

            ws.on('message', function(event) {
                const msg = JSON.parse(event.data);
                // only the server is allowed to issue user-typed messages
                // if clients were to be able to do this, they could maliciously send disconnects or do other harm
                if(msg.type.toString().startsWith('user:')){
                    return error('Invalid msg type: reserved category user');
                }
                msg.sender = user;
                msg.transmitted = new Date().toISOString();
                if(msg.receiver === '@server') {
                    if(msg.type === 'architecture:change')
                        msg.data = msg.data.toLowerCase();
                        if(['mcu','mesh','sfu'].indexOf(msg.data) === -1) error('unknown architecture type '+msg.data);
                        if(architecture === msg.data) return ws.send(JSON.stringify({receiver: user, sender: '@server', type: 'architecture:change', data: msg.data, sent: timestamp(), transmitted: timestamp()}))
                        architecture = msg.data;
                        msg.sender = '@server';
                        broadcast(msg);
                }else if(msg.receiver === '@mcu'){
                    mcu.Tunnel.doImport('message', msg);
                }else if(msg.receiver) {
                    if (sockets[msg.receiver]) sockets[msg.receiver].send(JSON.stringify(msg));
                    else error('user away');
                }else{
                    broadcast(msg)
                }
            });

            ws.on('close', function(event) {
                mcu.Tunnel.doImport('message', {type: 'user:disconnected', data: user, sender: '@server', receiver: '@mcu', sent: timestamp(), transmitted: timestamp()});
                broadcast({type:'user:disconnected', data: user, sender: '@server', receiver: '*', sent: timestamp(), transmitted: timestamp()});
                sockets[user] = null;
                delete sockets[user];
                ws = null;
            });
        });
    }
});