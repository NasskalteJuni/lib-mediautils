class PlaceholderMediaGenerator{

        constructor({enable = false} = {}){
            this._audio = this._generateAudio(enable);
            this._video = this._generateVideo(enable);
        }

        get out(){
            return new MediaStream([this._video, this._audio]);
        }

        get audioTrack(){
            return this._audio;
        }

        get videoTrack(){
            return this._video;
        }

        _generateAudio(enabled = false){
            let ctx = new AudioContext(), oscillator = ctx.createOscillator();
            let dst = oscillator.connect(ctx.createMediaStreamDestination());
            oscillator.start();
            return Object.assign(dst.stream.getAudioTracks()[0], {enabled});
        }

        _generateVideo(enabled = false, dimensions = {width: 360, height: 420}){
            let canvas = Object.assign(document.createElement("canvas"), dimensions);
            let context = canvas.getContext('2d');
            context.fillRect(0, 0, dimensions.width, dimensions.height);
            if(enabled){
                window.setInterval(() => {
                    context.fillStyle = 'rgb('+Math.floor(Math.random()*255)+','+Math.floor(Math.random()*255)+','+Math.floor(Math.random()*255)+')';
                    context.fillRect(0,0, dimensions.width, dimensions.height);
                },1000);
            }
            let stream = canvas.captureStream(1);
            return Object.assign(stream.getVideoTracks()[0], {enabled});
        }
}

module.exports = PlaceholderMediaGenerator;