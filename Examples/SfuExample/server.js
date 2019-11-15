const Lobby = require('./Lobby.js');
const ID = require('./ID.js');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.port || process.argv.slice(2).pop() || 8808;
const lobby = new Lobby({name: 'SFU', minMembers: 0});
app.use(bodyParser.json());
app.use(express.static('public'));

lobby.env.onInitialized = () => {
    lobby.env.Tunnel.onExport(({user, type, content}) => {
        const member = lobby.members.reduce((found, u) => u.id === user ? u : found, null);
        if(member && member.send) member.send(type, content);
    });
};

app.post('/message', ( req, res) => {
    if(!req.body.user) return res.status(400).send('NO ID');
    if(!req.body.type) return res.status(400).send('NO TYPE');
    lobby.env.Tunnel.doImport(req.body.type, req.body).then(() => res.status(204).send()).catch(console.error);
});

app.get('/updates', (req, res) => {
    const user = lobby.members.reduce((found, u) => u.id === req.query.user ? u : found, null);
    if(!user) return res.status(400).send('NO SUCH USER FOR UPDATES');
    user.send = (type, data) => res.write(`id: ${ID()}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    res.set({'Connection': 'keep-alive', 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Keep-Alive': 'timeout=0'});
    setInterval(function(){ user.send('heartbeat', new Date().toISOString())}, 1000*5);
});

app.post('/join', (req, res) => {
    if(!req.body.name) return res.status(400).send('NO NAME');
    const user = {name: req.body.name, id: ID()};
    lobby.join(user);
    res.json(user);
});

app.post('/leave', (req, res) => {
    if(req.body.id) return res.status(400).send('NO ID');
    lobby.leave({id: req.body.id});
    lobby.members.forEach(user => user.send('leave', req.body.id));
    res.status(204).send();
});

app.listen({port}, () => console.log('server running on http://127.0.0.1:'+port+'/'));