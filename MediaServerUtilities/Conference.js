const ConnectionManager = require('./ConnectionManager.js');
const Connection = require('./ConnectionWithRollback.js');
const VideoMixer = require('./VideoMixer.js');
const AudioMixer = require('./AudioMixer.js');

module.exports = class Conference {

    constructor({name, signaler, verbose = false, logger = console, architecture= 'mesh'}){
        this._signaler = signaler;
        this._peers = new ConnectionManager({signaler, name, verbose, logger});
        this._sfu = new Connection({signaler, name, peer: '@server', verbose, logger});
        this._mcu = new Connection({signaler, name, peer: '@server', verbose, logger});
        this._videoMixer = new VideoMixer();
        this._audioMixer = new AudioMixer();
        this._architecture = architecture;
        this._stream = null;
        this._display = null;
        signaler.addEventListener('message', e => {
            const message = e.data;
            if(message.type === 'architecture:switch'){
                const previousArchitecture = this._architecture;
                this._architecture = message.data;
                if(this._stream){
                    this._getArchitecture(this._architecture).addMedia(this._stream);
                }
                if(this._display){
                    this._display.srcObject = this.out;
                }
                this._getArchitecture(previousArchitecture).removeMedia();
            }
        });
        this._peers.addEventListener('trackadded', track => {
            if(this._architecture === 'mesh') this._videoMixer.addStream(new MediaStream([track]), track.id);
        });
        this._sfu.addEventListener('trackadded', track => {
            if(this._architecture === 'sfu') this._videoMixer.addStream(new MediaStream([track]), track.id);
        });

    }

    _getArchitecture(name = null){
        if(name === null) name = this._architecture;
        const architectures = {mesh: this._peers, mcu: this._mcu, sfu: this._sfu};
        return architectures[name];
    }

    get out(){
        if(this._architecture === 'mcu'){
            return this._mcu.streams[0];
        }else{
            return new MediaStream([this._videoMixer.outputTrack, this._audioMixer.outputTrack]);
        }
    }

    async addWebcam(config = {video: true, audio: true}){
        this._stream = await window.navigator.mediaDevices.getUserMedia(config);
        this._getArchitecture().addMedia(this._stream);
    }

    displayOn(element){
        if(typeof element === 'string') element = document.querySelector(element);
        this._display = element;
        this._display.srcObject = this.out;
    }
};