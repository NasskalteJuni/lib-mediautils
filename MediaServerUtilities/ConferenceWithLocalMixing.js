const ConnectionManager = require('./ConnectionManager.js');
const Connection = require('./ConnectionWithSignaledLock.js');
const VideoMixer = require('./VideoMixer.js');
const AudioMixer = require('./AudioMixer.js');
const Listenable = require('./Listenable.js');
const SpeakerConfig = require('./VideoMixingConfigurations/Speaker.js');
const SpeechDetection = require('./SpeechDetection.js');
const Architecture = require('./_Architecture.js');

/**
 * Utility to transmit your media to other conference members using a specified architecture
 * @class
 * */
class ConferenceWithLocalMixing extends Listenable(){

    /**
     * create a new conference that exchanges your media streams with other conference members using multiple architectures,
     * like the simple peer to peer model 'mesh' or the architecture 'mcu', that uses a media server to mix streams
     * @param {Object} config
     * @param {String} config.name your username in the conference
     * @param {Signaler} config.signaler The signaler to use to communicate the necessary data to transmit media between the conference members
     * @param {String} [config.architecture='mesh'] The architecture (name) to start with. Defaults to the purely peer to peer based mesh model
     * @param {Object} [config.video={width:640, height:480}] The video size to preferably use
     * @param {Array} [config.iceServers=[]] The ice servers to use, in the common RTCIceServer-format
     * @param {Console} [config.logger=console] The logger to use. Anything with .log() and .error() method should work. Defaults to the browser console
     * @param {Boolean} [config.verbose=false] If you want to log (all) information or not
     * */
    constructor({name, signaler, architecture= 'mesh', iceServers = [], video = {width: 640, height: 480}, verbose = false, logger = console}){
        super();
        this._name = name;
        this._signaler = signaler;
        this._verbose = verbose;
        this._logger = logger;
        this._peers = new ConnectionManager({signaler, name, iceServers, verbose, logger});
        this._sfu = new Connection({signaler, name, iceServers, peer: '@sfu', isYielding: false, verbose, logger});
        this._mcu = new Connection({signaler, name, iceServers, peer: '@mcu', isYielding: false, verbose, logger});
        this._speechDetection = new SpeechDetection({threshold: 65});
        this._videoMixer = new VideoMixer(video);
        this._videoMixer.addConfig(new SpeakerConfig(this._speechDetection), 'speaker');
        this._audioMixer = new AudioMixer();
        this._architecture = new Architecture(architecture);
        this._addedMedia = [];
        this._display = null;
        signaler.addEventListener('message', message => {
            if(message.type === 'architecture:switch'){
                this._handleArchitectureSwitch(message.data);
            }
        });
        this._peers.addEventListener('trackadded', (track, user) => {
            if(this._architecture.value === 'mesh'){
                if(track.kind === "video"){
                    this._videoMixer.addMedia(track, 'peers-'+user);
                }else if(track.kind === "audio"){
                    this._speechDetection.addMedia(track, 'peers-'+user);
                    this._audioMixer.addMedia(track, 'peers-'+user);
                }
                this.dispatchEvent('trackadded', [track, user]);
                this.dispatchEvent('mediachanged', []);
            }
        });
        this._sfu.addEventListener('trackadded', track => {
            if(this._architecture.value === 'sfu'){
                const addTrack = track => {
                    console.log('adding track', track, 'for', track.meta);
                    if(track.kind === "video"){
                        this._videoMixer.addMedia(track, 'sfu-'+track.meta);
                    }else if(track.kind === "audio"){
                        this._speechDetection.addMedia(track, 'sfu-'+track.meta);
                        this._audioMixer.addMedia(track, 'sfu-'+track.meta);
                    }
                    this.dispatchEvent('trackadded', [track, track.meta]);
                    this.dispatchEvent('mediachanged', []);
                };
                if(track.meta) addTrack(track);
                else track.addEventListener('metachanged', () => addTrack(track, track.meta));
            }
        });
        this._mcu.addEventListener('trackadded', () => {
            this._updateDisplayedStream();
        });
        this._peers.addEventListener('userconnected', user => this._handleUserConnected(user));
        this._peers.addEventListener('userdisconnected', user => this._handleUserDisconnected(user));
        this._peers.addEventListener('connectionclosed', user => {
            if(this._architecture.value === 'mesh'){
                this._videoMixer.removeMedia('peers-'+user);
                this._audioMixer.removeMedia('peers-'+user);
                this._speechDetection.removeMedia('peers-'+user);
                this._updateDisplayedStream();
            }
        });
        this.addEventListener('mediachanged', () => this._updateDisplayedStream())
    }

    /**
     * the name of the architecture currently used
     * @readonly
     * */
    get architecture(){
        return this._architecture.value;
    }

    /**
     * the current conference members
     * @readonly
     * */
    get members(){
        return this._peers.users;
    }

    /**
     * get the current or specified architecture connection(s)
     * @private
     * */
    _getArchitectureHandler(name = null){
        if(name === null) name = this._architecture.value;
        const architectures = {mesh: this._peers, mcu: this._mcu, sfu: this._sfu};
        return architectures[name];
    }

    /**
     * when notified to switch to another architecture, use the next architecture model to transmit and receive media and display it
     * @private
     * */
    _handleArchitectureSwitch(newArchitecture){
        const previousArchitecture = this._architecture.value;
        this._architecture.value = newArchitecture;
        this._addedMedia.forEach(m => this._getArchitectureHandler(newArchitecture).addMedia(m));
        if(newArchitecture === 'mesh'){
            this._clearLocalMediaProcessors();
            // TODO: make this more standardized by using it like sfu or mcu, maybe via track.meta
            this._getArchitectureHandler('mesh').users.forEach(user => {
                this._getArchitectureHandler('mesh').get(user).tracks.forEach(track => {
                    this._addTrackToLocalMediaProcessors(track, user)
                });
            });
            this._addedMedia.forEach(m => this._addLocalMediaToLocalMediaProcessors(m));
        }else if(newArchitecture === 'sfu'){
            this._clearLocalMediaProcessors();
            this._getArchitectureHandler('sfu').tracks.forEach(track => {
                this._addTrackToLocalMediaProcessors(track, track.meta);
            });
            this._addedMedia.forEach(m => this._addLocalMediaToLocalMediaProcessors(m));
        }else if(newArchitecture === 'mcu'){
            this.dispatchEvent('mediachanged', []);
        }
        this._updateDisplayedStream();
        this._getArchitectureHandler(previousArchitecture).removeMedia();
        this.dispatchEvent('architectureswitched', [newArchitecture, previousArchitecture]);
    }


    /**
     * @private
     * */
    _handleUserConnected(user){
        this.dispatchEvent('userconnected', [user]);
        // mcu or sfu take care of automatic forwarding, but mesh needs to add media itself
        if(this._architecture.value === 'mesh'){
            this._addedMedia.forEach(m => this._getArchitectureHandler('mesh').get(user).addMedia(m));
        }
    }

    /**
     * @private
     * */
    _handleUserDisconnected(user){
        this.dispatchEvent('userdisconnected', [user]);
        if(this._architecture.value === 'mesh'){
            if(this._getArchitectureHandler('mesh').get(user)) this._getArchitectureHandler('mesh').get(user).close();
        }
    }

    /**
     * switches the used architecture to the given one
     * @param {String} [name=nextArchitectureValue] the architecture to switch to
     * */
    switchArchitecture(name=undefined){
        if(name === undefined) name = this._architecture.nextValue();
        if(this._verbose) this._logger.log('request switching to architecture', name);
        let msg = {type: 'architecture:switch', receiver: '@server', data: name};
        this._signaler.send(msg);
    }

    /**
     * switches to the architecture that comes after the current architecture in the order of architectures (standard: mesh -> sfu -> mcu -> mesh)
     * */
    nextArchitecture(){
        this.switchArchitecture(this._architecture.nextValue());
    }

    /**
     * the architecture that is used after the current architecture
     * @returns {String} the architecture name
     * */
    get nextArchitectureValue(){
        return this._architecture.nextValue();
    }

    /**
     * switches to the architecture that is before the current one in the order of architectures to use (standard: mesh -> sfu -> mcu -> mesh)
     * */
    previousArchitecture(){
        this.switchArchitecture(this._architecture.prevValue());
    }

    /**
     * the architecture that is used before the current architecture
     * @returns {String} the architecture name
     * */
    get prevArchitectureValue(){
        return this._architecture.prevValue();
    }

    /**
     * @private
     * */
    _clearLocalMediaProcessors(){
        this._videoMixer.removeMedia();
        this._speechDetection.removeMedia();
        this._audioMixer.removeMedia();
    }

    /**
     * @private
     * */
    _addTrackToLocalMediaProcessors(track, id){
        if(track.kind === "video"){
            this._videoMixer.addMedia(track, id)
        }else{
            this._audioMixer.addMedia(track, id);
            this._speechDetection.addMedia(track, id)
        }
    }

    /**
     * The stream of the conference
     * @returns MediaStream The mixed & ready stream to display
     * */
    get out(){
        if(this._architecture.value === 'mcu'){
            return this._mcu.streams[0];
        }else{
            return new MediaStream([this._videoMixer.outputTrack, this._audioMixer.outputTrack]);
        }
    }

    /**
     * activates your webcam and adds the stream to the connection
     * @param {Object} [config={video:true, audio:true}] the webcam configuration to use
     * */
    async addWebcam(config = {video: true, audio: true}){
        const stream = await window.navigator.mediaDevices.getUserMedia(config);
        this.addMedia(stream);
    }

    /**
     * mutes (or unmutes) added media
     * @param {String|MediaStream|MediaStreamTrack} m The media to mute. Defaults to all media "*" but can be any stream, track or media kind ("video", "audio" or "*")
     * @param {Boolean} [mute=true] a flag which indicates if you want to mute media, or unmute muted media. Muting muted or unmuting not muted Media has no effect.
     * */
    muteMedia(m="*", mute=true){
        this._getArchitectureHandler().muteMedia(m, mute);
    }

    /**
     * add media to the connection
     * @param {MediaStream|MediaStreamTrack} m The media to add. This can be a stream or a single track
     * */
    async addMedia(m){
        if(!m.meta) m.meta = this._name;
        this._getArchitectureHandler().addMedia(m);
        this._addLocalMediaToLocalMediaProcessors(m);
        this._addedMedia.push(m);
        this._updateDisplayedStream();
    }

    /**
     * remove media from the conference
     * @param {String|MediaStream|MediaStreamTrack} [m="*"] the media to remove. Can be a media type like audio, video or "*" for all, a track or a stream
     * */
    removeMedia(m = "*"){
        if(m instanceof MediaStream){
            m.getTracks().forEach(track => {
                this._getArchitectureHandler().removeMedia(track);
                this._removeLocalMediaFromLocalMediaProcessors(m);
            })
        }else if(m instanceof MediaStreamTrack){
            this._getArchitectureHandler().removeMedia(m);
            this._removeLocalMediaFromLocalMediaProcessors(m)
        }else if(typeof m === "string" && ["video", "audio", "*"].indexOf(m.toLowerCase()) >= 0){
            m = m.toLowerCase();
            this._getArchitectureHandler().removeMedia(m);
            this._removeLocalMediaFromLocalMediaProcessors(m);
        }else{
            console.log('unknown media type', m)
        }
        this._addedMedia = this._addedMedia.filter(added => {
            if(typeof m === "string"){
                m = m.toLocaleLowerCase();
                if(added instanceof MediaStreamTrack){
                    return added.kind !== m || m !== "*"
                }else if(added instanceof MediaStream){
                    added.getTracks().filter(track => track.kind !== m || m !== "*").forEach(track => added.removeTrack(track))
                    return added.getTracks().length > 0
                }
            }else if(m instanceof MediaStream){
                if(added instanceof MediaStream){
                    return added.id !== m.id;
                }else if(added instanceof MediaStreamTrack){
                    return m.getTracks().findIndex(track => track.id === added.id) === -1;
                }
            }else if(m instanceof MediaStreamTrack){
                if(added instanceof MediaStream){
                    added.getTracks().forEach(track => {
                        if(track.id === m.id) added.removeTrack(track);
                    });
                    return added.getTracks().length > 0;
                }else if(added instanceof MediaStreamTrack){
                    return m.id !== added.id;
                }
            }
        });
    }

    /**
     * @private
     * */
    _addLocalMediaToLocalMediaProcessors(m){
        if(this._architecture.value !== 'mcu'){
            this._speechDetection.addMedia(m, this._name);
            this._videoMixer.addMedia(m, this._name);
        }
    }

    /**
     * @private
     * */
    _removeLocalMediaFromLocalMediaProcessors(m){
        if(m instanceof MediaStream){
            m.getTracks().forEach(track => {
                if(track.kind === "video"){
                    this._videoMixer.removeMedia(track)
                }else{
                    this._audioMixer.removeMedia(track);
                    this._speechDetection.removeMedia(track);
                }
            })
        }else if(typeof m === "string" && ["video", "audio", "*"].indexOf(m.toLowerCase()) >= 0){
            m = m.toLowerCase();
            this._getArchitectureHandler().removeMedia(m);
            if(m === "*" || m === "video") {
                this._videoMixer.removeMedia();
            }
            if(m === "*" || m === "audio") {
                this._audioMixer.removeMedia();
                this._speechDetection.removeMedia()
            }
        }
    }


    /**
     * define a container element that contains the video in which the conference should be displayed on
     * @param {Node|String} element the element to use as a container. Can be a div (or similar) or a query selector string to find one
     * @return {Node} the video element created to display the mixed content
     * */
    displayOn(element){
        if(typeof element === 'string') element = document.querySelector(element);
        element.innerHTML = "";
        this._display = document.createElement("video");
        this._display.autoplay = true;
        this._display.style.width = "100%";
        this._display.style.height = "100%";
        element.appendChild(this._display);
        if(this._verbose) this._logger.log('display output inside', element);
        this._updateDisplayedStream();
        return this._display;
    }

    /**
     * @private
     * */
    _updateDisplayedStream(){
        if(this._display){
            if(this._verbose) this._logger.log('updated display');
            this._display.srcObject = this.out;
        }
    }

    /**
     * Get the number of media objects that you added. This is not equal to the number of MediaStreamTracks, since added MediaStreams also count just as one
     * @return Number the number of media added
     * */
    get numberOfAddedMedia(){
        return this._addedMedia.length;
    }

    /**
     * Get the number of added MediaStreamTracks to the connection
     * @return Number the number of tracks added (as tracks only or as part of a stream)
     * */
    get addedTracks(){
       return this.addedMedia.reduce((count, m) => m instanceof MediaStream ? count+m.getTracks().length : count+1, 0);
    }

    /**
     * Close down any connections of any used architecture
     * */
    close(){
        [this._peers, this._sfu, this._mcu].forEach(architecture => architecture.close());
        this._addedMedia = [];
    }

    /**
     * A conference is closed if at least one connection in use is closed
     * @readonly
     * */
    get closed(){
        return [this._peers, this._sfu, this._mcu].reduce((isClosed, architecture) =>architecture.closed || isClosed, false)
    }

};

module.exports = ConferenceWithLocalMixing;