const Listenable = require('./Listenable.js');

/**
 * implements a simple, websocket-based Signaler,
 * which can be also used as a reference or interface for other signalling solutions (like Server-Sent-Event-based or HTTP-Push)
 * All signalers expose a send function, which accepts serializable objects and allow adding a 'message' EventListener
 * by calling addEventListener('message', function callback({type="message", data}){...}) and a 'close' EventListener by calling
 * addEventListener('close', function callback(){...})
 * */
module.exports = class Signaler extends Listenable(){

    /**
     * construct a new signaller
     * @param endpoint [string] URL or connection string to connect the signaler client to the server
    * */
    constructor({endpoint} = {}){
        super();
        this._connection = new WebSocket(arguments.length && typeof arguments[0] === "string" ? arguments[0] : endpoint);
        this._queued = [];
        this._connection.addEventListener('open', () => this._queued.forEach(msg => this._connection.send(msg)));
        this._connection.addEventListener('message', e => this.dispatchEvent('message', [{type: 'message', data: JSON.parse(e.data)}]));
        this._connection.addEventListener('close', () => this.dispatchEvent('close', []))
    }

    /**
     * sends messages, if not closed
     * @param msg [serializable]
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
     * @readonly checks if the connection is closed (this means: no messages can be sent)
     * @returns boolean
     * */
    get closed(){
        return this._connection.readyState > 1;
    }

}
