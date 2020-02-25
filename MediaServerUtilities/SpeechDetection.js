const Listenable = require('./Listenable.js');

class SpeechDetection extends Listenable(){

    /**
     * creates a speech (or noise) detector,
     * which checks which given media streams or tracks are currently loud enough for typical human speech
     * (key parts were directly taken from or inspired by hark.js https://github.com/latentflip/hark/)
     * @param config [object]
     * @param config.threshold [number=-70] a dBFS measure. Positive numbers will be made negative
     * @param config.samplingInterval [number=100] milliseconds between samples. Higher sample rate equals earlier detection but also more cpu cost
     * @param config.smoothingConstant [number=0.1] smoothes input to avoid peaks, set values with caution
     * @param config.requiredSamplesForSpeech [number=5] on how many consecutive samples must be a dBFS value over threshold to be considered speech
     * @param config.verbose [boolean=false] logging on events if true
     * @param config.logger [logger=console] a logger to use, defaults to browser console
     * */
    constructor({threshold=-70, samplingInterval=100, smoothingConstant=0.1, requiredSamplesForSpeech=5, verbose=false, logger=console} = {}){
        super();
        this._smoothingConstant = 0.1;
        this._samplingInterval = 100; //ms
        this._treshold = -Math.abs(threshold);
        this.requiredSamplesForSpeech = 3;
        this._in = {};
        this._out = {};
        this._context = new AudioContext(); // careful, audio context may need user interaction to work
        this._lastSpeakers = [];
        this._lastSpeaker = null;
        this._silence = true;
        this._verbose = verbose;
        this._logger = logger;
        this._analyzerLoop = setInterval(() => {
            Object.keys(this._in).forEach(this._processForEachUser.bind(this));
            const currentSpeakers = Object.keys(this._out).reduce((speakers, id) => this._getStatsFor(id).speaking ? speakers.concat(id) : speakers, []).sort();
            const currentLength = currentSpeakers.length;
            const lastLength = this._lastSpeakers.length;
            const change = currentLength !== lastLength || !currentSpeakers.reduce((allSame, id, i) => currentSpeakers[i] === this._lastSpeakers[i] ? allSame : false, true);
            const speechEnd = currentLength === 0 && lastLength > 0;
            const speechStart = currentLength > 0 && lastLength === 0;
            if(speechStart){
                if(this._verbose) this._logger.log('speech start');
                this.dispatchEvent('speechstart', [currentSpeakers]);
                this._silence = false;
            }
            if(speechEnd){
                if(this._verbose) this._logger.log('speech end');
                this.dispatchEvent('speechend', [currentSpeakers]);
                this._silence = true;
            }
            if(change){
                if(this._verbose) this._logger.log('speakers changed', currentSpeakers, this._lastSpeakers);
                this.dispatchEvent('speechchange', [currentSpeakers, this._lastSpeakers.slice()]);
            }
            if(currentLength > 0){
                this._lastSpeaker = currentSpeakers[0];
            }
            this._lastSpeakers = currentSpeakers;
        }, this._samplingInterval);
    }

    /**
     * stops the speech detection
     * */
    stop(){
        clearInterval(this._analyzerLoop);
    }

    /**
     * @param v [number] decibel (dBFS) value set as threshold for sound, non negative values will be made negative
     * */
    set threshold(v){
        this._threshold = -Math.abs(v);
    }

    /**
     * the current decibel (dBFS) threshold for a stream to be considered not silent
     * */
    get threshold(){
        return this._threshold;
    }

    /**
     * @readonly
     * current stats by each registered media
     * */
    get out(){
        return Object.assign({}, this._out);
    }

    /**
     * @readonly
     * if all registered media is silent
     * */
    get silence(){
        return this._silence;
    }

    /**
     * @readonly
     * a list of the latest speakers (empty when no one spoke since the last sample)
     * */
    get speakers(){
        return this._lastSpeakers
    }

    /**
     * @readonly
     * return the last or current speaker.
     * If currently there is silence, return the one that spoke last,
     * if currently someone is speaking, return the first of the speaking ones
     * */
    get lastSpeaker(){
        return this._lastSpeaker;
    }

    /**
     * get the (current) deciBel values (min, max, avg) for the given id
     * @param id [string] the media identifier used
     * */
    _getStatsFor(id){
        if(!this._out[id]) this._out[id] = {consecutiveSamplesOverTreshold: 0, speaking: false, current: null};
        return this._out[id];
    }

    /**
     * add media to the current detection process. you can pass in the media(stream or track) itself or its identifier
     * @param m [MediaStream|MediaStreamTrack] a stream or track to add (stream must contain at least one audio track)
     * @param id [string=media.id] an id to reference the media and its results
     * */
    addMedia(m, id){
        if(arguments.length === 1) id = m.id;
        if(m instanceof MediaStreamTrack) m = new MediaStream([m]);
        const analyzer = this._context.createAnalyser();
        analyzer.fftSize = 512;
        analyzer.smoothingTimeConstant = this._smoothingConstant;
        const fftBins = new Float32Array(analyzer.frequencyBinCount);
        const source = this._context.createMediaStreamSource(m);
        source.connect(analyzer);
        this._in[id] = {analyzer, fftBins, source, stream: m};
    }

    /**
     * Removes the given media. You can pass in the media (stream or track) itself or its identifier.
     * If call this method without any argument or with '*', it will remove any added media
     * @param m [MediaStream|MediaStreamTrack|string] the media to remove
     * */
    removeMedia(m){
        if(arguments.length === 0 || m === '*') return Object.keys(this._in).forEach(id => this.removeMedia(id));
        if(arguments[0] instanceof MediaStream || arguments[0] instanceof MediaStreamTrack){
            const matching = Object.keys(this._in).filter(id => this._in[id].stream.getTracks()[0].id === m.id || this._in[id].stream.id === m.id);
            if(matching.length) m = matching[0];
        }
        delete this._in[m];
        delete this._out[m];
        this._lastSpeakers = this._lastSpeakers.filter(s => s !== m);
        if(this._lastSpeaker === m) {
            if(this._lastSpeakers.length) this._lastSpeaker = this._lastSpeakers.indexOf(this._lastSpeaker)  >= 0 ? this._lastSpeaker : this._lastSpeakers[0];
            else this._lastSpeaker = null;
        }
    }

    /**
     * @private
     * takes an analyzer and sample buffer and retrieves the noise volume from it
     * @param analyzer [WebAudioNode] a web audio analyzer node
     * @param fftBins [Float32Array] a native buffer array containing the fft data of the sample at given time
     * @returns Object a dictionary containing the minimal, maximal and average volume in the sample
     * */
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

    /**
     * @private
     * check for each user, if the current media sample is above the threshold and therefore seen as more than just a bit of noise
     * @param id [string] the identifier for the given media
     * */
    _processForEachUser(id){
        const output = this._getStatsFor(id);
        const stats = this._analyzeVolume(this._in[id].analyzer, this._in[id].fftBins);
        output.current = stats;
        if(stats.maxVolume > this._treshold){
            output.consecutiveSamplesOverTreshold++;
            if(output.consecutiveSamplesOverTreshold > this.requiredSamplesForSpeech){
                output.speaking = true;
                this.dispatchEvent('speechstartid', [id]);
            }
        }else{
            output.consecutiveSamplesOverTreshold = 0;
            if(output.speaking){
                output.speaking = false;
                this.dispatchEvent('speechendid', [id]);
            }
        }
    }

}

module.exports = SpeechDetection;