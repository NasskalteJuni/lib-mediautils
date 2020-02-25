/**
 * Utility to generate placeholder media without using a web cam or video/audio files
 * @class
 * */
class PlaceholderMediaGenerator{

        /**
         * create a new Media Generator
         * @param {Object} [settings]
         * @param {Boolean} [settings.enable=false] if the generated audio should actually make noise and the video should be more than just black
         * */
        constructor({enable = false} = {}){
            this._audio = this._generateAudio(enable);
            this._video = this._generateVideo(enable);
        }

        /**
         * a generated MediaStream
         * @readonly
         * */
        get out(){
            return new MediaStream([this._video, this._audio]);
        }

        /**
         * a generated audio MediaStreamTrack
         * @readonly
         * */
        get audioTrack(){
            return this._audio;
        }

        /**
         * a generated video MediaStreamTrack
         * @readonly
         * */
        get videoTrack(){
            return this._video;
        }

        /**
         * create a disabled (=will not be played on speakers) beep sound
         * @param {Boolean} [enabled=false]
         * @private
         * */
        _generateAudio(enabled = false){
            let ctx = new AudioContext(), oscillator = ctx.createOscillator();
            let dst = oscillator.connect(ctx.createMediaStreamDestination());
            oscillator.start();
            return Object.assign(dst.stream.getAudioTracks()[0], {enabled});
        }

        /**
         * create a disabled (=always black and no new frames) video stream
         * @param {Boolean} [enabled=false]
         * @param {Object} [dimensions={width:360, height:420}] which dimensions the generated video stream should have
         * */
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