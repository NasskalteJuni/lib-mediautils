/**
 * @private
 * A class that tunnels between the browser environment node module and its inside
 * Only intended to be used together with BrowserEnvironment, therefore private
 * */
class _Tunnel{

    /**
     * Creates a new, but still closed tunnel instance
     * */
    constructor(browserEnvironment){
        this._instance = browserEnvironment._instance;
        this._exportHandlers = {};
        this._state = "closed";
    }

    /**
     * opens the Tunnel for bidirectional communication
     * */
    async open(){
        if(this._state === "open") throw new Error("Tunnel is already open");
        this._state = "open";
        await this._instance.exposeFunction("Tunnel._handleExport", (type, serialized) => {
            if(this._exportHandlers[type]) this._exportHandlers[type](JSON.parse(serialized));
        });
        // expose _Tunnel into the browser context
        await this._instance.evaluate(() => {
            window["Tunnel"] = {
                _importHandlers: {},
                _handleImport: function(type, serialized){ if(window["Tunnel"]._importHandlers[type]) window["Tunnel"]._importHandlers[type](JSON.parse(serialized))},
                onImport: function(type, cb){ window["Tunnel"]._importHandlers[type] = cb},
                doExport: function(type, serializable){ window["Tunnel._handleExport"](type, JSON.stringify(serializable))}
            };
        })
    }

    /**
     * import a serializable object into the browser environment
     * @param type [string] what kind of object you are importing
     * @param serializable [any] anything serializable like numbers, strings, arrays to import into the context
     * */
    async doImport(type, serializable){
        if(this._state === "closed") throw new Error("Tunnel is still closed");
        return await this._instance.evaluate((_t, _s) => window["Tunnel"]._handleImport(_t, _s), type, JSON.stringify(serializable))
    }

    /**
     * register a callback function to react to something being exported from the browser environment
     * @param type [string] what kind will be exported
     * @param cb [function] a handler that will receive the exported serializable
     * */
    onExport(type, cb){
        this._exportHandlers[type] = cb;
    }

}

module.exports = _Tunnel;