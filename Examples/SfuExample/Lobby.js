const BrowserEnvironment = require('../../MediaServerUtilities/BrowserEnvironment.js');
BrowserEnvironment.debug = true;
const ID = require('./ID.js');
const lobbies = [];

/**
 * Lobbies are in memory (non-persistent) structures that have 0-n members
 * A Lobby with 0 members will cease to exist after a defined time, so they actually need 1-n members to stay open
 * */
class Lobby{

    /**
     * @enum
     * different allowed Lobby states (SEARCHING, ACTIVE, FINISHED)
     * */
    static get STATES(){
        return Object.freeze({
            SEARCHING: 'searching',
            ACTIVE: 'active',
            FINISHED: 'finished'
        });
    }

    /**
     * creates a new Lobby object according to the given options
     * @param options (optional) options defining some rules for the lobby object
     * @param options.name [string] name of the lobby. Must be unique, will be checked for uniqueness
     * @param options.creator [string] id of the creating user
     * @param password [string=''] the password. If left empty, the lobby is public and a password is not necessary
     * @param maxMembers [integer=Infinity] the number of members allowed. Joining after reaching the limit throws an exception
     * @param minMembers [integer=0] the number of members for a lobby considered being in active state (Lobby.STATES.ACTIVE)
     * @param maxEmptyMinutes [integer=0] the time that must pass before a lobby without players is closed down automatically
     * @param id [string=random id] the id for this Lobby. Must be unique but is not checked for uniqueness. Better just leave it to the default value
     * @throws Error when options.name is already in use, an Error will be thrown so that a new Lobby with a unique name should be created
     * */
    constructor({name, creator, password='', maxMembers=Infinity, minMembers=0, maxEmptyMinutes=0, id=ID()} = {}){
        this._created = new Date();
        if(Lobby.byName(name)) throw new Error('NAME ALREADY IN USE');
        this._name = name;
        this._creator = creator;
        this._members = [];
        this._password = password;
        this._maxMembers = maxMembers;
        this._minMembers = minMembers;
        this._state = this._members.length >= this._minMembers ? Lobby.STATES.ACTIVE : Lobby.STATES.SEARCHING;
        this._id = id;
        this._maxEmptyMinutes = maxEmptyMinutes;
        this._closingTimer = null;
        this._env = new BrowserEnvironment(this._id, {scripts: [require.resolve('./sfu.js')]}); // use a page template, alternatively, pass one or multiple scripts with scripts[paths...]
        this._env.init();
        lobbies.push(this);
    }



    /**
     * retrieve a Lobby object with the given id
     * @param id [string] the Lobby's id
     * @return [Lobby|null] the Lobby or null of no Lobby with the given id was found
     * */
    static byId(id){
        return lobbies.reduce((found, lobby) => lobby.id === id ? lobby : found, null);
    }

    /**
     * retrieve a Lobby object with the given name
     * */
    static byName(name){
        return lobbies.reduce((found, lobby) => lobby.name === name ? lobby : found, null);
    }

    /**
     * @readonly
     * retrieve a list of lobbies without password
     * */
    static get public(){
        return lobbies.filter(lobby => lobby.public);
    }

    /**
     * @readonly
     * get the Lobby id
     * */
    get id(){
        return this._id;
    }

    /**
     * @readonly
     * get the browser environment used
     * */
    get env(){
        return this._env;
    }

    /**
     * @readonly
     * is it possible to join the Lobby
     * */
    get joinable(){
        return this.remainingPlayers > 0;
    }

    /**
     * @readonly
     * which users are members of the Lobby
     * */
    get members(){
        return Object.freeze(this._members.slice());
    }

    /**
     * @readonly
     * get the Date when the Lobby was created
     * */
    get created(){
        return this._created;
    }

    /**
     * @readonly
     * get the Lobby name
     * */
    get name(){
        return this._name;
    }

    /**
     * @readonly
     * get the user (more specific, the user id) that created the Lobby
     * */
    get creator(){
        return this._creator;
    }

    /**
     * @readonly
     * get if the Lobby is public (has no password) or not
     * */
    get public(){
        return !this._password.length;
    }

    /**
     * get the current Lobby state
     * */
    get state(){
        return this._state;
    }

    /**
     * set the current Lobby state
     * */
    set state(lobbyState){
        if(lobbyState !== Lobby.STATES.SEARCHING && lobbyState !== Lobby.STATES.FINISHED && lobbyState !== Lobby.STATES.ACTIVE) throw new Error("INVALID LOBBY STATE");
        this._state = lobbyState;
    }

    /**
     * @readonly
     * get the number of players that can still join (can be Infinity)
     * */
    get remainingPlayers(){
        return this._maxMembers - this._members.length;
    }

    _stopPossibleClosingTimer(){
        if(this._closingTimer !== null){
            clearTimeout(this._closingTimer);
            this._closingTimer = null;
        }
    }

    /**
     * join a Lobby
     * @param user [User] the user / joining Lobby member
     * @param password [string] the password specified by that user to enter the lobby. Ignored if Lobby is public
     * @throws [Error] will fail, if the Lobby is full ('LOBBY FULL') or the password is necessary and wrong ('WRONG PASSWORD')
     * */
    join(user, password){
        if(!this.joinable) throw new Error('LOBBY FULL');
        if(this._password && this._password !== password) throw new Error('WRONG PASSWORD');
        this._stopPossibleClosingTimer();
        this._members.push(user);
    }

    /**
     * leave a Lobby
     * @param user [User] the leaving Lobby member
     * */
    leave(user){
        const i = this.members.findIndex(p => p.id === user.id);
        if(i >= 0) this.members.splice(i,1);
        if(this.members.length === 0){
            this._closingTimer = setTimeout(() => {
                if(this.members.length === 0) this.close();
                this._stopPossibleClosingTimer();
            }, 1000 * 60 * this._maxEmptyMinutes);
        }
    }

    /**
     * check if the password matches
     * @param password [string] the password to check
     * @return [boolean]
     * */
    check(password){
        return password === this._password;
    }

    /**
     * close a lobby, making it not findable any more and removing the members of the Lobby object
     * */
    close(){
        this._members = [];
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
            maxPlayers: this._maxMembers,
            state: this.state,
            players: this.members.map(p => ({id: p.id, name: p.name})),
            created: this.created
        }
    }

    toString(){
        return '[Lobby: '+this.name+']';
    }

}

module.exports = Lobby;