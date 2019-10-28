const _StreamPositionMatcher = require("./_StreamPositionMatcher.js");
const _CurrentConfigFinder = require("./_CurrentConfigFinder");

class VideoMixer{

    /**
     * create a new video mixer
     * @param config [object] a configuration object
     * @param config.canvas (optional) a canvas element to use for mixing MediaStreams together. Can be null (default, creates new), an element, or a query selector string like 'div.main>#canvas'
     * @param config.fps [int=30] frames per second used for mixing & sampling
     * @param config.startImmediately [boolean=true] tells the mixer to start the mixing as soon as the object is constructed (no waiting for call to .start())
     * @param config.width [int=-1] the width of a newly created canvas, -1 is used to infer the width automatically
     * @param config.height [int=-1] the height of a newly created canvas, -1 is used to infer the width automatically
     * */
    constructor({canvas = null, fps = 30, startImmediately = true, width=-1, height=-1} = {}){
        this._in = {};
        this._configs = {};
        this._width = width;
        this._height = height;
        this._initCanvas(canvas, width, height);
        if(startImmediately) this.start();
    }

    /**
     * @private
     * set up a canvas to mix videos according to the optionally given width and height
     * */
    _initCanvas(canvas, width, height){
        if(canvas === null) canvas = document.createElement("canvas");
        this._canvas = typeof canvas === "string" ? document.querySelector(canvas) : canvas;
        if(this._canvas){
            if(this._width !== -1){
                canvas.width = this._width;
                canvas.style.width = this._width + 'px';
            }else{
                this._width = +this._canvas.style.width.replace('px','');
            }
            if(this._height !== -1){
                canvas.height = this._height;
                canvas.style.height = this._height + 'px';
            }else{
                this._height = +this._canvas.style.height.replace('px','');
            }
            this._context = this._canvas.getContext("2d");
            this._context.clearRect(0,0,this._canvas.width,this._canvas.height);
            this._out = this._canvas.captureStream(fps);
        }
        if(!this._canvas && typeof canvas === "string") window.addEventListener('load',() => this._initCanvas(canvas, width, height));
    }


    /**
     * mixed output as a MediaStream
     * @return MediaStream
     * */
    get out(){
        return this._out;
    }

    /**
     * mixed output as a MediaStreamTrack of kind video
     * @return MediaStreamTrack
     * */
    get outputTrack(){
        return this._out.getVideoTracks()[0];
    }

    /**
     * the id of the currently used config
     * @return String
     * */
    get currentConfig(){
        return this._currentConfig ? this._currentConfig.id : null;
    }

    /**
     * @readonly
     * the pixel width of the mixed video
     * */
    get width(){
        return this._width;
    }

    /**
     * @readonly
     * the pixel height of the mixed video
     * */
    get height(){
        return this._height;
    }

    /**
     * adds a MediaStream to the mixing process
     * @param mediaStream the MediaStream object to mix in
     * @param id the unique identifier used for the mediaStream (useful for removal, custom grids, etc.). Defaults to the MediaStreams mid.
     * */
    addStream(mediaStream, id){
        if(id === null || id === undefined) id = mediaStream.id;
        const helper = document.createElement('video');
        helper.autoplay = true;
        helper.loop = true;
        helper.srcObject = mediaStream;
        helper.onload = () => helper.play();
        this._in[id] = helper;
        this._updateCurrentConfig();
    }

    /**
     * removes a MediaStream from the mixing process
     * @param id the id used to add the media stream
     * @throws Error when there is no stream with the given id
     * */
    removeStream(id){
        if(!this._in[id]) throw new Error('No such stream');
        delete this._in[id];
        this._updateCurrentConfig();
    }

    /**
     * can be used to start the mixing process, use this if the option startImmediately was set to false
     * */
    start(){
        this._paintloop = setInterval(this._draw.bind(this), 1000 / fps);
    }

    /**
     * stops the video mixing process
     * */
    stop(){
        clearInterval(this._paintloop);
        this._context.clearRect(0,0,this._canvas.width,this._canvas.height);
    }

    /**
     * add a configuration to define how different streams shall be displayed beside each other
     * @param cfg [object | VideoMixingConfiguration] configuration
     * @param id [string] configuration identifier
     * */
    addConfig(cfg, id){
        const isVideoMixingConfig = cfg.__isVideoMixingConfigurationObject || cfg instanceof VideoMixingConfiguration;
        if(!isVideoMixingConfig) cfg = new VideoMixingConfiguration(cfg);
        this._configs[id] = cfg;
        cfg.id = id;
        this._updateCurrentConfig();
    }

    /**
     * force to use the given config at the current time
     * (until you remove or add another stream or config)
     * @param id [string] the id of the config to use
     * @throws Error when there is no config with the given id
     * */
    forceConfig(id){
        if(!this._configs[id]) throw new Error('No such config');
        this._currentConfig = this._configs[id];
        this._updateCurrentConfig();
    }

    /**
     * removes the desired config.
     * This may update the currently used config to another one, if you use the current one
     * @param id [string] the id of the config to remove
     * @throws Error when there is no config with the given id
     * */
    removeConfig(id){
        if(!this._configs[id]) throw new Error('No such config');
        delete  this._configs[id];
        this._updateCurrentConfig();
    }

    /**
     * @private
     * possibly changes the config, if there is a better fitting one (config is not applicable any more or has lower priority)
     * */
    _updateCurrentConfig(){
        // get all stream ids
        const ids = Object.keys(this._in);
        _CurrentConfigFinder.findCurrentConfig(this._configs, ids);
        // apply the current width and height
        highestPriority.width = this._canvas.width;
        highestPriority.height = this._canvas.height;
        // set this config as current config
        this._currentConfig = highestPriority;
        // setup complete
        // pre-compute placements to avoid doing this calculations on every render loop
        if(!this._currentConfig.paint){
            // precompute the positions, if they are hard values and no functions
            const _mixerRef = this;
            this._currentConfig._calculatedPositions = ids.map(_mixerRef._currentConfig.positions.bind(_mixerRef._currentConfig)).filter(p => p);
            // match positions to stream ids or indexes, ids with highest priority
            const unused = Object.assign({}, this._in);
            this._currentConfig._calculatedPositions.forEach((pos) => {
                let source = null;
                let key = null;
                if(pos.id !== undefined){
                    key = pos.id;
                }else if(pos.index){
                    key = Object.keys(unused)[pos.index];
                }else{
                    key = Object.keys(unused).shift();
                }
                source = unused[key];
                if(source){
                    // add source and id
                    pos._source = source;
                    pos._id = key;
                    // indicate that the given stream should not be used a second time
                    delete unused[key];
                }
            });
        }
    }

    /**
     * @private
     * draw the current streams on according to the current config in use on a canvas
     * */
    _draw(){
        const ids = Object.keys(this._in);
        if(this._currentConfig.paint){
            // let the custom paint function handle it
            this._currentConfig.paint(ids, this._canvas, this._context);
        }else{
            this._context.clearRect(0,0,this._width,this._height);
            // check if you have to resolve position functions
            this._currentConfig._calculatedPositions.forEach((pos) => {
                Object.keys(pos).forEach(k => {
                    const v = pos[k];
                    if(typeof v === "function") pos[k] = v({width: this.width, height: this.height, id: pos._id});
                });
                if(pos.source) this._context.drawImage(pos._source, pos.x, pos.y, pos.width, pos.height);
            });
        }
    }

}

module.exports = VideoMixer;