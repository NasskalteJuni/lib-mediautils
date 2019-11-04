const VideoMixingConfiguration = require("./VideoMixingConfiguration.js");

/**
 * @mixin
 * Handle Video Mixing configurations
 * */
module.exports = (superclass=Object) => class C extends superclass{

    constructor(){
        super(...arguments);
        this._configChangeHandler = () => {};
        this._streamIds = [];
        this._configs = {};
        this._currentConfigId = null;
    }

    /**
     * set the current number of stream ids
     * @param ids [array] the ids of currently used streams. Needs to be given, since the choice of the current config depends on the number of streams
     * @returns VideoMixingConfiguration the currently used configuration after the stream ids were applied
     * */
    updateStreamIds(ids){
        this._streamIds = ids;
        this._findCurrentConfig();
        return this.currentConfig;
    }

    /**
     * @returns VideoMixingConfiguration the current config. May return null, if there is no current config (because the VideoMixingConfigurationManager was just constructed, for example)
     * */
    get currentConfig(){
        return this.currentConfigId ? this._configs[this._currentConfigId] : null;
    }

    /**
     * @returns string the id of the current config
     * */
    get currentConfigId(){
        return this._currentConfigId;
    }

    /**
     * enforce the given id as current config, independent if it is applicable or not
     * @param id [string] the id of the config to use
     * @throws Error when no config has the given id
     * */
    forceConfig(id){
        if(!this._configs[id]) throw new Error("No config with the id "+id);
        const previousConfigId = this._currentConfigId;
        this._currentConfigId = id;
        this._configChangeHandler(this._configs[id], id, previousConfigId);
    }

    /**
     * @private
     * @static
     * Checks if the given object is a VideoMixingConfiguration or just a plain object that probably should be used as configuration for this
     * @returns VideoMixingConfiguration the given VideoMixingConfiguration or, if none was given, a VideoMixingConfiguration constructed from the given object
     * */
    static _videoMixingConfigurationTypeGuard(configOrPlainObject){
        if(!configOrPlainObject.__isVideoMixingConfigurationObject && !configOrPlainObject instanceof VideoMixingConfiguration){
            configOrPlainObject = new VideoMixingConfiguration(configOrPlainObject);
        }
        return configOrPlainObject;
    }

    /**
     * adds another config under the given id
     * @param config [VideoMixingConfiguration] a VideoMixingConfiguration (or its settings object)
     * @param id [string] a unique id for the config. Non unique ids will result in unchecked overwriting of the config
     * */
    addConfig(config, id){
        this._configs[id] = C._videoMixingConfigurationTypeGuard(config);
        this._findCurrentConfig();
    }

    /**
     * remove the config with the registered id
     * @param id [string] the id of the config to remove
     * @throws Error when no config with the given id was found
     * */
    removeConfig(id){
        if(!this._configs[id]) throw new Error("No config with the id "+id);
        delete this._configs[id];
        this._findCurrentConfig()
    }

    /**
     * define a function that will be invoked when (and only when) the configuration that should be used currently changes
     * @param cb [function] a function which will retrieve the current configuration, its id, and the previous configuration
     * */
    onConfigChange(cb){
        if(typeof cb !== "function") throw new Error("Callback must be a function");
        this._configChangeHandler = cb;
    }

    /**
     * @private
     * get the config that is applicable AND has the highest priority
     * @return object of structure {id: VideoMixingConfiguration}
     * */
    _findCurrentConfig() {
        let highestApplicableId = null;
        let highestPriority = -Infinity;
        for (let id in this._configs) {
            if(!this._configs.hasOwnProperty(id)) continue;
            const currentConfig = this._configs[id];
            if (currentConfig.applicable(this._streamIds)) {
                const currentPriority = currentConfig.priority(this._streamIds);
                if (highestPriority < currentPriority) {
                    highestApplicableId = id;
                    highestPriority = currentPriority;
                }
            }
        }
        const previousConfigId = this._currentConfigId;
        this._currentConfigId = highestApplicableId;
        if(previousConfigId !== this._currentConfigId) this._configChangeHandler(this.currentConfig, this._currentConfigId, previousConfigId);
    }

};