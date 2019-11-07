/* var router =  */
const router = require('express').Router();
const Lobby = require('../logic/Lobby.js');
const asyncMiddleware = require('./asyncMiddleware.js');

router.use((req, res, next) => {
    if(!req.session || !req.session.user || !req.session.user.id) return res.status(401).sendStatusMessage('NOT AUTHENTICATED');
    next();
});

router.get('/lobbies', asyncMiddleware((req, res) => {
    res.status(200).json(Lobby.public);
}));

router.get('/lobby/:id', asyncMiddleware((req, res) => {
    const lobby = Lobby.byId(req.params.id);
    if(!lobby) return res.status(404).sendStatusMessage('NO SUCH LOBBY');
    if(!lobby.public && !lobby.check(req.query.password)) return res.status(401).sendStatusMessage('LOGIN FAILED');
    res.status(200).json(lobby);
}));

router.post('/lobby/', asyncMiddleware((req, res) => {
    const name = req.body.name;
    if(!name) return res.status(422).sendStatusMessage('MISSING NAME PROPERTY');
    if(Lobby.byName(name)) return res.status(422).sendStatusMessage('NAME ALREADY IN USE');
    const password = req.body.password;
    const maxPlayers = req.body.maxPlayers;
    const creator = req.session.user;
    const lobby = new Lobby(name, creator, password, maxPlayers);
    // wait for everything to be booted up, then bind event listeners and respond
    lobby.server.onInitialized = () => {
        lobby.server.onIceCandidate((userId, ice) => {
            const i = lobby.players.findIndex(player => player.id === userId);
            if(i === -1) return console.warn(new Date(), 'could not send ice candidate, player removed');
            const user = lobby.players[i];
            if(!user.connection) return console.warn(new Date(), 'could not send ice candidate, player has no connection');
            user.connection.write(`id: ${new Date().toString(32)+Math.random().toString(32).substr(2,7)}\nevent: ice\ndata: ${JSON.stringify(ice)}\n\n`);
        });
        lobby.server.onOffer((userId, offer) => {
            const i = lobby.players.findIndex(player => player.id === userId);
            if(i === -1) return console.warn(new Date(), 'could not send offer, player removed', userId);
            const user = lobby.players[i];
            if(!user.connection) return console.warn(new Date(), 'could not send offer, player has no connection');
            user.connection.write(`id: ${new Date().toString(32)+Math.random().toString(32).substr(2,7)}\nevent: offer\ndata: ${JSON.stringify(offer)}\n\n`);
        });
        res.status(200).header('location','/lobby/'+lobby.id).json(lobby);
    };
}));

router.post('/lobby/:id/users/', asyncMiddleware(async (req, res) => {
    const lobby = Lobby.byId(req.params.id);
    if(!lobby) return res.status(404).sendStatusMessage('NO SUCH LOBBY');
    if(!lobby.joinable) return res.status(401).sendStatusMessage('LOBBY IS FULL');
    if(!lobby.public && lobby.check(req.query.password)) return res.status(401).sendStatusMessage('WRONG PASSWORD');
    try{
        lobby.join(req.session.user);
    }catch(err){
        console.error(err);
    }
    res.status(200).json(lobby);
}));

router.delete('/lobby/:id/users/:user?', asyncMiddleware((req, res) => {
    const lobby = Lobby.byId(req.params.id);
    if(!lobby) return res.status(404).sendStatusMessage('NO SUCH LOBBY');
    const user = lobby.players.reduce((found, user) => user.id === req.params.user || user.id === req.session.user.id ? user : found, null);
    if(!user) return res.status(404).sendStatusMessage('NO SUCH USER');
    lobby.leave(user);
}));

router.get('/lobby/:id/updates', (req, res) => {
    const lobby = Lobby.byId(req.params.id);
    if(!lobby) return res.status(404).sendStatusMessage('NO SUCH LOBBY');
    const user = lobby.players.reduce((found, user) => user.id === req.session.user.id ? user : found, null);
    if(!user) return res.status(401).sendStatusMessage('NOT IN LOBBY');
    user.connection = res;
    res.status(200).set({
        "connection": "keep-alive",
        "cache-control": "no-cache",
        "content-type": "text/event-stream"
    });
    setInterval(() => {
        res.write(`id: ${new Date().toString(32)+Math.random().toString(32).substr(2,7)}\nevent: heartbeat\ndata: \n\n`);
    }, 10*1000);
});

router.post('/lobby/:id/message/:user?', (req, res) => {
    const lobby = Lobby.byId(req.params.id);
    if(!lobby) return res.status(404).sendStatusMessage('NO SUCH LOBBY');
    if(!lobby.players.reduce((inLobby, user) => user.id === req.session.user.id || inLobby, false)) return res.status(401).send('NOT IN LOBBY');
    const id = new Date().getTime().toString(32)+Math.random().toString(32).substr(2,7);
    const data = JSON.stringify(req.body.message).replace(/\n\n/g,'').trim();
    const message = 'id: ' + id + '\nevent: message\ndata: ' + data + '\n\n';
    if(req.params.user){
        const user = lobby.players.reduce((found, user) => user.id === req.params.user.id ? user : found, null);
        if(!user) return res.status(404).sendStatusMessage('NOT IN LOBBY');
        if(user.connection) user.connection.write(message);
    }else{
        lobby.players.forEach(user => {
            if(user.connection) user.connection.write(message)
        })
    }
    res.status(204).send();
});

router.post('/lobby/:id/server',asyncMiddleware(async (req, res) => {
    const lobby = Lobby.byId(req.params.id);
    if(!lobby) return res.status(404).sendStatusMessage("NO SUCH LOBBY");
    const i = lobby.players.findIndex(p => p.id === req.session.user.id);
    if(i === -1) return res.status(401).sendStatusMessage('NOT IN LOBBY');
    const user = lobby.players[i];
    const message = req.body;
    if(message.type==='offer'){
        const answer = await lobby.server.acceptOffer(req.session.user.id, message.content);
        if(answer !== null) user.connection.write(`id: ${new Date().toString(32)+Math.random().toString(32).substr(2,7)}\nevent: answer\ndata: ${JSON.stringify(answer)}\n\n`);
    }else if(message.type==='ice'){
        await lobby.server.addIceCandidate(req.session.user.id, message.content);
    }else if(message.type === 'answer'){
        await lobby.server.acceptAnswer(req.session.user.id, message.content);
    }
    res.status(204).send();
}));

router.delete('/lobby/:id', (req, res) => {
    const lobby = Lobby.byId(req.params.id);
    if(!lobby) return res.status(404).sendStatusMessage('NO SUCH LOBBY');
    if(req.session.user.id !== lobby.creator.id) return res.status(401).sendStatusMessage('NOT ALLOWED TO CLOSE LOBBY');
    lobby.close();
    res.status(204).send();
});

module.exports = router;