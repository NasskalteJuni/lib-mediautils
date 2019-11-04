class VideoMixingConfiguration {

    constructor(settings) {
        this.__isVideoMixingConfigurationObject = true;
        this.width = 0;
        this.height = 0;
        this._applicable = settings.applicable || true;
        this._positions = settings.positions || [];
        this._background = settings.background || 'rgb(20,20,20)';
        this.paint = settings.paint || null;
        this._priority = settings.priority || 0;
    }

    /**
     * @return boolean
     * */
    applicable(ids){
        if(typeof this._applicable === "function"){
            return this._applicable(ids);
        }else{
            return !!this._applicable;
        }
    }

    /**
     * @return number
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
     * @return string
     * */
    background(ids){
        if(typeof this._background === "function"){
            return this._background(ids);
        }else{
            return this._background;
        }
    }

    /**
     * @return object
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