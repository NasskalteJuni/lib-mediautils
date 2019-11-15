const authenticated = require('../middleware/authenticated.js');
const asyncMiddleware = require('../middleware/asyncHandling.js');
const router = require('express').Router();
const ID = require('../logic/ID.js');
const User = require('../logic/User.js');
const Lobby = require('../logic/Lobby.js');
router.use(authenticated);

router.use(function(req, res, next){
    if(req.params.id) {
        const lobby = Lobby.byId(req.params.id);
        if (!lobby) return res.status(404).sendStatusMessage('NO SUCH LOBBY');
        req.lobby = lobby;
        next();
    }
});

router.get('/lobbies', asyncMiddleware((req, res) => {
    res.status(200).json(Lobby.public);
}));

router.get('/lobby/:id', asyncMiddleware((req, res) => {
    const lobby = req.lobby;
    if(!lobby.public && !lobby.check(req.query.password)) return res.status(401).sendStatusMessage('LOGIN FAILED');
    res.status(200).json(lobby);
}));

router.post('/lobby/', asyncMiddleware((req, res) => {
    const name = req.body.name;
    if(!name) return res.status(422).sendStatusMessage('MISSING NAME PROPERTY');
    if(Lobby.byName(name)) return res.status(422).sendStatusMessage('NAME ALREADY IN USE');
    const lobby = new Lobby({name, creator: req.session.user, password: req.body.password, maxMembers: req.body.maxMembers || Infinity});
    // wait for everything to be booted up, then bind handler function and respond
    lobby.env.onInitialized = () => {
        lobby.env.Tunnel.onExport(({content, user}, type) => {
            user = User.byId(user, lobby.members);
            if(user) user.connection.write(`id: ${ID()}\nevent: ${type}\ndata: ${JSON.stringify(content)}\n\n`);
        });
        res.status(200).header('location','/lobby/'+lobby.id).json(lobby);
    };
}));

router.post('/lobby/:id/users/', asyncMiddleware(async (req, res) => {
    const lobby = req.lobby;
    if(!lobby.joinable) return res.status(401).sendStatusMessage('LOBBY IS FULL');
    if(!lobby.public && lobby.check(req.query.password)) return res.status(401).sendStatusMessage('WRONG PASSWORD');
    lobby.join(req.session.user);
    res.status(200).json(lobby);
}));

router.delete('/lobby/:id/users/:user?', asyncMiddleware((req, res) => {
    const lobby = req.lobby;
    const user = lobby.members.reduce((found, user) => user.id === req.params.user || user.id === req.session.user.id ? user : found, null);
    if(!user) return res.status(404).sendStatusMessage('NO SUCH USER');
    lobby.leave(user);
}));

router.get('/lobby/:id/updates', (req, res) => {
    const lobby = req.lobby;
    const user = User.byId(req.session.user.id, lobby.members);
    if(!user) return res.status(401).sendStatusMessage('NOT IN LOBBY');
    user.connection = res;
    res.status(200).set({
        "connection": "keep-alive",
        "cache-control": "no-cache",
        "content-type": "text/event-stream"
    });
    setInterval(() => res.write(`id: ${ID()}\nevent: heartbeat\ndata: \n\n`), 10*1000);
});

router.post('/lobby/:id/message',asyncMiddleware(async (req, res) => {
    const lobby = req.lobby;
    const sender = User.byId(req.session.user.id, lobby.members);
    if(!sender) return res.status(401).sendStatusMessage('NOT IN LOBBY');
    let {receiver, content, type} = req.body;
    const changedMessage = {user: sender, content, type};
    if(receiver === 'server'){
        await lobby.env.Tunnel.doImport(type, changedMessage);
    }else if(receiver === '*'){
        lobby.members.forEach(user => {
            if(user.connection) user.write(`id: ${ID()}\nevent: ${type}\ndata: ${JSON.stringify(changedMessage)}\n\n`);
        })
    }else{
        receiver = User.byId(receiver, lobby.members);
        if(!receiver || !receiver.connection) return res.status(401).sendStatusMessage('NOT IN LOBBY');
        receiver.connection.write(`id: ${ID()}\nevent: ${type}\ndata: ${JSON.stringify(changedMessage)}\n\n`);
    }
    res.status(204).send();
}));

router.delete('/lobby/:id', (req, res) => {
    const lobby = req.lobby;
    if(req.session.user.id !== lobby.creator.id) return res.status(401).sendStatusMessage('NOT ALLOWED TO CLOSE LOBBY');
    lobby.members.forEach(user => {
        if(user.connection) user.connection.write(`id: ${ID()}\nevent: closedLobby\ndata: ${req.params.id}\n\n`);
    });
    lobby.close();
    res.status(204).send();
});

module.exports = router;