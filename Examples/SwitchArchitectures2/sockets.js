const Socket = require('faye-websocket');
const session = require('./session.js');
const mediaServer = require('./mediaserver.js');
const sockets = {};
const broadcast = (msg, exclude=[]) => Object.keys(sockets).filter(user => exclude.indexOf(user) === -1).forEach(receiver => sockets[receiver].send(JSON.stringify(msg)));
let architecture = 'mesh';

// handle mcu communication
const connectServerToSocket = (type) => mediaServer[type].addEventListener('initialized', () => {
    mediaServer[type].Tunnel.onExport(function(msg){
        const socket = sockets[msg.receiver];
        if(socket){
            msg.sender = "@"+type;
            socket.send(JSON.stringify(msg));
        }else{
            // inform the mcu that by now, no socket for that user exists any more and therefore, drop the user
            mediaServer[type].Tunnel.doImport({type: 'user:disconnected', receiver: '@'+type, sender: '@server'});
        }
    });
});
connectServerToSocket('mcu');
connectServerToSocket('sfu');

// handle normal user browser web socket communication
module.exports = server => server.on('upgrade', (req, sock, body) => {
    if(Socket.isWebSocket(req)){
        session(req, {}, () => {
            if(!req.session || !req.session.user) return sock.destroy();
            const user = req.session.user;
            if(sockets[user]) sockets[user].close();
            let ws = new Socket(req, sock, body);
            const error = msg => ws.send(JSON.stringify({type: 'error', sender: '@server', receiver: user, data: msg}));
            sockets[user] = ws;

            mediaServer.mcu.Tunnel.doImport('message', {type: 'user:connected', data: user, sender: '@server', receiver: '@mcu'});
            mediaServer.sfu.Tunnel.doImport('message', {type: 'user:connected', data: user, sender: '@server', receiver: '@sfu'});
            broadcast({type: 'user:connected', sender: '@server', data: user, receiver: '*'}, [user]);
            ws.send(JSON.stringify({type: 'architecture:switch', sender: '@server', data: architecture, receiver: user}));
            ws.send(JSON.stringify({type: 'user:list', sender: '@server', data: Object.keys(sockets).filter(u => u !== user), receiver: user}));
            ws.on('message', function(event) {
                let msg = JSON.parse(event.data);
                msg = JSON.parse(msg);
                if(typeof msg === "undefined" || typeof msg.type === "undefined"){
                    console.error(typeof msg, msg);
                    console.error(msg.type);
                }
                // only the server is allowed to issue user-typed messages
                // if clients were to be able to do this, they could maliciously send disconnects or do other harm
                if(msg.type.toString().startsWith('user:')){
                    return error('Invalid msg type: reserved category user');
                }
                msg.sender = user;
                if(msg.receiver === '@server') {
                    if(msg.type === 'architecture:switch'){
                        console.log(msg);
                        msg.data = msg.data.toLowerCase();
                        if(['mcu','mesh','sfu'].indexOf(msg.data) === -1) error('unknown architecture type '+msg.data);
                        if(architecture === msg.data) return ws.send(JSON.stringify({receiver: user, sender: '@server', type: 'architecture:switch', data: msg.data}))
                        architecture = msg.data;
                        msg.sender = '@server';
                        if(architecture !== 'sfu') mediaServer.sfu.Tunnel.doImport('message', {type: 'shutdown', receiver: '@sfu', sender: '@server', data: ''});
                        broadcast(msg);
                    }
                }else if(msg.receiver === '@mcu'){
                    mediaServer.mcu.Tunnel.doImport('message', msg);
                }else if(msg.receiver === '@sfu'){
                    mediaServer.sfu.Tunnel.doImport('message', msg);
                }else if(msg.receiver) {
                    if (sockets[msg.receiver]) sockets[msg.receiver].send(JSON.stringify(msg));
                    else error('user away');
                }else{
                    broadcast(msg)
                }
            });

            ws.on('close', function(event) {
                mediaServer.mcu.Tunnel.doImport('message', {type: 'user:disconnected', data: user, sender: '@server', receiver: '@mcu'});
                mediaServer.sfu.Tunnel.doImport('message', {type: 'user:disconnected', data: user, sender: '@server', receiver: '@sfu'});
                broadcast({type:'user:disconnected', data: user, sender: '@server', receiver: '*'});
                sockets[user] = null;
                delete sockets[user];
                ws = null;
            });
        });
    }
});