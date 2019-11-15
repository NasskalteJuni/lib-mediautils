class Call {

    constructor(signallingChannel, iceServers = [{urls: "stun:stun.l.google.com:19302"}, {urls: "stun:stunserver.org"}]) {
        this._io = signallingChannel;
        this._pc = new RTCPeerConnection({iceServers, sdpSemantics: 'unified-plan'});
        this._pc.addEventListener('icecandidate', e => e.candidate ? this._io.send({
            type: 'ice',
            content: e.candidate,
            receiver: 'server'
        }) : false);
        this._pc.addEventListener('negotiationneeded', () => this.start());
        this._pc.addEventListener('track', e => this._onTrack ? this._onTrack(e.track, e.streams) : false);
        this._io.addEventListener('answer', e => console.log(JSON.parse(e.data)) || (this._pc.setRemoteDescription(JSON.parse(e.data))));
        this._io.addEventListener('ice', e => {
            console.log(e.data, this._pc.signalingState, this._pc.iceConnectionState, this._pc.iceGatheringState);
            const candidate = JSON.parse(e.data);
            this._pc.addIceCandidate(candidate).catch(error => {
                if (!this._pc.remoteDescription) {
                    const t = setTimeout(() => clearTimeout(t) || this._pc.addIceCandidate(candidate).catch(console.error), 500);
                } else {
                    console.error(error);
                }
            })
        });
        this._io.addEventListener('offer', async e => {
            if (this._pc.signalingState !== "stable") return;
            await this._pc.setRemoteDescription(JSON.parse(e.data));
            const answer = await this._pc.createAnswer();
            await this._pc.setLocalDescription(answer);
            this._io.send({type: 'answer', content: answer, receiver: 'server'});
        });
        this._bundle = new MediaStream([]);
        this._audio = this._pc.addTransceiver('audio', {direction: 'inactive', stream: this._bundle});
        this._lastAudio = null;
        this._video = this._pc.addTransceiver('video', {direction: 'inactive', stream: this._bundle});
        this._lastVideo = null;
    }

    async start() {
        if (this._pc.signalingState !== "stable") return;
        const offer = await this._pc.createOffer();
        await this._pc.setLocalDescription(offer);
        this._io.send({type: 'offer', content: offer, receiver: 'server'});
    }

    replaceAudio(track) {
        if (track === null && this._audio.sender.track !== null) this._lastAudio = this._audio.sender.track;
        this._audio.sender.replaceTrack(track);
    }

    replaceVideo(track) {
        if (track === null && this._audio.sender.track !== null) this._lastVideo = this._video.sender.track;
        this._video.sender.replaceTrack(track);
    }

    stopAudio() {
        this.replaceAudio(null);
        this._audio.direction = "inactive";
    }

    stopVideo() {
        this.replaceVideo(null);
        this._video.direction = "inactive";
    }

    stop() {
        this.stopAudio();
        this.stopVideo();
    }

    restart() {
        this.restartAudio();
        this.restartVideo();
    }

    restartAudio() {
        if (this._lastAudio === null) console.warn('no previous audio track');
        this.replaceAudio(this._lastAudio);
        this._audio.direction = "sendonly";
    }

    restartVideo() {
        if (this._lastVideo === null) console.warn('no previous video track');
        this.replaceVideo(this._lastVideo);
        this._video.direction = "sendonly";
    }

    async addMedia(stream) {
        if (stream.getVideoTracks().length) {
            this.replaceVideo(stream.getVideoTracks()[0]);
            this._video.direction = "sendonly";
        }
        if (stream.getAudioTracks().length) {
            this._audio.direction = "sendonly";
            this.replaceAudio(stream.getAudioTracks()[0]);
        }
    }

    destroy() {
        try {
            this._audio.stop();
            this._video.stop();
        } catch (err) {
            console.log('missing browser implementation');
        }
        this._pc.close();
        this._io.close();
    }

    onTrack(cb) {
        if (typeof cb !== "function") throw new Error("Callback must be a function");
        this._onTrack = cb;
    }
}

