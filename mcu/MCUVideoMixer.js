class MCUVideoMixer{

    /**
     * create a new video mixer
     * @param canvas a canvas element to use for mixing MediaStreams together. Can be null (creates new), an element, or a query selector string like 'div.main>#canvas'
     * @param fps [int=30] frames per second used for mixing & sampling
     * */
    constructor(canvas, fps=30){
        this._in = {};
        this._initCanvas(canvas)
    }

    _initCanvas(canvas){
        if(canvas === null) canvas = document.createElement("canvas");
        this._canvas = typeof canvas === "string" ? document.querySelector(canvas) : canvas;
        if(this._canvas){
            this._context = this._canvas.getContext("2d");
            this._context.fillStyle="rgb(20,20,20)";
            this._context.fillRect(0,0,this._canvas.width,this._canvas.height);
            this._out = this._canvas.captureStream(fps);
        }
        if(!this._canvas && typeof canvas === "string") window.addEventListener('load',() => this._initCanvas(canvas));
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

    mix(){
        this._paintloop = setInterval(() => {
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