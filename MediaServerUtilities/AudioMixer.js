class AudioMixer{

    constructor(){
        this._context = new AudioContext();
        this._out = this._context.createMediaStreamDestination();
        this._in = {};
        const analyzer = this._context.createAnalyser();
        analyzer.maxDecibels
    }

    get out(){
        return this._out.stream;
    }

    get outputTrack(){
        return this._out.stream.getAudioTracks()[0];
    }

    addStream(mediaStream, id) {
        this._in[id] = this._context.createMediaStreamSource(mediaStream);
        this._rebuildGraph();
    }

    removeStream(mediaStream, id){
        delete this._in[id];
        this._rebuildGraph();
    }

    _rebuildGraph(){
        const inputs = Object.values(this._in);
        if(this._merger) this._merger.disconnect();
        this._merger = this._context.createChannelMerger(inputs.length);
        this._merger.connect(this._context.destination);
        inputs.forEach((input, i) => input.connect(this._merger, 0, i));
    }

}

module.exports = AudioMixer;