class ConnectionManager{

    /**
     * create a new peer connection manager who handles everything related to transmitting media via RTCPeerConnections
     * */
    constructor({iceServers = [{"urls": "stun:stun1.l.google.com:19302"}], useUnifiedPlan = true} = {}){
        this.peerConnections = {};
        this.iceServers = iceServers;
        this.useUnifiedPlan = useUnifiedPlan;
    }


    /**
     * Get or create a peer connection for the given user.
     * There is always only 1 peer connection per user,
     * if there is none when this method is called, a new one will be created.
     * All relevant handlers will already be bound to the returned peer connection object
     * and the life cycle of it will be also handled by this class, do not try to remove connections manually
     * @param userId [string] for which user a peer connection will be returned
     * @return RTCPeerConnection
     * */
    getPeerConnection(userId){
        if(!this.peerConnections[userId]){
            const rtcConfiguration = {sdpSemantics:  this.useUnifiedPlan ? 'unified-plan' : 'plan-b', iceServers: this.iceServers};
            this.peerConnections[userId] = new RTCPeerConnection(rtcConfiguration);
            this.peerConnections[userId].addEventListener('icecandidate', e => this._handleIceCandidate(userId, e.candidate));
            this.peerConnections[userId].addEventListener('negotiationneeded', () => this._initiateOfferHandshake(userId));
            this.peerConnections[userId].addEventListener('track', e => this._handleTrack(userId, e.track, e.streams));
            this.peerConnections[userId].addEventListener('connectionstatechange', () => this._checkClosed(userId));
            this.peerConnections[userId].addEventListener('iceconnectionstatechange', () => this._disconnectDetection(userId));
            this.peerConnections[userId].addEventListener('signalingstatechange', () => this._checkClosed(userId));
            if(this._onNewPeerConnection) this._onNewPeerConnection(userId, this.peerConnections[userId]);
        }
        return this.peerConnections[userId];
    }


    /**
     * returns all currently active video tracks
     * @param userId [string=null] the user or null for every user
     * @return list all video tracks
     * */
    getAllVideoTracks(userId=null){
        const getVideoTracks = pc => pc.getTransceivers().filter(t => t.active && t.track.kind === "audio" && (t.direction === "sendrecv" || t.direction === "recvonly"));
        return this.userId === null ? Object.values(this.peerConnections).reduce((tracks, c) => tracks.concat(getVideoTracks(c)),[]) : getVideoTracks(this.getPeerConnection(userId).getTransceivers());
    }

    /**
     * returns all currently active audio tracks
     * @param userId [string=null] the user or null for every audio track
     * @return list all audio tracks
     * */
    getAllAudioTracks(userId=null){
        const getAudioTracks = pc => pc.getTransceivers().filter(t => t.active && t.track.kind === "audio" && (t.direction === "sendrecv" || t.direction === "recvonly"));
        return this.userId === null ? Object.values(this.peerConnections).reduce((tracks, c) => tracks.concat(c.getAudioTracks()),[]) : this.getPeerConnection(userId).getAudioTracks();
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
        if(!window["onOfferHandle"]) throw new Error("MISSING OFFER HANDLER");
        window["onOfferHandle"](userId, offer);
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
        if(!window["onIceCandidateHandle"]) throw new Error("MISSING ICE CANDIDATE HANDLER");
        if(candidate){
            window["onIceCandidateHandle"](userId, candidate);
        }
    }

    /**
     * @private
     * handle incoming tracks by invoking the onTrackHandle Callback and/or a global onTrackHandleFunction
     * */
    _handleTrack(userId, track, streams){
        if(!this._onTrackHandle && !window["onTrackHandle"]) throw new Error("MISSING TRACK HANDLER");
        if(this._onTrackHandle) this._onTrackHandle(userId, track, streams);
        if(window["onTrackHandle"]) window["onTrackHandle"](userId, track, streams); // TODO: remove global invocation method
    }

    /**
     * define how incoming tracks shall be handled.
     * @param cb The callback function receives the arguments userId, track, streams
     * */
    onTrackHandle(cb){
        if(typeof cb !== "function") throw new Error("ARGUMENT MUST BE A FUNCTION");
        this._onTrackHandle = cb;
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
