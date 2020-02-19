const ConnectionManager = require('./ConnectionManager.js');
const Connection = require('./ConnectionWithRollback.js');
const VideoMixer = require('./VideoMixer.js');
const AudioMixer = require('./AudioMixer.js');
const Listenable = require('./Listenable.js');
const SpeakerConfig = require('./VideoMixingConfigurations/Speaker.js');
const SpeechDetection = require('./SpeechDetection.js');

module.exports = class Conference extends Listenable(){

    constructor({name, signaler, verbose = false, logger = console, architecture= 'mesh', video = {width: 420, height: 360}}){
        super();
        this._signaler = signaler;
        this._peers = new ConnectionManager({signaler, name, verbose, logger});
        this._sfu = new Connection({signaler, name, peer: '@server', verbose, logger});
        this._mcu = new Connection({signaler, name, peer: '@server', verbose, logger});
        this._speechDetection = new SpeechDetection({threshold: 65});
        this._videoMixer = new VideoMixer();
        this._videoMixer.addConfig(new SpeakerConfig(this._speechDetection), 'speaker');
        this._audioMixer = new AudioMixer(video);
        this._architecture = architecture;
        this._stream = null;
        this._display = null;
        signaler.addEventListener('message', e => {
            const message = e.data;
            if(message.type === 'architecture:switch'){
                const previousArchitecture = this._architecture;
                this._architecture = message.data;
                if(this._stream){
                    this._getArchitectureHandler(this._architecture).addMedia(this._stream);
                }
                if(this._display){
                    this._display.srcObject = this.out;
                }
                this._getArchitectureHandler(previousArchitecture).removeMedia();
                this.dispatchEvent('architectureswitched', [architecture, previousArchitecture]);
            }
        });
        this._peers.addEventListener('trackadded', track => {
            if(this._architecture === 'mesh'){
                this._videoMixer.addStream(track, 'peers-'+track.id);
                if(track.kind === "audio") this._speechDetection.addStream(track, 'peers-'+track.id);
            }
        });
        this._sfu.addEventListener('trackadded', track => {
            if(this._architecture === 'sfu'){
                this._videoMixer.addStream(track, 'sfu-'+track.id);
                if(track.kind === "audio") this._speechDetection.addStream(track, 'sfu-'+track.id);
            }
        });
        this._peers.addEventListener('userconnected', user => this.dispatchEvent('userconnected', [user]));
        this._peers.addEventListener('userdisconnected', user => this.dispatchEvent('userdisconnected', [user]));
    }

    get architecture(){
        return this._architecture;
    }

    get members(){
        return this._peers.users;
    }

    _getArchitectureHandler(name = null){
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
        this._getArchitectureHandler().addMedia(this._stream);
        this._speechDetection.addStream(this._getArchitectureHandler().addedTracks().filter(tr => tr.kind === 'audio'));
    }

    async addMedia(m){
        this._getArchitectureHandler().addMedia(m);
        this._speechDetection.addStream(this._getArchitectureHandler().addedTracks().filter(tr => tr.kind === 'audio'));
    }

    displayOn(element){
        if(typeof element === 'string') element = document.querySelector(element);
        this._display = element;
        this._display.srcObject = this.out;
        if(display.paused) display.play();
    }
};