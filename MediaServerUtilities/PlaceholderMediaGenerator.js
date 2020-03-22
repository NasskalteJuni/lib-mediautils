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
        constructor({enable = false, audioWave = "sine", audioFrequency = 440, fps=10} = {}){
            this._audio = this._generateAudio(enable, audioFrequency, audioWave);
            this._video = this._generateVideo(enable, fps);
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
         * @param {AudioParam|Number} [frequency=440]
         * @param {PeriodicWave|String} [type="sine"]
         * @private
         * */
        _generateAudio(enabled = false, frequency= 440, type = "sine"){
            console.log("create "+(enabled ? "hearable" : "muted")+" audio of "+frequency+" hertz in form of a "+type+" wave");
            let ctx = new AudioContext(), oscillator = ctx.createOscillator();
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
            oscillator.type = type;
            let dst = oscillator.connect(ctx.createMediaStreamDestination());
            oscillator.start();
            return Object.assign(dst.stream.getAudioTracks()[0], {enabled});
        }

        /**
         * create a disabled (=always black and no new frames) video stream
         * @param {Boolean} [enabled=false]
         * @param {Object} [dimensions={width:360, height:420}] which dimensions the generated video stream should have
         * @param {Number} [fps=10] number of generated frames per second
         * */
        _generateVideo(enabled = false, fps = 10, dimensions = {width: 360, height: 420}){
            console.log("created "+(enabled ? "visible" : "muted")+" video with "+fps+" frames per second for "+dimensions.width+"/"+dimensions.height);
            let canvas = Object.assign(document.createElement("canvas"), dimensions);
            let context = canvas.getContext('2d');
            context.fillRect(0, 0, dimensions.width, dimensions.height);
            if(enabled){
                setInterval(() => {
                    context.fillStyle = 'rgb('+Math.floor(Math.random()*255)+','+Math.floor(Math.random()*255)+','+Math.floor(Math.random()*255)+')';
                    context.fillRect(0,0, dimensions.width, dimensions.height);
                },1000/fps);
            }
            let stream = canvas.captureStream();
            return Object.assign(stream.getVideoTracks()[0], {enabled});
        }
}

module.exports = PlaceholderMediaGenerator;