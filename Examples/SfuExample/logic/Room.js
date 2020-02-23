const BrowserEnvironment = require('../../../MediaServerUtilities/BrowserEnvironment.js');
const Listenable = require('../../../MediaServerUtilities/Listenable.js');
const Architecture = require("./Architecture.js");
BrowserEnvironment.debug = true;
const ID = require('./ID.js');
const path = require('path');
const rooms = [];

/**
 * Rooms are in memory (non-persistent) structures that have 0-n members
 * A Room with 0 members will cease to exist after a defined time, so they actually need 1-n members to stay open
 * */
class Room extends Listenable(){


    /**
     * creates a new Room object according to the given options
     * @param options (optional) options defining some rules for the room object
     * @param options.name [string] name of the room. Must be unique, will be checked for uniqueness
     * @param options.creator [string] id of the creating user
     * @param password [string=''] the password. If left empty, the room is public and a password is not necessary
     * @param maxMembers [integer=Infinity] the number of members allowed. Joining after reaching the limit throws an exception
     * @param maxEmptyMinutes [integer=0] the time that must pass before a room without members is closed down automatically
     * @param initialArchitecture [string='mesh'] the architecture to use at the beginning
     * @param id [string=random id] the id for this Room. Must be unique but is not checked for uniqueness. Better just leave it to the default value
     * @throws Error when options.name is already in use, an Error will be thrown so that a new Room with a unique name should be created
     * */
    constructor({name, creator, password='', maxMembers=Infinity, minMembers=0, maxEmptyMinutes=0, id=ID(), initialArchitecture="mesh"} = {}){
        super();
        this._created = new Date();
        if(Room.byName(name)) throw new Error('NAME ALREADY IN USE');
        this._name = name;
        this._creator = creator;
        this._members = [];
        this._password = password;
        this._maxMembers = maxMembers;
        this.architecture = new Architecture(initialArchitecture);
        this._id = id;
        this._maxEmptyMinutes = maxEmptyMinutes;
        this._closingTimer = null;
        this._env = new BrowserEnvironment(this._id, {template: path.resolve('./browser_environment/template.html'), scripts: [path.resolve('../../dist/mediautils.js')]}); // use a page template, alternatively, pass one or multiple scripts with scripts[paths...]
        this._env.init();
        this._env.onInitialized = () => this.dispatchEvent('ready', []);
        rooms.push(this);
    }


    /**
     * @static
     * kick the user out of any room
     * */
    static removeUserEverywhere(user){
        rooms.forEach(room => {
            if(room.members.findIndex(member => member.id === user.id) >= 0){
                room.leave(user);
            }
        });
    }

    /**
     * retrieve a Room object with the given id
     * @param id [string] the Lobby's id
     * @return [Room|null] the Lobby or null of no Lobby with the given id was found
     * */
    static byId(id){
        return rooms.reduce((found, room) => room.id === id ? room : found, null);
    }

    /**
     * retrieve a Lobby object with the given name
     * */
    static byName(name){
        return rooms.reduce((found, room) => room.name === name ? room : found, null);
    }

    /**
     * @readonly
     * retrieve a list of rooms without password
     * */
    static get public(){
        return rooms.filter(room => room.public);
    }

    /**
     * @readonly
     * get the Room id
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
     * is it possible to join the Room
     * */
    get joinable(){
        return this.remainingMembers > 0;
    }

    /**
     * @readonly
     * which users are members of the Room
     * */
    get members(){
        return Object.freeze(this._members.slice());
    }

    /**
     * @readonly
     * get the Date when the Room was created
     * */
    get created(){
        return this._created;
    }

    /**
     * @readonly
     * get the Room name
     * */
    get name(){
        return this._name;
    }

    /**
     * @readonly
     * get the user (more specific, the user id) that created the Room
     * */
    get creator(){
        return this._creator;
    }

    /**
     * @readonly
     * get if the Room is public (has no password) or not
     * */
    get public(){
        return !this._password.length;
    }

    /**
     * @readonly
     * get the number of members that can still join (can be Infinity)
     * */
    get remainingMembers(){
        return this._maxMembers - this._members.length;
    }

    /**
     * @private
     * stop the closing countdown
     * */
    _stopPossibleClosingTimer(){
        if(this._closingTimer !== null){
            clearTimeout(this._closingTimer);
            this._closingTimer = null;
        }
    }

    /**
     * @private
     * kick user out of other rooms
     * */
    _leaveOtherLobbies(user){
        rooms.forEach(room => {
            if(room.members.indexOf(user) >= 0 && room.id !== this.id){
                room.leave(user);
            }
        })
    }

    /**
     * join a Room. Since every user can only be a member of 1 room at once, this includes leaving other rooms
     * @param user [User] the user / joining Room member
     * @param password [string] the password specified by that user to enter the room. Ignored if Room is public
     * @throws [Error] will fail, if the Room is full ('LOBBY FULL') or the password is necessary and wrong ('WRONG PASSWORD')
     * */
    join(user, password){
        if(!this.joinable) throw new Error('LOBBY FULL');
        if(this._password && this._password !== password) throw new Error('WRONG PASSWORD');
        if(!user.socket || user.socket.closed) throw new Error('NO SOCKET CONNECTION ('+(user.socket && user.socked.closed ? 'CLOSED' : 'MISSING')+')');
        if(this._members.findIndex(u => user.id === u.id) >= 0) throw new Error('ALREADY IN ROOM');
        this._stopPossibleClosingTimer();
        this._leaveOtherLobbies(user);
        this._members.push(user);
        this.dispatchEvent('join', [user]);
    }

    /**
     * leave a Room
     * @param user [User] the leaving Room member
     * */
    leave(user){
        const i = this._members.findIndex(p => p.id === user.id);
        if(i >= 0){
            this._members.splice(i,1);
            this.dispatchEvent('leave', [user]);
        }
        if(this._members.length === 0){
            console.log('room is empty');
            this._closingTimer = setTimeout(() => {
                if(this._members.length === 0) this.close();
                this._stopPossibleClosingTimer();
            }, 1000 * 60 * this._maxEmptyMinutes);
        }
    }

    /**
     * check if the password matches
     * @param password [string] the password to check
     * @return boolean
     * */
    check(password){
        return password === this._password;
    }

    /**
     * close a room, making it not findable any more and removing the members of the Room object
     * */
    close(){
        this._members = [];
        const i = rooms.findIndex(l => l.id === this._id);
        rooms.splice(i,1);
        this.dispatchEvent('close', []);
        this._env.destroy().then(() => this.dispatchEvent('closed', [])).catch(console.error);
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
            architecture: this.architecture,
            joinable: this.joinable,
            maxMembers: this._maxMembers,
            members: this.members.map(m => m.name),
            created: this.created
        }
    }

    toString(){
        return '[Room: '+this.name+']';
    }

}

module.exports = Room;
