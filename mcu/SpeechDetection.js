class SpeechDetection{

    /**
     * creates a speech (or noise) detector,
     * which checks which given Streams are currently loud enough for typical human speech
     * (most parts of this were directly taken or inspired by hark.js https://github.com/latentflip/hark/)
     * */
    constructor(){
        this._smoothingConstant = 0.1;
        this._samplingInterval = 100; //ms
        this._treshold = -75;
        this.requiredSamplesForSpeech = 3;
        this._in = {};
        this._out = {};
        this._context = new AudioContext();
        this._onSpeechStartByUser = () => {};
        this._onSpeechEndByUser = () => {};
        this._onSpeechStart = () => {};
        this._onSpeechEnd = () => {};
        this._onSpeakerChange = () => {};
        this._lastSpeakers = [];
        this._silence = true;
        this._analyzerLoop = setInterval(() => {
            Object.keys(this._in).forEach(this._processForEachUser.bind(this));
            const currentSpeakers = Object.keys(this._out).reduce((speakers, id) => this._getStatsFor(id).speaking ? speakers.concat(id) : speakers, []).sort();
            const currentLength = currentSpeakers.length;
            const lastLength = this._lastSpeakers.length;
            const change = currentLength !== lastLength || !currentSpeakers.reduce((allSame, id, i) => currentSpeakers[i] === this._lastSpeakers[i] ? allSame : false, true);
            const speechEnd = currentLength === 0 && lastLength > 0;
            const speechStart = currentLength > 0 && lastLength === 0;
            if(speechStart){
                this._onSpeechStart();
                this._silence = false;
            }
            if(speechEnd){
                this._onSpeechEnd();
                this._silence = true;
            }
            if(change) this._onSpeakerChange(currentSpeakers, this._lastSpeakers.slice())
            this._lastSpeakers = currentSpeakers;
        }, this._samplingInterval);
    }

    /**
     * @param v [number] decibel (dBFS) value set as treshold for sound, non negative values will be made negative
     * */
    set treshold(v){
        this.treshold = -Math.abs(v);
    }

    get treshold(){
        return this.treshold;
    }

    get out(){
        return this._out;
    }

    get silence(){
        return this._silence;
    }

    _getStatsFor(id){
        if(!this._out[id]) this._out[id] = {consecutiveSamplesOverTreshold: 0, speaking: false, current: null};
        return this._out[id];
    }

    addStream(stream, id){
        const analyzer = this._context.createAnalyser();
        analyzer.fftSize = 512;
        analyzer.smoothingTimeConstant = this._smoothingConstant;
        const fftBins = new Float32Array(analyzer.frequencyBinCount);
        const source = this._context.createMediaStreamSource(stream);
        source.connect(analyzer);
        this._in[id] = {analyzer, fftBins};
    }

    _analyzeVolume(analyzer, fftBins){
        analyzer.getFloatFrequencyData(fftBins);
        // set max as smallest value and min as biggest value so that any other value will overwrite them
        let minVolume = 0; // highest dBFS
        let maxVolume = -Infinity; // silence
        let average = 0;
        let count = 0;
        fftBins.forEach(f => {
            if(f > maxVolume) maxVolume = f;
            if(f < minVolume) minVolume = f;
            average+=f;
            count++;
        });
        average/=count;
        return {minVolume, maxVolume, average}
    }

    _processForEachUser(id){
        const output = this._getStatsFor(id);
        const stats = this._analyzeVolume(this._in[id].analyzer, this._in[id].fftBins);
        output.current = stats;
        if(stats.maxVolume > this._treshold){
            output.consecutiveSamplesOverTreshold++;
            if(output.consecutiveSamplesOverTreshold > this.requiredSamplesForSpeech){
                output.speaking = true;
                this._onSpeechStartByUser(id);
            }
        }else{
            output.consecutiveSamplesOverTreshold = 0;
            if(output.speaking){
                output.speaking = false;
                this._onSpeechEndByUser(id);
            }
        }
    }

    static _checkCb(cb){
        if(typeof cb !== "function") throw new Error('Callback must be a function');
    }

    onSpeechStartByUser(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechStartByUser = cb;
    }

    onSpeechEndByUser(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechEndByUser = cb;
    }

    onSpeechStart(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechStart = cb;
    }

    onSpeechEnd(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechEnd = cb;
    }

    onSpeakerChange(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeakerChange = cb;
    }
}