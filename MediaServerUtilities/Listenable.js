module.exports = (superclass=Object) => class extends superclass{

    constructor(){
        super(...arguments);
        this._listeners = {};
    }

    addEventListener(event, fn){
        event = event.toLowerCase();
        if(typeof fn !== "function") throw new Error("Argument 1 is not of type function");
        if(!(this._listeners[event] instanceof Array)) this._listeners[event] = [];
        this._listeners[event].push(fn)
    }

    removeEventListener(event, fn){
        event = event.toLowerCase();
        if(typeof fn !== "function") throw new Error("Argument 1 is not of type function");
        if(this._listeners[event] instanceof Array) this._listeners[event] = this.listeners[event].filter(listener => listener.toString() !== fn.toString());
    }

    dispatchEvent(event, args=[]){
        event = event.toLowerCase();
        if(this._listeners[event] instanceof Array) this._listeners[event].forEach(fn => fn(...args));
    }
};