/**
 * @mixin
 * Handle Video Streams
 * */
module.exports = (superclass=Object) => class C extends superclass{

    constructor(){
        super(...arguments);
        this._streams = {};
        this._onStreamChangeHandler = () => {};
    }

    /**
     * adds a MediaStream to the managed streams
     * @param m the MediaStream object to manage
     * @param id the unique identifier used for the mediaStream (useful for removal, custom grids, etc.). Defaults to the media stream id
     * */
    addStream(m, id){
        if(arguments.length === 1) id = m.id;
        if(m instanceof MediaStreamTrack) m = new MediaStream([m]);
        const helper = document.createElement('video');
        helper.autoplay = true;
        helper.muted = true;
        helper.srcObject = m;
        helper.style.visibility = "hidden";
        helper.style.pointerEvents = "none";
        helper.style.position = "absolute";
        helper.addEventListener('pause', () => helper.play());
        document.body.appendChild(helper);
        this._streams[id] = helper;
        this._onStreamChangeHandler(this.streamIds());
    }

    /**
     * removes a MediaStream from the mixing process
     * @param id [string|MediaStream|MediaStreamTrack] the id used to add the media stream. If the media stream was added without id, you have to pass in the stream or track that was added
     * @throws Error when there is no stream with the given id
     * */
    removeStream(id){
        if(id instanceof MediaStream || id instanceof MediaStreamTrack) id = id.id;
        delete this._streams[id];
        this._onStreamChangeHandler(this.streamIds());
    }

    /**
     * @returns array the list of current streams as their ids
     * */
    streamIds(){
        return Object.keys(this._streams);
    }

    /**
     * @returns HTMLVideoElement of the stream id
     */
    videoByStreamId(id){
        return this._streams[id];
    }

    onStreamChange(cb){
        if(typeof cb !== "function") throw new Error("Callback must be of type function");
        this._onStreamChangeHandler = cb;
    }
};