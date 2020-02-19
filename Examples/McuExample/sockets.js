const WebSocket = require('faye-websocket');
const Signaler = require('../../MediaServerUtilities/Signaler.js');
const room = require('./room.js');
const sockets = {};
const url = require('url');

const bind = server => {
    server.on('upgrade', function httpUpgradeHandshakeHandler(request, sock, body) {
        if (WebSocket.isWebSocket(request)) {
            let socket = new Signaler({socket: new WebSocket(request, sock, body)});
            const id = url.parse(request.url, true).query.name;
            if(id.startsWith('@')){
                socket.close();
                request.close();
            }
            const user = {id, name: id, socket};
            sockets[id] = socket;

            room.join(user);

            socket.addEventListener('close', () => {
                room.leave(user);
                socket = null;
                sockets[id] = null;
                delete sockets[id];
            });

            socket.addEventListener('message', msg => {
                msg = typeof msg === "string" ? JSON.parse(msg) : msg;
                msg.sender = user.name;
                if(msg.receiver === '@mcu'){
                    room.env.Tunnel.doImport('message', msg);
                }else{
                    const i = room.members.findIndex(m => m.name === msg.receiver);
                    if(i >= 0) room.members[i].socket.send(msg);
                    else socket.send({type: 'user:disconnected', data: msg.receiver, sender: '@server', receiver: '*'});
                }
            })
        }
    });
};

module.exports = {
    bind,
    all: () => Object.values(sockets),
    get: id => sockets[id]
};