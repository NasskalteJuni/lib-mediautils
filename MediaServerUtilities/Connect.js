const Listenable = require('./Listenable.js');
const ID = () => new Date().getTime().toString(32) + Math.random().toString(32).substr(2,7);
const timestamp = () => new Date().toISOString();

/**
 * Introduces an abstraction layer around the RTCPeerConnection.
 * It uses a predefined signalling mechanism, handles common problems (short-time state errors, race-conditions) and
 * comfort functions (like accepting media-streams and transforming them into tracks or transceivers)
 * */
class Connect extends Listenable() {

    constructor({id = ID(), peer = null, name = null, signaller, iceServers = [{"urls": "stun:stun1.l.google.com:19302"}], useUnifiedPlan = true, verbose = false, isYielding = () => false} = {}) {
        super();
        this._offering = false;
        this._ignoredOffer = false;
        this._signaller = signaller;
        this._connectionConfig = {iceServers, sdpSemantics: useUnifiedPlan ? 'unified-plan' : 'plan-b'};
        this._id = id;
        this._peer = peer || this._id;
        this._name = name;
        this._signaller.addEventListener('message', e => this._handleSignallingMessage(e.data));
        this._verbose = verbose;
        this._isYielding = isYielding;
        this._setupPeerConnection();
        this._receivedStreams = [];
        this._receivedTracks = [];
        this._addedTracks = [];
    }

    /**
     * @readonly
     * the id of the connection
     * */
    get id() {
        return this._id;
    }

    /**
     * @readonly
     * the peer id which is the other endpoint of the connection
     * */
    get peer() {
        return this._peer;
    }

    /**
     * is logging enabled?
     * */
    get verbose() {
        return this._verbose;
    }

    /**
     * enable / disable logging
     * */
    set verbose(makeVerbose) {
        this._verbose = !!makeVerbose;
    }


    _setupPeerConnection() {
        this._connection = new RTCPeerConnection(this._connectionConfig);
        this._connection.addEventListener('icecandidate', e => this._forwardIceCandidate(e.candidate));
        this._connection.addEventListener('negotiationneeded', () => {
            // avoid chrome triggering multiple negotiation needed events for multiple tracks that are added simultaneously
            if(this._isNegotiating) return;
            this._isNegotiating = true;
            this._initiateHandshake()
        });
        this._connection.addEventListener('signalingstatechange', () => this._isNegotiating = (this._connection.signalingState !== "stable"));
        this._connection.addEventListener('iceconnectionstatechange', () => this._detectDisconnection());
        this._connection.addEventListener('track', ({track, streams}) => this._handleIncomingTrack(track, streams));
        if (this._verbose) console.log('created new peer connection (' + this._id + ') using ' + (this._connectionConfig.sdpSemantics === 'unified-plan' ? 'the standard' : 'deprecated chrome plan b') + ' sdp semantics');
    }

    _announceCall(){

    }

    _handleIncomingTrack(track, streams) {
        const newStreams = [];
        this.dispatchEvent('trackadded', [track]);
        streams.forEach(stream => {
            if (this._receivedStreams.findIndex(s => s.id === stream.id) === -1) {
                this._receivedStreams.push(stream);
                newStreams.push(stream);
                this.dispatchEvent('streamadded', [stream]);
            }
        });
        this._receivedTracks.push(track);
        this.dispatchEvent('mediachanged', [{change: 'added', track, streams, peer: this._peer}]);
        track.addEventListener('ended', () => {
            this._receivedTracks = this._receivedTracks.filter(t => t.id !== track.id);
            this.dispatchEvent('mediachanged', [{change: 'removed', track, peer: this._peer}]);
            this.dispatchEvent('trackremoved', [track]);
            streams.forEach(stream => {
                if (stream.getTracks().filter(t => t.readyState !== "ended").length === 0) {
                    this._receivedStreams = this._receivedStreams.filter(s => s.id !== stream.id);
                    this.dispatchEvent('streamremoved', [stream]);
                }
            })
        });
        this.dispatchEvent('mediachanged', [{change: 'added', track, streams, newStreams, peer: this._peer}]);
    }

    _forwardIceCandidate(candidate) {
        if (candidate !== null) {
            const msg = JSON.stringify({
                receiver: this._peer,
                data: candidate,
                sent: timestamp(),
                type: 'ice'
            });
            this._signaller.send(msg);
        }
    }

    async _initiateHandshake() {
        // start a perfect negotiation offer-answer exchange
        try{
            this._offering = true;
            await this._connection.setLocalDescription();
            if (this._verbose) console.log('set local description on connection ' + this._id + ':', this._connection.localDescription);
            const msg = JSON.stringify({
                receiver: this._peer,
                data: this._connection.localDescription,
                type: 'sdp',
                sent: timestamp()
            });
            this._signaller.send(msg);
        }catch(err){
            console.error(err);
        }finally{
            this._offering = false;
        }
    }

    _handleSignallingMessage(msg) {
        // ignore empty messages, warn in verbose mode
        if (!msg) {
            if (this._verbose) console.log('received empty message, abort!');
            return;
        }
        msg = JSON.parse(msg);
        // when someone else sent the message, it is obviously of none interest to the connection between the peer and us
        if(msg.sender !== this._peer) return;
        if(this._name && msg.receiver !== '*' && msg.receiver !== this._name) console.warn('received message not ment for this peer');
        if (this._verbose) console.log(this._id + ' received message', msg);
        switch (msg.type) {
            case "sdp":
                this._handleSdp(msg.data);
                break;
            case "ice":
                this._handleRemoteIceCandidate(msg.data);
                break;
            case "connection:close":
                this._handleClosingConnection();
                break;
            default:
                if (this._verbose) console.log('no defined routine for message of type ' + msg.type);
        }
    }


    _handleClosingConnection() {
        this._receivedTracks.forEach(track => track.stop());
        this._connection.close();
        this.dispatchEvent('close');
    }

    async _handleRemoteIceCandidate(candidate) {
        if (candidate !== null) {
                if (this._verbose) console.log('adding ice candidate for ' + this._id + ':', candidate);
                let tries = 0;
                let maxTries = 10;
                const trySettingCandidate = setInterval(async () => {
                    try{
                        // try to add the ice candidate to the remote description.
                        // If there is no remote description, wait a very short time
                        if(this._connection.remoteDescription){
                            await this._connection.addIceCandidate(candidate);
                            clearInterval(trySettingCandidate);
                        }else{
                            tries++;
                        }
                        if(tries >= maxTries){
                            clearInterval(trySettingCandidate);
                            console.error('failed to add ice candidate, no offer on time');
                        }
                    }catch(err){
                        clearInterval(trySettingCandidate);
                        // if we ignored an offer due to glare, do not throw the error, only when the error has other reasons
                        if(!this._ignoredOffer) throw err;
                    }
                }, 100);
        }
    }

    async _handleSdp(description){
        try {
            const collision = this._connection.signalingState !== "stable" || this._offering;
            if (this._ignoredOffer = !this._isYielding(this._peer) && description.type === "offer" && collision) {
                return;
            }
            await this._connection.setRemoteDescription(description); // SRD rolls back as needed
            if (description.type === "offer") {
                await this._connection.setLocalDescription();
                this._signaller.send(JSON.stringify({type: 'sdp', receiver: this._peer, data: this._connection.localDescription, sent: timestamp()}));
            }
        } catch (err) {
            console.error(err);
        }
    }

    _addTrackToConnection(track, streams = []) {
        this._addedTracks.push(track);
        if (this._connection.signalingState === "stable" && !this._offering) {
            if (this._verbose) console.log('add track to connection ' + this._id, track);
            const config = {
                direction: "sendonly",
                streams
            };
            this._connection.addTransceiver(track, streams instanceof Array ? config : streams);
        } else {
            if (this._verbose) console.log('postpone adding media due to ongoing sdp handshake');
            const trackHandle = () => {
                if (this._connection.signalingState === "stable" && !this._offering){
                    this._addTrackToConnection(track, streams);
                    this._connection.removeEventListener('signalingstatechange', trackHandle);
                }
            };
            this._connection.addEventListener('signalingstatechange', trackHandle);
        }
    }

    _removeTrackFromConnection(track) {
        let removed = 0;
        const searchingTrackKind = typeof track === "string" && (track === "audio" || track === "video" || '*');
        const searchingActualTrack = track instanceof MediaStreamTrack;
        this._addedTracks = this._addedTracks.filter(tr => (searchingActualTrack && !tr.id !== track.id) || (searchingTrackKind && (tr.kind === track || track === '*')));
        this._connection.getTransceivers().forEach(transceiver => {
            // we obviously only remove our own tracks, therefore searching 'recvonly'-transceivers makes no sense
            if (transceiver.direction === "sendrecv" || transceiver.direction === "sendonly") {
                const tr = transceiver.sender.track;
                console.log(tr, track, 'searchingActualTrack'+searchingActualTrack, 'searchingTrackKind'+searchingTrackKind);
                if (tr && (searchingActualTrack && tr.id === track.id) || (searchingTrackKind && (tr.kind === track || track === '*'))) {
                    if (transceiver.direction === "sendrecv") transceiver.direction = "recvonly";
                    else transceiver.direction = "inactive";
                    // mute the given track, removing its content
                    transceiver.sender.replaceTrack(null);
                    removed++;
                }
            }
        });
        if (this._verbose) console.log('removed ' + removed + ' tracks from connection ' + this._id);
    }

    _replaceTrack(searchTrack, replacementTrack) {
        const searchingActualTrack = searchTrack instanceof MediaStreamTrack;
        const searchingTrackKind = typeof searchTrack === "string" && (track === "audio" || track === "video" || '*');
        const i = this._addedTracks.findIndex(tr => (searchingActualTrack && tr.id === searchTrack.id) || (searchingTrackKind && (tr.kind === searchTrack || searchTrack === '*')));
        if(i !== -1) this._addedTracks[i] = replacementTrack;
        this._connection.getTransceivers().forEach(transceiver => {
            // again, we only replace our own tracks, no need to look at 'recvonly'-transceivers
            if (transceiver.direction === "sendrecv" || transceiver.direction === "sendonly") {
                if (transceiver.sender.track && (searchingActualTrack && transceiver.sender.track.id === searchTrack.id) || (searchingTrackKind && transceiver.sender.track.kind === searchTrack)) {
                    transceiver.sender.replaceTrack(replacementTrack);
                }
            }
        })
    }

    _detectDisconnection() {
        // if the other side is away, close down the connection
        if (this._connection.iceConnectionState === "disconnected"){
            this._connection.close();
            this.dispatchEvent('close');
        }
        // if the connection failed, restart the ice gathering process according to the spec, will lead to negotiationneeded event
        if(this._connection.iceConnectionState === "failed"){
            this._connection.restartIce();
        }
    }

    /**
     * Is the connection closed or still open
     * */
    get closed() {
        return this._connection.connectionState === "closed" || this._connection.signalingState === "closed";
    }

    /**
     * add media to the connection
     * @param trackOrKind [MediaStreamTrack|string] a track or its kind
     * @param streamsOrTransceiverConfig [Array|RTPTransceiverConfig]
     * */
    /**
     * add media to the connection
     * @param media [MediaStream|MediaStreamTrack|MediaStreamConstraints] a MediaStream, which tracks will be added, a single MediaStreamTrack, which will be added or the MediaStreamConstraints, which will be used to retrieve the local MediaStreamTracks
     * */
    async addMedia(media) {
        if (arguments.length === 2) {
            this._addTrackToConnection(arguments[0], arguments[1]);
        } else {
            if (media instanceof MediaStream) {
                media.getTracks().forEach(track => this._addTrackToConnection(track, [media]));
            } else if (media instanceof MediaStreamTrack) {
                this._addTrackToConnection(track, [new MediaStream([track])]);
            } else if (media instanceof Object && (media.audio || media.video)) {
                const stream = await navigator.mediaDevices.getUserMedia(media);
                stream.getTracks().forEach(track => this._addTrackToConnection(track, [stream]))
            } else {
                console.error('unknown media type');
            }
        }
    }
    /**
     * removes the given media from the connection
     * @param media [MediaStream|MediaStreamTrack|MediaStreamTrackKind|undefined]
     * allows to resume all media from the given stream or stream description ("audio" removing all tracks of kind audio, no argument or '*' removing all media)
     * */
    removeMedia(media) {
        if (media instanceof MediaStream) {
            media.getTracks().forEach(track => this._removeTrackFromConnection(track));
        } else if (media instanceof MediaStreamTrack) {
            this._removeTrackFromConnection(track);
        } else if (typeof media === "string" && (media === "audio" || media === "video")) {
            this._removeTrackFromConnection(media);
        } else if(typeof media === undefined || (typeof media === "string" && media === "*")){
            this._removeTrackFromConnection("*");
        } else {
            console.error('unknown media type');
        }
    }

    /**
     * @readonly
     * All received tracks of the given connection
     * */
    get tracks() {
        return this._receivedTracks;
    }

    /**
     * @readonly
     * All received streams of the given connection
     * */
    get streams() {
        return this._receivedStreams;
    }

    /**
     * @readonly
     * all locally added tracks of the given connection
     * */
    get addedTracks(){
        return this._addedTracks;
    }

    /**
     * close the connection
     * */
    close() {
        const msg = JSON.stringify({
            receiver: this._peer,
            data: 'immediately',
            type: 'connection:close',
            sent: timestamp()
        });
        this._signaller.send(msg);
        this._connection.close();
        this.dispatchEvent('close');
    }

}

module.exports = Connect;