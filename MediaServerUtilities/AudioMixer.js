class AudioMixer{

    constructor(){
        this._context = new AudioContext();
        this._out = this._context.createMediaStreamDestination();
        this._in = {};
    }

    get out(){
        return this._out.stream;
    }

    get outputTrack(){
        return this._out.stream.getAudioTracks()[0];
    }

    addStream(m, id) {
        if(arguments.length === 1) id = m.id;
        if(m instanceof MediaStreamTrack) m = new MediaStream([m]);
        this._in[id] = this._context.createMediaStreamSource(m);
        this._rebuildGraph();
    }

    removeStream(id){
        if(arguments[0] instanceof MediaStream || arguments[0] instanceof MediaStreamTrack) id = arguments[0].id;
        delete this._in[id];
        this._rebuildGraph();
    }

    _rebuildGraph(){
        const inputs = Object.values(this._in);
        if(this._merger) this._merger.disconnect();
        if(!inputs.length) return;
        this._merger = this._context.createChannelMerger(inputs.length);
        this._merger.connect(this._context.destination);
        inputs.forEach((input, i) => input.connect(this._merger, 0, i));
    }

}

module.exports = AudioMixer;