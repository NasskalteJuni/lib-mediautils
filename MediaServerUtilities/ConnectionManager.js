const Listenable = require('./Listenable.js');
const Connection = require('./ConnectionWithRollback.js');

class ConnectionManager extends Listenable(){

    /**
     * create a new peer connection manager who handles everything related to transmitting media via RTCPeerConnections
     * */
    constructor({name = null, signaler, iceServers = [{"urls": "stun:stun1.l.google.com:19302"}], useUnifiedPlan = true, verbose = false, logger = console, isYielding = undefined} = {}){
        super();
        this._signaler = signaler;
        this._verbose = verbose;
        this._logger = logger;
        this.connections = {};
        this.localMediaStreams = [];
        this._signaler.addEventListener('message', e => {
            let msg = e.data;
            switch(msg.type){
                case "user:connected":
                    if(this._verbose) this._logger.log('new user connected', msg.data);
                    this.connections[msg.data] = new Connection({peer: msg.data, name, iceServers, signaler: this._signaler, useUnifiedPlan, isYielding, verbose, logger});
                    this.dispatchEvent('userconnected', [msg.data]);
                    this._forwardEvents(this.connections[msg.data]);
                    this.localMediaStreams.forEach(stream => this.connections[msg.data].addMedia(stream));
                    break;
                case "user:disconnected":
                    if(this._verbose) this._logger.log('user disconnected', msg.data);
                    delete this.connections[msg.data];
                    this.dispatchEvent('userdisconnected', [msg.data]);
                    break;
                case "user:list":
                    if(this._verbose) this._logger.log('list of users received', msg.data);
                    msg.data.filter(u => !this.connections[u]).forEach(u => {
                        this.connections[u] = new Connection({peer: u, name, iceServers, signaler: this._signaler, useUnifiedPlan, isYielding, verbose});
                        if(this._verbose) this._logger.log('new user (of list) connected', u);
                        this.dispatchEvent('userconnected', [u]);
                        this._forwardEvents(this.connections[u]);
                        this.localMediaStreams.forEach(stream => this.connections[u].addMedia(stream));
                    });
                    break;
            }
        });
    }

    _forwardEvents(connection){
        connection.addEventListener('mediachanged', e => this.dispatchEvent('mediachanged', [e]));
        connection.addEventListener('streamadded', stream => this.dispatchEvent('streamadded', [stream, connection.peer]));
        connection.addEventListener('streamremoved', stream => this.dispatchEvent('streamremoved', [stream, connection.peer]));
        connection.addEventListener('trackadded', track => this.dispatchEvent('trackadded', [track, connection.peer]));
        connection.addEventListener('trackremoved', track => this.dispatchEvent('trackremoved', [track, connection.peer]));
        connection.addEventListener('close', () => this.dispatchEvent('connectionclosed', [connection.peer]));
    }

    /**
     * @readonly
     * the ids of the registered / known users as a list
     * */
    get users(){
        return Object.keys(this.connections);
    }

    /**
     * @param id [string] the id of the user
     * @return [Connect|null] a connection or null, if none exists at the time
     * */
    get(id){
        return this.connections[id] || null;
    }

    /**
     * @readonly
     * get all remote media streams
     * @returns Array of MediaStreams
     * */
    get remoteMediaStreams(){
        return Object.values(this.connections).map(connection => connection.streams || []).reduce((all, streams) => all.concat(streams));
    }

    /**
     * adds media to the connections
     * */
    addMedia(media){
        if(media instanceof MediaStream){
            if(this._verbose) this._logger.log('added media stream');
            this.localMediaStreams.push(media);
            Object.values(this.connections).forEach(con => con.addMedia(media));
        }else{
            if(this._verbose) this._logger.log('added media stream track');
            const stream = new MediaStream([media]);
            this.localMediaStreams.push(stream);
            Object.values(this.connections).forEach(con => con.addMedia(media));
        }
    }

    removeMedia(){
        if(arguments.length === 0){
            if(this._verbose) this._logger.log('removed all media');
            this.localMediaStreams = [];
            Object.values(this.connections).forEach(con => con.removeMedia());
        }else{
            if(this._verbose) this._logger.log('remove single media stream');
            this.localMediaStreams = this.localMediaStreams.filter(s => s.id !== arguments[0].id);
            Object.values(this.connections).forEach(con => con.removeMedia(arguments[0]));
        }
    }

    close(){
        this._signaler.close();
        Object.values(this.connections).forEach(con => con.close());
    }

    forEach(fn){
        Object.values(this.connections).forEach(fn);
    }

}

module.exports = ConnectionManager;