const Listenable = require('./Listenable.js');
const ID = () => new Date().getTime().toString(32) + Math.random().toString(32).substr(2,7);

/**
 * Introduces an abstraction layer around the RTCPeerConnection.
 * It uses a predefined signalling mechanism, handles common problems (short-time state errors, race-conditions) and
 * comfort functions (like accepting media-streams and transforming them into tracks or transceivers)
 * */
class Connect extends Listenable() {

    constructor({id = ID(), peer = null, signaller, iceServers = [{"urls": "stun:stun1.l.google.com:19302"}], useUnifiedPlan = true, verbose = false, isYielding = () => false} = {}) {
        super();
        this._signaller = signaller;
        this._connectionConfig = {iceServers, sdpSemantics: useUnifiedPlan ? 'unified-plan' : 'plan-b'};
        this._id = id;
        this._peer = peer || this._id;
        this._signaller.addEventListener('message', e => this._handleSignallingMessage(e.data));
        this._verbose = verbose;
        this._isYielding = isYielding;
        this._setupPeerConnection();
        this._receivedStreams = [];
        this._receivedTracks = [];
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
        this._connection.addEventListener('negotiationneeded', () => this._initiateHandshakeWithOffer());
        this._connection.addEventListener('iceconnectionstatechange', () => this._detectDisconnection());
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
                sent: new Date().toISOString(),
                type: 'ice'
            });
            this._signaller.send(msg);
        }
    }

    async _initiateHandshakeWithOffer() {
        if (this._connection.signalingState !== "stable") return;
        const offer = await this._connection.createOffer();
        await this._connection.setLocalDescription(offer);
        if (this._verbose) console.log('created offer on connection ' + this._id + ':', offer);
        const msg = JSON.stringify({receiver: this._peer, data: offer, type: 'offer', sent: new Date().toISOString()});
        this._signaller.send(msg);
        this.dispatchEvent('negotiationstarted');
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
        if (this._verbose) console.log(this._id + ' received message', msg);
        switch (msg.type) {
            case "offer":
                this._handleIncomingOffer(msg.data);
                break;
            case "answer":
                this._finishHandshake(msg.data);
                break;
            case "ice":
                this._handleRemoteIceCandidate(msg.data);
                break;
            case "restart":
                this._handleMissingRollback();
                break;
            case "connection:close":
                this._handleClosingConnection();
                break;
            default:
                if (this._verbose) console.log('no defined routine for message of type ' + msg.type);
        }
    }

    _handleMissingRollback() {
        this._connection.close();
        this._setupPeerConnection();
    }

    _handleClosingConnection() {
        this._receivedTracks.forEach(track => track.stop());
        this._connection.close();
        this.dispatchEvent('close');
    }

    _handleRemoteIceCandidate(candidate) {
        const addIceCandidate = (candidate) => {
            if (this._verbose) console.log('adding ice candidate for ' + this._id + ':', candidate);
            this._connection.addIceCandidate(candidate).catch(console.error);
        };
        if (candidate !== null) {
            if (this._connection.remoteDescription) {
                addIceCandidate(candidate)
            } else {
                if (this._verbose) console.log('postponing ice candidate for ' + this._id + ' due to missing offer');
                let tries = 0;
                let maxTries = 3;
                let waitMillisecondsBeforeNextTry = 1000;
                const checkInterval = setInterval(() => {
                    if (tries === maxTries) {
                        clearInterval(checkInterval);
                        console.error('could not set ice candidate due to missing remote description');
                    }
                    if (this._connection.remoteDescription) {
                        addIceCandidate(candidate);
                    } else {
                        tries++;
                    }
                }, waitMillisecondsBeforeNextTry);
            }
        }
    }

    async _handleIncomingOffer(offer) {
        if (this._connection.signalingState !== "stable") {
            if (this._isYielding(this._peer))
                try {
                    await Promise.all([
                        this._connection.setLocalDescription({type: "rollback"}),
                        this._connection.setRemoteDescription(offer)
                    ])
                } catch (err) {
                    if (err.message.indexOf('rollback') >= 0) this._handleMissingRollback();
                    else console.error(err);
                }
        } else {
            await this._connection.setRemoteDescription(offer);
        }
        if (this._verbose) console.log(this._id + ' received offer', offer);
        const answer = await this._connection.createAnswer();
        await this._connection.setLocalDescription(answer);
        const msg = JSON.stringify({
            receiver: this._peer,
            data: answer,
            type: "answer",
            sent: new Date().toISOString()
        });
        this._signaller.send(msg);
        this.dispatchEvent('receivednegotiation');
    }

    async _finishHandshake(answer) {
        await this._connection.setRemoteDescription(answer);
        this.dispatchEvent('finishednegotiation');
    }

    _addTrackToConnection(track, streams = []) {
        if (this._connection.signalingState === "stable") {
            if (this._verbose) console.log('add track to connection ' + this._id, track);
            this._connection.addTransceiver(track, streams instanceof Array ? {
                direction: "sendonly",
                streams
            } : streams);
        } else {
            if (this._verbose) console.log('postpone adding media due to ongoing sdp handshake');
            const trackHandle = () => {
                if (this._connection.signalingState === "stable") this._addTrackToConnection(track, streams);
                this._connection.removeEventListener('signalingstatechange', trackHandle);
            };
            this._connection.addEventListener('signalingstatechange', trackHandle);
        }
    }

    _removeTrackFromConnection(track) {
        let removed = 0;
        this._connection.getTransceivers().forEach(transceiver => {
            // we obviously only remove our own tracks, therefore searching 'recvonly'-transceivers makes no sense
            if (transceiver.direction === "sendrecv" || transceiver.direction === "sendonly") {
                const searchingTrackKind = typeof track === "string" && (track === "audio" || track === "video");
                const searchingActualTrack = track instanceof MediaStreamTrack;
                if (transceiver.sender.track && (searchingActualTrack && transceiver.sender.track.id === track.id) || (searchingTrackKind && transceiver.sender.track.kind === track)) {
                    transceiver.sender.track.stop();
                    if (transceiver.direction === "sendrecv") transceiver.direction = "recvonly";
                    else transceiver.direction = "inactive";
                    removed++;
                }
            }
        });
        if (this._verbose) console.log('removed ' + removed + ' tracks from connection ' + this._id);
    }

    _replaceTrack(searchTrack, replacementTrack) {
        const searchingActualTrack = searchTrack instanceof MediaStreamTrack;
        const searchingTrackKind = typeof searchTrack === "string" && (track === "audio" || track === "video");
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
        if (this._connection.iceConnectionState === "disconnected") this._connection.close();
        this.dispatchEvent('close');
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

    removeMedia(media) {
        if (media instanceof MediaStream) {
            media.getTracks().forEach(track => this._removeTrackFromConnection(track));
        } else if (media instanceof MediaStreamTrack) {
            this._removeTrackFromConnection(track);
        } else if (typeof media === "string" && (media === "audio" || media === "video")) {
            stream.getTracks().forEach(track => this._removeTrackFromConnection(track))
        } else {
            console.error('unknown media type');
        }
    }

    /**
     * All received tracks of the given connection
     * */
    get tracks() {
        return this._receivedTracks;
    }

    /**
     * All streams of the given connection
     * */
    get streams() {
        return this._receivedStreams;
    }


    /**
     * close the connection
     * */
    close() {
        const msg = JSON.stringify({
            receiver: this._peer,
            data: 'immediately',
            type: 'connection:close',
            sent: new Date().toISOString()
        });
        this._signaller.send(msg);
        this._connection.close();
        this.dispatchEvent('close');
    }

}

module.exports = Connect;