/**
 * Intended to blend together multiple audio tracks to one single track
 * @class
 * @implements MediaConsuming
 * */
class AudioMixer{

    /**
     * creates a new AudioMixer object
     * */
    constructor(){
        this._context = new AudioContext();
        this._destination = this._context.createMediaStreamDestination();
        this._out = this._destination.stream;
        this._in = {};
    }

    /**
     * the mixed MediaStream
     * @readonly
     * */
    get out(){
        return this._out;
    }

    /**
     * the mixed MediaStreamTrack
     * @readonly
     * */
    get outputTrack(){
        return this._out.getAudioTracks()[0];
    }

    /**
     * add media into the mixing process
     * @param {MediaStream|MediaStreamTrack} m The media to mix. A given stream should contain exactly 1 audio track, a given track should be of kind audio
     * @param id [string=m.id] a unique identifier for the given media
     * */
    addMedia(m, id) {
        if(arguments.length === 1) id = m.id;
        if(m instanceof MediaStreamTrack) m = new MediaStream([m]);
        this._in[id] = this._context.createMediaStreamSource(m);
        this._rebuildGraph();
    }

    /**
     * removes media from the mixing process
     * @param {string|MediaStream|MediaStreamTrack} m The media to remove. Either a stream, a track or the identifier that was used to add the track
     * */
    removeMedia(m){
        if(arguments.length === 0) Object.keys(this._in).forEach(k => delete this._in[k]);
        if(arguments[0] instanceof MediaStream || arguments[0] instanceof MediaStreamTrack) m = arguments[0].id;
        delete this._in[m];
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
        this._merger.connect(this._destination);
        inputs.forEach((input, i) => input.connect(this._merger, 0, i));
    }

    /**
     * stop the audio mixer and free used resources
     * */
    close(){
        this._context.close()
    }

}

module.exports = AudioMixer;