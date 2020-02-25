const Listenable = require('./Listenable.js');

/**
 * implements a simple, websocket-based Signaler,
 * which can be also used as a reference or interface for other signalling solutions (like Server-Sent-Event-based or HTTP-Push)
 * All signalers expose a send function, which accepts serializable objects and allow adding a 'message' EventListener
 * by calling addEventListener('message', function callback({type="message", data}){...}) and a 'close' EventListener by calling
 * addEventListener('close', function callback(){...})
 * @class
 * @implements Listenable
 * */
class Signaler extends Listenable(){

    /**
     * construct a new signaller
     * @param {Object} config
     * @param {string} config.endpoint URL or connection string to connect the signaler client to the server
     * @param {WebSocket} [config.socket] A socket to use for a new socket connection, defaults to a newly created, browser-native WebSocket with the given endpoint
    * */
    constructor({endpoint, socket=null} = {}){
        super();
        if(socket === null) socket = new WebSocket(arguments.length && typeof arguments[0] === "string" ? arguments[0] : endpoint);
        this._connection = socket;
        this._queued = [];
        this._connection.addEventListener('open', () => this._queued.forEach(msg => this._connection.send(msg)));
        this._connection.addEventListener('close', () => this.dispatchEvent('close', []));
        this._connection.addEventListener('message', e => this._handleMessage(e));
    }

    /**
     * sends messages, if not closed
     * @param {Object} msg A serializable, non-recursive Object
     * */
    send(msg){
        msg = JSON.stringify(msg);
        if(this._connection.readyState !== 1) this._queued.push(msg);
        else this._connection.send(JSON.stringify(msg));
    }

    /**
     * closes the connection
     * */
    close(){
        return this._connection.close();
    }

    /**
     * checks if the connection is closed (this means: no messages can be sent)
     * @readonly
     * */
    get closed(){
        return this._connection.readyState > 1;
    }


    /**
     * handles incoming socket messages and parses them accordingly
     * @param {Event} e a message event
     * @private
     * */
    _handleMessage(e){
        let msg = JSON.parse(e.data);
        if(typeof msg === "string"){
            try{
                msg = JSON.parse(msg);
            }catch(err){}
        }
        this.dispatchEvent('message', [msg]);
    }

}

module.exports = Signaler;