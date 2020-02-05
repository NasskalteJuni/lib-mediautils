/**
 * implements a simple, websocket-based Signaler,
 * which can be also used as a reference or interface for other signalling solutions (like Server-Sent-Event-based or HTTP-Push)
 * All signalers expose a send function, which accepts serializable objects and allow adding a 'message' EventListener
 * by calling addEventListener('message', function callback({type="message", data}){...}) and a 'close' EventListener by calling
 * addEventListener('close', function callback(){...})
 * */
module.exports = class Signaler{

    /**
     * construct a new signaller
     * @param endpoint [string] URL or connection string to connect the signaler client to the server
    * */
    constructor({endpoint} = {}){
        this._connection = new WebSocket(endpoint);
        this._queued = [];
        this._connection.addEventListener('open', () => this._queued.forEach(msg => this._connection.send(msg)));
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
     * add event listeners to react to changes
     * @param type [string]
     * @param callback [function]
     * */
    addEventListener(type, callback){
        this._connection.addEventListener(type, callback);
    }

    /**
     * remove added event listeners
     * @param type [string]
     * @param callback [function]
     * */
    removeEventListener(type, callback){
        this._connection.removeEventListener(type, callback);
    }

    /**
     * @readonly checks if the connection is closed (this means: no messages can be sent)
     * @returns boolean
     * */
    get closed(){
        return this._connection.readyState > 1;
    }

}
