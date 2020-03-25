/**
 * @interface Listenable
 * @description defines a set of functions to listen for events, similar to the EventTarget Interface commonly used in the front end
 * */
const Listenable = (superclass=Object) => class extends superclass{

    /**
     * passes all given arguments to the super class (default: Object) constructor
     * */
    constructor(){
        super(...arguments);
        this._listeners = {};
    }

    /**
     * @callback EventHandlerFunction
     * @param {...*} any arguments passed by the triggering instance
     * */
    /**
     * add a callback that is triggered when the given event occurs
     * @param {string} event The event name to listen for
     * @param {EventHandlerFunction} fn The function to trigger when the event occurs. The function does not receive an event but relevant values!
     * @function
     * @name Listenable#addEventListener
     * */
    addEventListener(event, fn){
        event = event.toLowerCase();
        if(typeof fn !== "function") throw new Error("Argument 1 is not of type function");
        if(!(this._listeners[event] instanceof Array)) this._listeners[event] = [];
        this._listeners[event].push(fn)
    }

    /**
     * stop triggering a registered function / unregister a formerly given callback
     * @param {string} event The event name to listen for
     * @param {EventHandlerFunction|String} fn The registered function
     * @function
     * @name Listenable#removeEventListener
     * */
    removeEventListener(event, fn, all=false){
        event = event.toLowerCase();
        const compareFn = (a, b) => a.toString().replace(/\s/g, '') === b.toString().replace(/\s/g, '');
        if(typeof fn !== "function" && typeof fn !== "string") throw new Error("Argument 1 is not of type function: "+(typeof fn));
        if(this._listeners[event] instanceof Array){
            if(all){
                this._listeners[event] = this._listeners[event].filter(listener => compareFn(listener, fn));
            }else{
                const i = this._listeners[event].findIndex(listener => compareFn(listener, fn));
                if(i !== -1) this._listeners[event].splice(i, 1);
            }
        }
    }

    /***
     * trigger all event handlers with the given event name
     * @param {string} event the event name (and NOT AN EVENT OBJECT!) to trigger
     * @param {Array} [args=[]] an array of arguments to pass to the event listener functions
     * @function
     * @name Listenable#dispatchEvent
     * */
    dispatchEvent(event, args=[]){
        event = event.toLowerCase();
        if(this._listeners[event] instanceof Array) this._listeners[event].forEach(fn => fn(...args));
    }
};

module.exports = Listenable;