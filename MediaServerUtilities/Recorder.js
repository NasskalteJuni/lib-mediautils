/**
 * Allows recording media to a file
 * @class
 * */
class Recorder{

    /**
     * @param {MediaStream|MediaStreamTrack} m The media to record
     * @param {Object} [settings]
     * @param {Boolean} [audioOnly=false] If the recorder should only record audio or also video.
     * @param {Boolean} [startImmediately=true] If the recording process should start immediately or only after start was called
     * @param {String} [fileExtension] the file extension to use
     * */
    constructor(m, {audioOnly = false, startImmediately = true, fileExtension = null} = {}){
        this._fileExtension = fileExtension;
        this._recorder = new MediaRecorder(m);
        this._data = [];
        this.maxRetrievalTime = 5000;
        if(startImmediately) this._recorder.start();
        else this.start = () => this._recorder.start();
    }

    /**
     * creates a unique file name for the recording, including a fitting file extension
     * @private
     * */
    _createFileName(){
        const name = "recording";
        const date = new Date().toISOString();
        const extension = this._fileExtension || (this._recorder.mimeType.startsWith('audio') ? '.ogg' : '.mp4');
        return date + '_' + name + extension;
    }

    /**
     * write the already recorded data into a file
     * @return {Promise} resolves with a file object or rejects with an error
     * */
    toFile(){
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => clearTimeout(timeout) || reject(new Error('Retrieving data took to long')), this.maxRetrievalTime);
            this._recorder.ondataavailable = e => {
                if(e.data.size === 0) reject(new Error('Empty Recorder or cannot access recorded data at the moment'));
                this._data.push(e.data);
                const blob = new Blob(this._data, this._recorder.mimeType);
                resolve(new File([blob], this._createFileName()));
            };
            this._recorder.onerror = err => reject(err);
            this._recorder.requestData();
        });
    }

}

module.exports = Recorder;