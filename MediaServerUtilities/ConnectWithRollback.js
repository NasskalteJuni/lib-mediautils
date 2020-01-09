const Listenable = require('./Listenable.js');
const ID = () => new Date().getTime().toString(32) + Math.random().toString(32).substr(2,7);
const timestamp = () => new Date().toISOString();

/**
 * Introduces an abstraction layer around the RTCPeerConnection.
 * It uses a predefined signalling mechanism, handles common problems (short-time state errors, race-conditions) and
 * comfort functions (like accepting media-streams and transforming them into tracks or transceivers)
 * */
class Connect extends Listenable() {

    constructor({id = ID(), peer = null, name = null, signaller, iceServers = [{"urls": "stun:stun1.l.google.com:19302"}], useUnifiedPlan = true, verbose = false, isYielding = undefined} = {}) {
        super();
        this._signaller = signaller;
        this._connectionConfig = {iceServers, sdpSemantics: useUnifiedPlan ? 'unified-plan' : 'plan-b'};
        this._id = id;
        this._peer = peer || this._id;
        this._name = name;
        this._signaller.addEventListener('message', e => this._handleSignallingMessage(e.data));
        this._verbose = verbose;
        this._isYielding = isYielding === undefined ? (this._name ? this._name.localeCompare(this._peer) > 0 : false) : isYielding;
        this._offering = false;
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
        this.addEventListener('negotiationneeded', () => this._startHandshake());
        this._connection.addEventListener('iceconnectionstatechange', () => this._handleIceChange());
        this._connection.addEventListener('track', ({track, streams}) => this._handleIncomingTrack(track, streams));
        if (this._verbose) console.log('created new peer connection (' + this._id + ') using ' + (this._connectionConfig.sdpSemantics === 'unified-plan' ? 'the standard' : 'deprecated chrome plan b') + ' sdp semantics');
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
                if (!stream.active) {
                    this._receivedStreams = this._receivedStreams.filter(s => s.id !== stream.id);
                    this.dispatchEvent('streamremoved', [stream]);
                }
            })
        });
        this.dispatchEvent('mediachanged', [{change: 'added', track, streams, newStreams, peer: this._peer}]);
    }

    _forwardIceCandidate(candidate) {
        if (candidate !== null) {
            this._signaller.send(JSON.stringify({
                receiver: this._peer,
                data: candidate,
                sent: timestamp(),
                type: 'ice'
            }));
        }
    }

    async _handleSignallingMessage(msg) {
        msg = JSON.parse(msg);
        // when someone else sent the message, it is obviously of none interest to the connection between the peer and us
        if(msg.sender !== this._peer) return;
        const type = msg.type.toLowerCase();
        if(type === 'sdp'){
            await this._handleSdp(msg.data);
        }else if(type === 'ice'){
            await this._handleRemoteIceCandidate(msg.data)
        }else if(type === 'connection:close'){
            await this._handleClosingConnection();
        }else if(type === 'receiver:stop'){
            await this._stopReceiver(msg.data)
        }else{
            if(this._verbose) console.log('could not find handle for msg type',type,msg);
        }

    }

    async _startHandshake(){
        try{
            this._offering = true;
            const offer = await this._connection.createOffer();
            if(this._connection.signalingState !== "stable") return;
            if (this._verbose) console.log('set local description on connection ' + this._id + ':', this._connection.localDescription);
            await this._connection.setLocalDescription(offer);
            const msg = JSON.stringify({
                receiver: this._peer,
                data: offer,
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

    async _handleRemoteIceCandidate(candidate) {
        if (candidate !== null) await this._connection.addIceCandidate(candidate);
    }

    async _handleSdp(description){
        if(this._verbose) console.log('received sdp', description);
        try {
            const collision = this._connection.signalingState !== "stable" || this._offering;
            if(collision && this._verbose) console.log("collision");
            if (this._ignoredOffer = !this._isYielding && description.type === "offer" && collision) {
                if(this._verbose) console.log(this._id+' for '+this._peer+' ignored offer due to glare');
                return;
            } else if (collision && description.type === "offer"){
                if(this._verbose) console.log(this._id+' for '+this._peer+' handles glare by yielding');
                await Promise.all([
                    this._connection.setLocalDescription({type: "rollback"}),
                    this._connection.setRemoteDescription(description)
                ]);
            }else{
                await this._connection.setRemoteDescription(description);
            }
            if (description.type === "offer") {
                await this._connection.setLocalDescription(await this._connection.createAnswer());
                this._signaller.send(JSON.stringify({type: 'sdp', receiver: this._peer, data: this._connection.localDescription, sent: timestamp()}));
            }
        } catch (err) {
            console.error(err);
        }
    }


    _addTrackToConnection(track, streams = []) {
        this._addedTracks.push(track);
        if (this._verbose) console.log('add track to connection ' + this._id, track);
        const config = {
            direction: "sendonly",
            streams
        };
        this._connection.addTransceiver(track, streams instanceof Array ? config : streams);
    }

    /**
     * @private
     * remove a transceiver for a track to a connection
     * Does not handle invalid or any kind of input, only the specified
     * track [MediaStreamTrack|string] the track or trackKind (a string equal to "video", "audio" or "*", case sensitive)
     * */
    _removeTrackFromConnection(track) {
        let removed = 0;
        const searchingTrackKind = typeof track === "string";
        const searchingActualTrack = track instanceof MediaStreamTrack;
        if(searchingActualTrack) this._addedTracks = this._addedTracks.filter(tr => tr.id !== track.id);
        else this._addedTracks = this._addedTracks.filter(tr => track !== '*' && tr.kind !== track);
        this._connection.getTransceivers().forEach(transceiver => {
            // we obviously only remove our own tracks, therefore searching 'recvonly'-transceivers makes no sense
            if (transceiver.direction === "sendrecv" || transceiver.direction === "sendonly") {
                const tr = transceiver.sender.track;
                if (tr && (searchingActualTrack && tr.id === track.id) || (searchingTrackKind && (tr.kind === track || track === '*'))) {
                    // mute the given track, removing its content
                    this._connection.removeTrack(transceiver.sender);
                    if (transceiver.direction === "sendrecv") transceiver.direction = "recvonly";
                    else transceiver.direction = "inactive";
                    this._signaller.send(JSON.stringify({
                        receiver: this._peer,
                        type: 'receiver:stop',
                        data: transceiver.mid,
                        sent: timestamp()
                    }));
                    removed++;
                }
            }
        });
        if (this._verbose) console.log('removed ' + removed + ' tracks from connection ' + this._id);
    }

    _stopReceiver(mid){
        this._connection.getTransceivers().filter(tr => tr.mid === mid).map(tr => tr.receiver.track).forEach(track=> {
            track.stop();
            // we have to stop the track, since Chrome misses the transceiver.stop() implementation,
            // but calling stop will not fire the ended event, so we have to fire it instead...
            track.dispatchEvent(new Event('ended'));
        });
    }

    _replaceTrack(searchTrack, replacementTrack) {
        const searchingActualTrack = searchTrack instanceof MediaStreamTrack;
        const searchingTrackKind = typeof searchTrack === "string" && (track === "audio" || track === "video" || track === '*');
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


    _muteTrack(track, muted=true){
        const searchingActualTrack = track instanceof MediaStreamTrack;
        const searchingTrackKind = typeof track === "string" && (['audio', 'video', '*'].indexOf(track) >= 0);
        this._connection.getTransceivers().forEach(transceiver => {
            if((searchingActualTrack && transceiver.sender.track.id === track.id) || (searchingTrackKind && (track === '*' || transceiver.sender.track.kind === track))){
                if(muted){
                    if(!transceiver.sender._muted){
                        transceiver.sender._muted = transceiver.sender.track;
                        transceiver.sender.replace(null)
                    }
                }else{
                    if(transceiver.sender._muted){
                        transceiver.sender.replace(transceiver.sender._muted);
                        delete transceiver.sender['_muted'];
                    }
                }
            }
        });
    }


    _handleIceChange() {
        // if the other side is away, close down the connection
        if (this._connection.iceConnectionState === "disconnected"){
            this._connection.close();
            this.dispatchEvent('close', []);
        }
        // if the connection failed, restart the ice gathering process according to the spec, will lead to negotiationneeded event
        if(this._connection.iceConnectionState === "failed"){
            this._connection.restartIce();
        }
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
            } else if (typeof media === "string" && ["audio", "video", "*"].indexOf(media) >= 0) {
                this._addTrackToConnection(media, new MediaStream([]));
            } else if (media instanceof Object && (media.audio || media.video)) {
                const stream = await navigator.mediaDevices.getUserMedia(media);
                stream.getTracks().forEach(track => this._addTrackToConnection(track, [stream]))
            } else {
                console.error('unknown media type', typeof media, media);
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
        } else if ((media instanceof MediaStreamTrack) || (typeof media === "string" && ["audio", "video", "*"].indexOf(media) >= 0)) {
            this._removeTrackFromConnection(media);
        } else if(typeof media === undefined || arguments.length === 0 || (typeof media === "string" && media === "*")){
            this._removeTrackFromConnection("*");
        } else {
            console.error('unknown media type', typeof media, media);
        }
    }

    /**
     * @readonly
     * All non-muted received tracks of the given connection
     * */
    get tracks() {
        return this._receivedTracks;
    }

    /**
     * @readonly
     * All active received streams of the given connection
     * */
    get streams() {
        return this._receivedStreams.filter(stream => stream.active);
    }

    /**
     * @readonly
     * all locally added tracks of the given connection
     * */
    get addedTracks(){
        return this._addedTracks;
    }


    _handleClosingConnection() {
        if(this._verbose) console.log('connection closing down');
        this._receivedTracks.forEach(track => track.stop());
        this._connection.close();
        this.dispatchEvent('close');
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

    /**
     * Is the connection closed or still open
     * */
    get closed() {
        return this._connection.connectionState === "closed" || this._connection.signalingState === "closed";
    }

}

module.exports = Connect;