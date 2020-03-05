const Listenable = require('./Listenable.js');
const Connection = require('./ConnectionWithRollback.js');

/**
 * Allows to manage a set of Connection {@link Connection}
 * @class ConnectionManager
 * @implements Listenable
 * @implements MediaConsuming
 * */
class ConnectionManager extends Listenable(){

    /**
     * create a new peer connection manager who handles everything related to transmitting media via RTCPeerConnections
     * @param {Object} config
     * @param {string} config.name The name or identifier of this peer
     * @param {Signaler} signaler The Signaler to transmit messages to the server
     * @param {Array} [iceServers=[]] An array of ice servers to use, in the common RTCIceServers-format
     * @param {boolean} [useUnifiedPlan=true] Use of standard sdp. Set to false, Plan-B semantics are used but are not guaranteed to work on the given browser, therefore this is discouraged
     * @param {boolean} [verbose=false] Any action or step in the connection process can be logged, if this flag is set to true
     * @param {console} [logger=console] A logger that must offer the methods .log or .error. Only used in verbose mode, defaults to console
     * */
    constructor({name, signaler, iceServers = [{"urls": "stun:stun1.l.google.com:19302"}], useUnifiedPlan = true, verbose = false, logger = console, isYielding = undefined} = {}){
        super();
        this._signaler = signaler;
        this._verbose = verbose;
        this._logger = logger;
        this.connections = {};
        this.localMediaStreams = [];
        this._signaler.addEventListener('message', msg => {
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

    /**
     * forward the managed connections events by dispatching them on this object
     * @private
     * */
    _forwardEvents(connection){
        connection.addEventListener('mediachanged', e => this.dispatchEvent('mediachanged', [e]));
        connection.addEventListener('streamadded', (stream, track, mid) => this.dispatchEvent('streamadded', [stream, connection.peer, track, mid]));
        connection.addEventListener('streamremoved', (stream, track, mid) => this.dispatchEvent('streamremoved', [stream, connection.peer, track, mid]));
        connection.addEventListener('trackadded', (track, mid) => this.dispatchEvent('trackadded', [track, connection.peer, mid]));
        connection.addEventListener('trackremoved', (track, mid) => this.dispatchEvent('trackremoved', [track, connection.peer, mid]));
        connection.addEventListener('close', () => this.dispatchEvent('connectionclosed', [connection.peer]));
    }

    /**
     * the ids of the registered / known users as a list
     * @readonly
     * */
    get users(){
        return Object.keys(this.connections);
    }

    /**
     * @param {string} id The id of the user
     * @return {Connection} A connection or null, if none exists at the time
     * */
    get(id){
        return this.connections[id] || null;
    }

    /**
     * get all remote media streams
     * @readonly
     * @returns {Array} The complete list of MediaStreams that peers sent to this connection
     * */
    get streams(){
        return Object.values(this.connections).map(connection => connection.streams.length ? connection.streams : []).reduce((all, streams) => all.concat(streams), []);
    }

    /**
     * get all remote media stream tracks
     * @readonly
     * @returns {Array} The complete list of MediaStreamTracks that peers sent to this connection
     * */
    get tracks(){
        return Object.values(this.connections).map(connection => connection.tracks.length ? connection.tracks : []).reduce((all, tracks) => all.concat(tracks),[]);
    }

    /**
     * adds media to the (already existing and newly created) connections
     * @param {MediaStream|MediaStreamTrack} m the media to add. Can be a Stream or just a single Track
     * */
    addMedia(m){
        if(m instanceof MediaStream){
            if(this._verbose) this._logger.log('added media stream');
            this.localMediaStreams.push(m);
            Object.values(this.connections).forEach(con => con.addMedia(m));
        }else if(m instanceof MediaStreamTrack){
            if(this._verbose) this._logger.log('added media stream track');
            const stream = new MediaStream([m]);
            this.localMediaStreams.push(stream);
            Object.values(this.connections).forEach(con => con.addMedia(m));
        }else{
            this._logger.error('unknown media type',typeof m, m);
        }
    }

    /**
     * removes media from all connections
     * @param {MediaStream|MediaStreamTrack|string} [m] Remove the given media. If called without media or with '*', every media that was added is removed
     * */
    removeMedia(m){
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

    /**
     * closes all connections
     * @param {Boolean} [remove=false] flag used to remove connections when closing them. Defaults to keeping the closed connections
     * */
    close(remove=false){
        this._signaler.close();
        Object.keys(this.connections)
            .forEach(user => {
                this.connections[user].close();
                if(remove) delete this.connections[user];
            });
    }

}

module.exports = ConnectionManager;