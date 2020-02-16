const VideoMixingConfiguration = require('../VideoMixingConfiguration');

class Speaker extends VideoMixingConfiguration{

    constructor(speechDetection, priority = 0, applicable = true){
        // check if the given id is speaking now, or if everyone is silent
        const idIsNowSpeaking = id => speechDetection.speakers.indexOf(id) >= 0 || speechDetection.speakers.length === 0;
        super({
            applicable,
            priority,
            background: () => speechDetection.silence ? 'rgb(0,0,0)' : 'rgb(100,200,250)',
            positions: {
                x: s => speechDetection.silence ? 2 : 5,
                y: s => speechDetection.silence ? 2 : 5,
                width: s=> idIsNowSpeaking(s.id) ? (speechDetection.silence ? s.width - 4 : s.width - 10) : 0,
                height: s => idIsNowSpeaking(s.id) ? (speechDetection.silence ? s.height - 4 : s.height - 10) : 0
            }
        });
    }
}

module.exports = Speaker;