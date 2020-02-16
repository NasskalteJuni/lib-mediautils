const Configurations = require("./_VideoMixingConfigurations.js");
const Videos = require("./_VideoStreams.js");

class VideoMixer extends Videos(Configurations()){

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
        super();
        this._width = width;
        this._height = height;
        this.fps = fps;
        this._initCanvas(canvas, width, height);
        if(startImmediately) this.start();
        // tie together the video streams and the configurations.
        // changes in the streams require always position recalculation and an update to the config that sometimes changes the current config
        this.onStreamChange(ids => {
            this.updateStreamIds(ids);
            if(this.currentConfig) this._precalculatePositionsAndMatchStreams(this.currentConfig)
        });
        // when the config changes, which does not necessary be due to a change to the used streams
        // (a forceful configuration change, for example)
        // precalculate the positions
        this.onConfigChange(this._precalculatePositionsAndMatchStreams);
        this._snapshot = null;
    }

    /**
     * @private
     * */
    _precalculatePositionsAndMatchStreams(currentConfig){
        currentConfig.width = this._canvas.width;
        currentConfig.height = this._canvas.height;
        if(!currentConfig.paint){
            const ids = this.streamIds();
            currentConfig.calculatedPositions = ids.map(currentConfig.positions.bind(currentConfig));
            currentConfig.calculatedPositions.sort((a, b) => {
                const aVal = a.id !== undefined ? 0 : a.index !== undefined ? 1 : 2;
                const bVal = b.id !== undefined ? 0 : b.index !== undefined ? 1 : 2;
                const diff = aVal - bVal;
                if(diff === 0 && a.index !== undefined) return (typeof a.index === "function" ? a(ids) : a) - (typeof b.index === "function" ? b(ids) : b);
                else return diff;
            });
            currentConfig.calculatedPositions.forEach((pos) => {
                let id = null;
                if(pos.id !== undefined){
                    id = typeof pos.id === "function" ? pos.id(ids) : pos.id;
                    if(!this.videoByStreamId(id)) throw new Error('no stream with id '+id);
                    pos.source = this.videoByStreamId(id);
                    pos.assignedId = id;
                }else if(pos.index !== undefined){
                    let index = typeof pos.index === "function" ? pos.index(ids) : pos.index;
                    if(index > ids.length) throw new Error('not enough streams for index '+index);
                    id = ids[index];
                    pos.source = this.videoByStreamId(id);
                    pos.assignedId = id;
                }else{
                    if(!ids.length) throw new Error('more position definitions than streams');
                    id = ids[0];
                    pos.source = this.videoByStreamId(id);
                    pos.assignedId = id;
                }
                ids.shift();
            });
        }
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
            this._out = this._canvas.captureStream(this.fps);
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
     * can be used to start the mixing process, use this if the option startImmediately was set to false
     * */
    start(){
        this._paintloop = setInterval(this._draw.bind(this), 1000 / this.fps);
    }

    /**
     * stops the video mixing process
     * */
    stop(){
        clearInterval(this._paintloop);
        this._context.clearRect(0,0,this._canvas.width,this._canvas.height);
    }

    /**
     * debug function. allows you to see the calculated values and used configs
     * */
    snapshot(fn){
        this._snapshot = fn;
    }

    /**
     * @private
     * draw the current streams on according to the current config in use on a canvas
     * */
    _draw(){
        if(!this.currentConfig) return;
        const ids = this.streamIds();
        if(this.currentConfig.paint){
            // let the custom paint function handle it
            this.currentConfig.paint(ids, this._canvas, this._context);
        }else{
            const snapshot = {background: null, mixed: []};
            this._context.clearRect(0,0,this._width,this._height);
            const background = this.currentConfig.background()(ids);
            this._context.fillStyle = background;
            snapshot.background = background;
            this._context.fillRect(0,0,this._width, this._height);
            // check if you have to resolve position functions
            const resolveFn = (v, s) => typeof v === "function" ? v(s) : v;
            this.currentConfig.calculatedPositions.forEach((pos, drawIndex) => {
                const stats = {width: this.width, height: this.height, id: pos.assignedId};
                if(pos.source){
                    const x = resolveFn(pos.x, stats);
                    const y = resolveFn(pos.y, stats);
                    const width = resolveFn(pos.width, stats);
                    const height = resolveFn(pos.height, stats);
                    this._context.drawImage(pos.source, x, y, width, height);
                    snapshot.mixed.push({id: pos.assignedId, drawIndex, x, y, width, height});
                }
            });
            if(this._snapshot){
                this._snapshot(snapshot);
                this._snapshot = null;
            }
        }
    }

}

module.exports = VideoMixer;