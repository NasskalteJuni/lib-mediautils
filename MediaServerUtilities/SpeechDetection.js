class SpeechDetection{

    /**
     * creates a speech (or noise) detector,
     * which checks which given Streams are currently loud enough for typical human speech
     * (most parts of this were directly taken or inspired by hark.js https://github.com/latentflip/hark/)
     * @param config [object]
     * @param config.treshold [number=-70] a dBFS measure. Positive numbers will be made negative
     * @param config.samplingInterval [number=100] milliseconds between samples. Higher sample rate equals earlier detection but also more cpu cost
     * @param config.smoothingConstant [number=0.1] smoothes input to avoid peaks, set values with caution
     * @param config.requiredSamplesForSpeech [number=5] on how many consecutive samples must be a dBFS value over treshold to be considered speech
     * @param config.debug [boolean=false] logging on events if true
     * */
    constructor({threshold=-70, samplingInterval=100, smoothingConstant=0.1, requiredSamplesForSpeech=5, debug=false} = {}){
        this._smoothingConstant = 0.1;
        this._samplingInterval = 100; //ms
        this._treshold = -Math.abs(threshold);
        this.requiredSamplesForSpeech = 3;
        this._in = {};
        this._out = {};
        this._context = new AudioContext();
        this._onSpeechStartByStream = () => {};
        this._onSpeechEndByStream = () => {};
        this._onSpeechStart = () => {};
        this._onSpeechEnd = () => {};
        this._onSpeakerChange = () => {};
        this._lastSpeakers = [];
        this._silence = true;
        this._debug = debug;
        this._analyzerLoop = setInterval(() => {
            Object.keys(this._in).forEach(this._processForEachUser.bind(this));
            const currentSpeakers = Object.keys(this._out).reduce((speakers, id) => this._getStatsFor(id).speaking ? speakers.concat(id) : speakers, []).sort();
            const currentLength = currentSpeakers.length;
            const lastLength = this._lastSpeakers.length;
            const change = currentLength !== lastLength || !currentSpeakers.reduce((allSame, id, i) => currentSpeakers[i] === this._lastSpeakers[i] ? allSame : false, true);
            const speechEnd = currentLength === 0 && lastLength > 0;
            const speechStart = currentLength > 0 && lastLength === 0;
            if(speechStart){
                if(this._debug) console.log('speech start');
                this._onSpeechStart(currentSpeakers);
                this._silence = false;
            }
            if(speechEnd){
                if(this._debug) console.log('speech end');
                this._onSpeechEnd(currentSpeakers);
                this._silence = true;
            }
            if(change){
                if(this._debug) console.log('speakers changed', currentSpeakers, this._lastSpeakers);
                this._onSpeakerChange(currentSpeakers, this._lastSpeakers.slice());
            }
            this._lastSpeakers = currentSpeakers;
        }, this._samplingInterval);
    }

    /**
     * @param v [number] decibel (dBFS) value set as treshold for sound, non negative values will be made negative
     * */
    set treshold(v){
        this.treshold = -Math.abs(v);
    }

    /**
     * the current treshold for a stream to be considered not silent
     * */
    get treshold(){
        return this.treshold;
    }

    /**
     * @readonly
     * current stats by each registered stream
     * */
    get out(){
        return Object.assign({}, this._out);
    }

    /**
     * @readonly
     * if all registered streams are silent
     * */
    get silence(){
        return this._silence;
    }

    _getStatsFor(id){
        if(!this._out[id]) this._out[id] = {consecutiveSamplesOverTreshold: 0, speaking: false, current: null};
        return this._out[id];
    }

    /**
     * add a stream to the current detection process
     * @param stream [MediaStream] a media stream to add (not checked, if it contains audio tracks at the current time or not)
     * @param id an id to reference the stream and its results
     * */
    addStream(stream, id){
        const analyzer = this._context.createAnalyser();
        analyzer.fftSize = 512;
        analyzer.smoothingTimeConstant = this._smoothingConstant;
        const fftBins = new Float32Array(analyzer.frequencyBinCount);
        const source = this._context.createMediaStreamSource(stream);
        source.connect(analyzer);
        this._in[id] = {analyzer, fftBins, source, stream};
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
                this._onSpeechStartByStream(id);
            }
        }else{
            output.consecutiveSamplesOverTreshold = 0;
            if(output.speaking){
                output.speaking = false;
                this._onSpeechEndByStream(id);
            }
        }
    }

    static _checkCb(cb){
        if(typeof cb !== "function") throw new Error('Callback must be a function');
    }

    /**
     * callback triggers when any stream switches from silent to speaking,
     * the id of the stream is given to the callback function
     * @param cb [function]
     * */
    onSpeechStartByStream(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechStartByStream = cb;
    }

    /**
     * callback triggers when any stream switches from speaking to silent,
     * the id of the stream is given to the callback function
     * @param cb [function]
     * */
    onSpeechEndByStream(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechEndByStream = cb;
    }

    /**
     * callback triggers, when no one was speaking and now one stream went from silence to speaking.
     * The callback receives a list of ids of streams which are not silent any more
     * @param cb [function]
     * */
    onSpeechStart(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechStart = cb;
    }

    /**
     * callback triggers, when the last not silent stream goes silent
     * @param cb [function]
     * */
    onSpeechEnd(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeechEnd = cb;
    }

    /**
     * callback triggers, as soon as another stream goes from silent to speaking or vice versa
     * */
    onSpeakerChange(cb){
        SpeechDetection._checkCb(cb);
        this._onSpeakerChange = cb;
    }
}

module.exports = SpeechDetection;