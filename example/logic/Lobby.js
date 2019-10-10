const Server = require('../../MediaServerUtilities/MediaServerModule.js');
// for this example, set the server to debug
Server.debug = true;

const LobbyState = Object.freeze({
    SEARCHING: 'searching',
    PLAYING: 'playing',
    FINISHED: 'finished'
});

const lobbies = [];

class Lobby{

    static get STATES(){
        return LobbyState;
    }

    constructor(name, creator, password = '', maxPlayers = 5){
        this._created = new Date();
        if(Lobby.byName(name)) throw new Error('NAME ALREADY IN USE');
        this._name = name;
        this._creator = creator;
        this._players = [];
        this._state = LobbyState.SEARCHING;
        this._password = password || '';
        this._maxPlayers = maxPlayers || 5;
        this._id = Math.random().toString(32).substr(2,7) + Math.random().toString(32).substr(2,7);
        this._server = new Server(this._id, {template: require.resolve('./template.html')}); // use a page template, alternatively, pass one or multiple scripts with scripts[paths...]
        this._server.init();
        lobbies.push(this);
    }

    static byId(id){
        return lobbies.reduce((found, lobby) => lobby.id === id ? lobby : found, null);
    }

    static byName(name){
        return lobbies.reduce((found, lobby) => lobby.name === name ? lobby : found, null);
    }

    static get public(){
        return lobbies.filter(lobby => lobby.public);
    }

    get id(){
        return this._id;
    }

    get server(){
        return this._server;
    }

    get joinable(){
        return this.remainingPlayers > 0;
    }

    get players(){
        return Object.freeze(this._players.slice());
    }

    get created(){
        return this._created;
    }

    get name(){
        return this._name;
    }

    get creator(){
        return this._creator;
    }

    get public(){
        return !this._password.length;
    }

    get state(){
        return this._state;
    }

    set state(lobbyState){
        if(lobbyState !== LobbyState.SEARCHING && lobbyState !== LobbyState.FINISHED && lobbyState !== LobbyState.PLAYING) throw new Error("INVALID LOBBY STATE");
        this._state = lobbyState;
    }

    get remainingPlayers(){
        return this._maxPlayers - this._players.length;
    }

    join(player, password){
        if(!this.joinable) throw new Error('LOBBY FULL');
        if(this._password && this._password !== password) throw new Error('WRONG PASSWORD');
        this._players.push(player);
    }

    leave(player){
        const i = this.players.findIndex(p => p.id === player.id);
        if(i >= 0) this.players.splice(i,1);
        if(this.players.length === 0){
            const s = setTimeout(() => {
                if(this.players.length === 0) this.close();
                clearTimeout(s);
            }, 1000 * 60 * 5);
        }
    }

    check(password){
        return password === this._password;
    }

    close(){
        const i = lobbies.findIndex(l => l.id === this._id);
        lobbies.splice(i,1)
    }

    toJSON(){
        return {
            id: this._id,
            name: this._name,
            creator: {
                id: this._creator.id,
                name: this._creator.name,
            },
            public: this.public,
            joinable: this.joinable,
            maxPlayers: this._maxPlayers,
            state: this.state,
            players: this.players.map(p => ({id: p.id, name: p.name})),
            created: this.created
        }
    }

    toString(){
        return '[Lobby: '+this.name+']';
    }

}

module.exports = Lobby;