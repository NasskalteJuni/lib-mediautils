class ConnectionManager{

    static get MODES(){
        return Object.freeze({
            "AUTO_CREATE_CONNECTIONS": "AUTO_CREATE_CONNECTIONS",
            "ALLOW_AUTO_CREATED_CONNECTIONS": "ALLOW_AUTO_CREATED_CONNECTIONS",
            "NO_AUTO_CREATED_CONNECTIONS": "NO_AUTO_CREATED_CONNECTIONS"
        });
    }

    /**
     * create a new peer connection manager who handles everything related to transmitting media via RTCPeerConnections
     * */
    constructor({iceServers = [{"urls": "stun:stun1.l.google.com:19302"}], useUnifiedPlan = true, mode=ConnectionManager.MODES.ALLOW_AUTO_CREATED_CONNECTIONS, yielding=true} = {}){
        this.peerConnections = {};
        this.mode = mode;
        this.yielding = yielding;
        this.iceServers = iceServers;
        this.useUnifiedPlan = useUnifiedPlan;
        this._onIceCandidate = () => {throw new Error('MISSING ICE CANDIDATE HANDLER')};
        this._onOffer = () => {throw new Error('MISSING OFFER HANDLER')};
        this._onTrack = () => {throw new Error('MISSING TRACK HANDLER')};
    }

    /**
     * @readonly
     * the ids of the registered / known users as a list
     * */
    get users(){
        return Object.keys(this.peerConnections);
    }

    /**
     * Get or create a peer connection for the given user.
     * There is always only 1 peer connection per user,
     * if there is none when this method is called, a new one will be created.
     * All relevant handlers will already be bound to the returned peer connection object
     * and the life cycle of it will be also handled by this class, do not try to remove connections manually
     * This will not be done, when the mode is set to NO_AUTO_CONNECTIONS, in this case, only already existing connections are returned
     * @param userId [string] for which user a peer connection will be returned
     * @return RTCPeerConnection
     * */
    getPeerConnection(userId){
        if(!this.peerConnections[userId]){
            if(this.mode === ConnectionManager.MODES.NO_AUTO_CREATED_CONNECTIONS){
                console.warn('no connection for this user - no new connection created due to mode');
                return null;
            }
            this._generateNewPeerConnection(userId);
        }
        return this.peerConnections[userId];
    }

    /**
     * create a new connection for the given user. Do not use this when the mode is set to AUTO_CREATE_CONNECTIONS
     * @param userId [string] the id of the user that will reference the connection in further actions
     * @return [RTCPeerConnection] the created peer connection for that user
     * */
    createPeerConnection(userId){
        if(this.mode === ConnectionManager.MODES.AUTO_CREATE_CONNECTIONS){
            console.warn('did not create a connection - mode implies that no new connections should be created manually')
            return null;
        }
        return this._generateNewPeerConnection(userId)
    }

    /**
     * @private
     * generate a new peer connection and register necessary handlers
     * */
    _generateNewPeerConnection(userId){
        const rtcConfiguration = {sdpSemantics:  this.useUnifiedPlan ? 'unified-plan' : 'plan-b', iceServers: this.iceServers};
        this.peerConnections[userId] = new RTCPeerConnection(rtcConfiguration);
        this.peerConnections[userId].addEventListener('icecandidate', e => this._handleIceCandidate(userId, e.candidate));
        this.peerConnections[userId].addEventListener('negotiationneeded', () => this._initiateOfferHandshake(userId));
        this.peerConnections[userId].addEventListener('track', e => this._handleTrack(userId, e.track, e.streams));
        this.peerConnections[userId].addEventListener('connectionstatechange', () => this._checkClosed(userId));
        this.peerConnections[userId].addEventListener('iceconnectionstatechange', () => this._disconnectDetection(userId));
        this.peerConnections[userId].addEventListener('signalingstatechange', () => this._checkClosed(userId));
        if(this._onNewPeerConnection) this._onNewPeerConnection(userId, this.peerConnections[userId]);
        return this.peerConnections[userId];
    }


    /**
     * returns all currently active video tracks
     * @param userId [string=null] the user or null for every user
     * @return list all video tracks
     * */
    getAllVideoTracks(userId=null){
        const getVideoTracks = pc => pc.getTransceivers()
            .filter(t => t.direction === "sendrecv" || t.direction === "recvonly")
            .map(t => t.receiver.track)
            .filter(t => t.readyState !== "ended" && t.kind === "video");
        return userId === null ? Object.values(this.peerConnections).reduce((tracks, c) => tracks.concat(getVideoTracks(c)),[]) : getVideoTracks(this.getPeerConnection(userId));
    }

    /**
     * returns all currently active audio tracks
     * @param userId [string=null] the user or null for every audio track
     * @return list all audio tracks
     * */
    getAllAudioTracks(userId=null){
        const getAudioTracks = pc => pc.getTransceivers()
            .filter(t => t.direction === "sendrecv" || t.direction === "recvonly")
            .map(t => t.receiver.track)
            .filter(t => t.readyState !== "ended" && t.kind === "audio");
        return userId === null ? Object.values(this.peerConnections).reduce((tracks, c) => tracks.concat(getAudioTracks(c)),[]) : getAudioTracks(this.getPeerConnection(userId));
    }

    /**
     * returns all currently active video tracks except the ones belonging to the user with the given userId
     * @param userId [string] the user to exclude
     * @return [array] list all video tracks except the ones of the given user
     * */
    getVideoTracksExceptUser(userId){
        const users = this.users.filter(u => userId !== u);
        return users.reduce((tracks, u) => tracks.concat(this.getAllVideoTracks(u)), []);
    }

    /**
     * returns all currently active video tracks except the ones belonging to the user with the given userId
     * @param userId [string] the user to exclude
     * @return [array] list all video tracks except the ones of the given user
     * */
    getAudioTracksExceptUser(userId){
        return this.users.filter(u => userId !== u).reduce((tracks, u) => tracks.concat(this.getAllAudioTracks(u)), []);
    }

    /**
     * @private
     * handles offer generation when a re-negotiation is needed (because the mcu added a new Transceiver to the connection, for example)
     * triggers the puppeteer onOfferHandler to pass the offer to the node server
     * @param userId [string] which users peer connection needs renegotiation
     * @return object RTCSessionDescription offer
     * */
    async _initiateOfferHandshake(userId){
        const pc = this.getPeerConnection(userId);
        const offer = await pc.createOffer();
        if(pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        this._onOffer(userId, offer);
        return offer;
    }

    /**
     * call this to handle an offer of a user
     * @param userId [string] the user who sent the offer
     * @param offer [object] an RTCSessionDescription Offer object
     * @returns Promise resolves with an RTCSessionDescription Answer object generated according to the given offer or null in case of a glare situation
     * (MCU and client started an Offer Answer Handshake at the same time and the server made a rollback)
     * */
    async handleOffer(userId, offer){
        const pc = this.getPeerConnection(userId);
        if(pc.signalingState !== "stable"){
            if(typeof this.yielding === "function" ? this.yielding(userId) : this.yielding) return;
            await pc.setLocalDescription({type: 'rollback'});
            await pc.setRemoteDescription(offer);
            return null;
        }else{
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            return answer;
        }
    }

    /**
     * call this to handle an answer sdp for a given user
     * @param userId [string] the user who sent the answer
     * @param answer [object] an RTCSessionDescription Answer object
     * @returns Promise resolves when the answer was handled or rejects with an error
     * */
    async handleAnswer(userId, answer){
        const pc = this.getPeerConnection(userId);
        await pc.setRemoteDescription(answer);
    }

    /**
     * @private
     * handle own ice candidates by triggering the given/injected handler of the puppeteer instance,
     * which then takes the candidate from inside puppeteers chromium to the outside node server
     * */
    _handleIceCandidate(userId, candidate){
        if(candidate) this._onIceCandidate(userId, candidate);
    }

    /**
     * register a handle for generated ice candidates
     * @param cb [function] receives as parameters the user id [string] and the ice candidate value [string]
     * */
    onIceCandidate(cb){
        this._onIceCandidate = cb;
    }

    /**
     * register a handle for generated offers
     * @param cb [function] receives as parameters the user id [string] and the offer value [string]
     * */
    onOffer(cb){
        this._onOffer = cb;
    }

    /**
     * register a handle for accessible tracks
     * @param cb The callback function receives the arguments user id [string], track [MediaStreamTrack], streams [array]
     * */
    onTrack(cb){
        if(typeof cb !== "function") throw new Error("ARGUMENT MUST BE A FUNCTION");
        this._onTrack = cb;
    }

    /**
     * @private
     * handle incoming tracks by invoking the onTrackHandle Callback and/or a global onTrackHandleFunction
     * */
    _handleTrack(userId, track, streams){
        this._onTrack(userId, track, streams);
    }


    /**
     * define what you want to do with new peer connections (all handlers are already attached, use for adding Transceivers or similar stuff)
     * @param cb The callback function receives the arguments userId, rtcPeerConnection
     * */
    onNewPeerConnection(cb){
        if(typeof cb !== "function") throw new Error("ARGUMENT MUST BE A FUNCTION");
        this._onNewPeerConnection = cb;
    }

    /**
     * define what you have to do when a peer connection closes (handling the webrtc closing functions will be done automatically)
     * @param cb The callback function receives the arguments userId, rtcPeerConnection
     * */
    onDisconnect(cb){
        if(typeof cb !== "function") throw new Error("ARGUMENT MUST BE A FUNCTION");
        this._onDisconnect = cb;
    }

    /**
     * give ice candidate to MCU
     * @param userId [string] which user sent the given candidate
     * @param candidate [object] an ice candidate received from a user
     * @return Promise resolves when the candidate was added successfully or rejects with the error as reason
     * */
    async addIceCandidate(userId, candidate){
        const pc = this.getPeerConnection(userId);
        return candidate !== null ? pc.addIceCandidate(candidate) : Promise.resolve();
    }


    /**
     * @private
     * check if the connection may be closed due to one peer having no net or a not graceful disconnect (without closing the peer connection)
     * */
    _disconnectDetection(userId){
        const pc = this.getPeerConnection(userId);
        if(pc.iceConnectionState === "disconnected") pc.close();
    }

    /**
     * @private
     * kill closed connections by deleting them
     * */
    _checkClosed(userId){
        const pc = this.getPeerConnection(userId);
        if(pc.connectionState === "closed" || pc.signalingState === "closed"){
            if(this._onDisconnect) this._onDisconnect(userId, pc);
            delete this.peerConnections[userId];
        }
    }
}

module.exports = ConnectionManager;