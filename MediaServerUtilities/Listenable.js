/**
 * @exports Listenable
 * @param {*} superclass defaults to Object
 * @return {mixin:Listenable~mixin}
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
     * @methodOf! Listenable
     * add a callback that is triggered when the given event occurs
     * @param event [string] the event name to listen for
     * @param fn [function] a function to trigger when the event occurs. The function does not receive an event but relevant values
     * */
    addEventListener(event, fn){
        event = event.toLowerCase();
        if(typeof fn !== "function") throw new Error("Argument 1 is not of type function");
        if(!(this._listeners[event] instanceof Array)) this._listeners[event] = [];
        this._listeners[event].push(fn)
    }

    /**
     * @methodOf! Listenable
     * stop triggering a registered function / unregister a formerly given callback
     * @param event [string] the event name to listen for
     * @param fn [function] the registered function
     * */
    removeEventListener(event, fn, all=false){
        event = event.toLowerCase();
        if(typeof fn !== "function") throw new Error("Argument 1 is not of type function");
        if(this._listeners[event] instanceof Array){
            if(all){
                this._listeners[event] = this._listeners[event].filter(listener => listener.toString() !== fn.toString());
            }else{
                const i = this._listeners[event].findIndex(listener => listener.toString() === fn.toString());
                if(i !== -1) this._listeners[event].splice(i, 1);
            }
        }
    }

    /**
     * @memberOf! Listenable
     * trigger all event handlers with the given event name
     * @param event [string] the event name (and NOT AN EVENT OBJECT!) to trigger
     * @param args [array=[]] an array of arguments to pass to the event listener functions
     * */
    dispatchEvent(event, args=[]){
        event = event.toLowerCase();
        if(this._listeners[event] instanceof Array) this._listeners[event].forEach(fn => fn(...args));
    }
};

module.exports = Listenable;