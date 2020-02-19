const router = require('express').Router();
const BrowserEnvironment = require('../../MediaServerUtilities/BrowserEnvironment.js');
BrowserEnvironment.debug = true;
const Room = require("./logic/Room.js");
const room = new Room({
    name: 'mediaserver',
    creator: {name: '@server', id: null},
    maxEmptyMinutes: 60 * 24 * 7,
    maxMembers: 20,
    initialArchitecture: 'mcu'
});
const broadcast = (msg, sender='@server') => room.members.filter(m => m.name !== sender).forEach(m => m.socket.send(msg));


room.addEventListener('ready', () => {

    room.addEventListener('join', user => {
        const msg = {type: 'user:connected', data: user.name, receiver: '*', sender: '@server'};
        user.socket.send({type: 'user:list', data: room.members.map(m => m.name), sender: '@server', receiver: user.name});
        broadcast(msg, user.name);
        room.env.Tunnel.doImport('message', msg);
    });

    room.addEventListener('leave', user => {
        const msg = {type: 'user:disconnected', data: user.name, receiver: '*', sender: '@server'};
        broadcast(msg, user.name);
        room.env.Tunnel.doImport('message', msg).catch(() =>{});
    });

    room.env.Tunnel.onExport('message', msg => {
        if(msg.receiver !== '@server'){
            msg.sender = '@mcu';
            if(msg.receiver === '*'){
                room.members.forEach(m => m.socket.send(msg));
            }else{
                const i = room.members.findIndex(m => m.name === msg.receiver);
                if(i >= 0) room.members[i].socket.send(msg);
                else room.env.Tunnel.doImport('message', {type: 'user:disconnected', data: msg.receiver, receiver: '*', sender: '@server'}).catch(() => {});
            }
        }
    });

});


module.exports = room;