/**
 * @class
 * Intended to blend together multiple audio tracks to one single track
 * */
class AudioMixer{

    /**
     * creates a new AudioMixer object
     * */
    constructor(){
        this._context = new AudioContext();
        this._out = this._context.createMediaStreamDestination();
        this._in = {};
    }

    /**
     * the mixed stream
     * @readonly
     * @return MediaStream
     * */
    get out(){
        return this._out.stream;
    }

    /**
     * the mixed track
     * @readonly
     * @return MediaStreamTrack
     * */
    get outputTrack(){
        return this._out.stream.getAudioTracks()[0];
    }

    /**
     * add media into the mixing process
     * @param media [MediaStream|MediaStreamTrack] media to mix
     * @param id [string=media.id] a unique identifier for the given media
     * */
    addMedia(media, id) {
        if(arguments.length === 1) id = media.id;
        if(media instanceof MediaStreamTrack) media = new MediaStream([media]);
        this._in[id] = this._context.createMediaStreamSource(media);
        this._rebuildGraph();
    }

    /**
     * removes media from the mixing process
     * @param id [string|MediaStream|MediaStreamTrack] the id of the added media or the media itself
     * */
    removeMedia(id){
        if(arguments[0] instanceof MediaStream || arguments[0] instanceof MediaStreamTrack) id = arguments[0].id;
        delete this._in[id];
        this._rebuildGraph();
    }

    /**
     * @private
     * */
    _rebuildGraph(){
        const inputs = Object.values(this._in);
        if(this._merger) this._merger.disconnect();
        if(!inputs.length) return;
        this._merger = this._context.createChannelMerger(inputs.length);
        this._merger.connect(this._context.destination);
        inputs.forEach((input, i) => input.connect(this._merger, 0, i));
    }

    /**
     * stop the audio mixer and free used resources
     * */
    stop(){
        this._context.close()
    }

}

module.exports = AudioMixer;