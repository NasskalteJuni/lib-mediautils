/**
 * Define custom video mixing configurations
 * @class
 * */
class VideoMixingConfiguration {

    /**
     * Create a new VideoMixingConfiguration with the given settings
     * @param {Object} settings
     * @param {Boolean|Function} [settings.applicable=true] Use this setting to define if the config can be used. Use a function that receives currently mixed ids to determine, if the config is usable under the given circumstances
     * @param {Array|Function} [settings.positions=[]] Define, where a stream should be rendered. A function receives the ids, index and array of mixed ids. Can be used to render a grid layout of videos. The positions can have x, y, width, height and zIndex values, either static with given values or functions that will be calculated during render
     * @param {String|Function} [settings.background='rgb(20,20,20)'] Which background to use. Can be a static value or a function which receives the ids and is evaluated while rendering
     * @param {Number|Function} [settings.priority=0] If two VideoMixingConfigurations are applicable at the same time, the one with the higher priority will be used. A function will receive the currently mixed ids, but will not be updated while rendering but only when adding another config or media
     * */
    constructor(settings) {
        this.__isVideoMixingConfigurationObject = true;
        this.width = 0;
        this.height = 0;
        this._applicable = settings.applicable || true;
        this._positions = settings.positions || [];
        this._background = settings.background || 'rgb(20,20,20)';
        this._priority = settings.priority || 0;
        this.paint = null;
    }

    /**
     * check if this function can be used under the given circumstances
     * @param {Array} ids the currently mixed ids
     * @return {Boolean}
     * */
    applicable(ids){
        if(typeof this._applicable === "function"){
            return this._applicable(ids);
        }else{
            return !!this._applicable;
        }
    }

    /**
     * check which priority this config currently
     * @param {Array} ids the currently mixed ids
     * @return {Number}
     * */
    priority(ids){
        if(this._priority === undefined){
            return 0;
        }else if(typeof this._priority === "function"){
            return this._priority(ids);
        }else{
            return +this._priority;
        }
    }

    /**
     * get a function that will return the current background value
     * @return {Function}
     * */
    background(){
        if(typeof this._background === "function"){
            return this._background;
        }else{
            return () => this._background;
        }
    }

    /**
     * get a pre-calculated position Object for the given id at the given index of the given array
     * @return {Object} an object with x,y,with and height values as assigned video sources
     * */
    positions(id, index, arr){
        if(typeof this._positions === "function"){
            // case: generating function -> let the function handle the creation of position objects
            return this._positions(id, index, arr);
        }else if(this._positions instanceof Array){
            // case: array -> return the array element at given index
            return this._positions[index];
        }else{
            // case: single object -> return a clone of the single object for every stream
            return Object.assign({}, this._positions);
        }
    }
}

module.exports =VideoMixingConfiguration;