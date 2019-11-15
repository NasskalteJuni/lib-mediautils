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
     * @param stream the MediaStream object to manage
     * @param id the unique identifier used for the mediaStream (useful for removal, custom grids, etc.).
     * */
    addStream(stream, id){
        const helper = document.createElement('video');
        helper.autoplay = true;
        helper.muted = true;
        helper.loop = true;
        helper.srcObject = stream;
        helper.onload = () => helper.play();
        this._streams[id] = helper;
        this._onStreamChangeHandler(this.streamIds());
    }

    /**
     * removes a MediaStream from the mixing process
     * @param id the id used to add the media stream
     * @throws Error when there is no stream with the given id
     * */
    removeStream(id){
        if(!this._streams[id]) throw new Error('No stream with id ' + id);
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