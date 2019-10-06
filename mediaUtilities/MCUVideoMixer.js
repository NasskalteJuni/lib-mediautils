class MCUVideoMixer{

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
        this._width = width;
        this._height = height;
        this._initCanvas(canvas, width, height);
        if(startImmediately) this.start();
    }

    _initCanvas(canvas, width, height){
        if(canvas === null)canvas = document.createElement("canvas");
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
            this._context.fillStyle="rgb(20,20,20)";
            this._context.fillRect(0,0,this._canvas.width,this._canvas.height);
            this._out = this._canvas.captureStream(fps);
        }
        if(!this._canvas && typeof canvas === "string") window.addEventListener('load',() => this._initCanvas(canvas, width, height));
    }


    /**
     * mixed output as a MediaStream
     * */
    get out(){
        return this._out;
    }

    /**
     * mixed output as a MediaStreamTrack of kind video
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
     * adds a MediaStream to the mixing process
     * @param mediaStream the MediaStream object to mix in
     * @param id the unique identifier used for the mediaStream (useful for removal, custom grids, etc.). Defaults to the MediaStreams mid.
     * */
    addStream(mediaStream, id){
        if(id === null || id === undefined) id = mediaStream.id;
        const helper = document.createElement('video');
        helper.autoplay = true;
        helper.srcObject = mediaStream;
        this._in[id] = helper;
    }

    /**
     * removes a MediaStream from the mixing process
     * @param id the id used to add the media stream
     * */
    removeStream(id){
        delete this._in[id];
    }

    start(){
        this._paintloop = setInterval(() => {
            this._context.fillRect(0,0,this._canvas.width, this._canvas.height);
            Object.keys(this._in)
                .forEach((id, i, list) => {
                    const video = this._in[id];
                    //TODO: Implement Grid and customizable mixing options
                    this._context.drawImage(video,i*this._canvas.width/list.length,0,this._canvas.width/list.length,this._canvas.height)
                })
        }, 1000 / fps);
    }

    stop(){
        clearInterval(this._paintloop);
        this._context.fillRect(0,0,this._canvas.width,this._canvas.height);
    }
}