class Recorder{

    constructor(stream, {audioOnly = false, startImmediately = true, fileExtension = null} = {}){
        this._fileExtension = fileExtension;
        this._recorder = new MediaRecorder(stream);
        this._data = [];
        this.maxRetrievalTime = 5000;
        if(startImmediately) this._recorder.start();
        else this.start = () => this._recorder.start();
    }

    _createFileName(){
        const name = "recording";
        const date = new Date().toISOString();
        const extension = this._fileExtension || (this._recorder.mimeType.startsWith('audio') ? '.ogg' : '.mp4');
        return date + '_' + name + extension;
    }

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