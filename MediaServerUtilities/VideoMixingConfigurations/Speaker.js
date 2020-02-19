const VideoMixingConfiguration = require('../VideoMixingConfiguration');

class Speaker extends VideoMixingConfiguration{

    constructor(speechDetection, priority = 0, applicable = true){
        // check if the given id is speaking now, or if everyone is silent
        const silenceOffset = 2;
        const noiseOffset = 5;
        const smallFrameWidth = 80;
        const smallFrameHeight = 60;
        const smallFrameOffset = 5;
        const idIsNowSpeaking = (id, index) => speechDetection.speakers.indexOf(id) >= 0 || (speechDetection.silence && (speechDetection.lastSpeaker === id || (speechDetection.lastSpeaker === null  && index === 0)));
        const frameX = stats => {
            if(idIsNowSpeaking(stats.id, stats.drawIndex)){
                return speechDetection.silence ? silenceOffset : noiseOffset;
            }else{
                return smallFrameOffset + stats.drawIndex*smallFrameWidth;
            }
        };
        const frameY = stats => {
            if(idIsNowSpeaking(stats.id, stats.drawIndex)){
                return speechDetection.silence ? silenceOffset : noiseOffset;
            }else{
                return stats.height - smallFrameHeight - noiseOffset;
            }
        };
        const frameWidth = stats => {
            if(idIsNowSpeaking(stats.id, stats.drawIndex)){
                return speechDetection.silence ? stats.width - silenceOffset*2 : stats.width - noiseOffset*2;
            }else{
                return smallFrameWidth;
            }
        };
        const frameHeight = stats => {
            if(idIsNowSpeaking(stats.id, stats.drawIndex)){
                return speechDetection.silence ? stats.height - silenceOffset*2 : stats.height - noiseOffset*2;
            }else{
                return smallFrameHeight;
            }
        };
        super({
            applicable,
            priority,
            background: () => speechDetection.silence ? 'rgb(0,0,0)' : 'rgb(100,200,250)',
            positions: {
                x: frameX,
                y: frameY,
                width: frameWidth,
                height: frameHeight,
                zIndex: s => idIsNowSpeaking(s.id, s.drawIndex) ? 0 : 1
            }
        });
    }
}

module.exports = Speaker;