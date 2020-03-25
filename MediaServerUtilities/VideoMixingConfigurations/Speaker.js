const VideoMixingConfiguration = require('../VideoMixingConfiguration');

/**
 * A video mixing configuration that shows the current speaker as a big background image and other participants in little images on the bottom.
 * Also indicates if someone is speaking right now
 * @extends VideoMixingConfiguration
 * @class
 * */
class Speaker extends VideoMixingConfiguration{

    /**
     * @param {SpeechDetection} speechDetection A speechDetection object to use to determine who is speaking right now. The media to detect must be added to the speech detection
     * @param {Number} [priority=0] The priority of this config
     * @param {Boolean} [applicable=true] if this config is usable. Should work with every number of conference members, therefore defaults to true
     * */
    constructor(speechDetection, priority = 0, applicable = true){
        // check if the given id is speaking now, or if everyone is silent
        const silenceOffset = 2;
        const noiseOffset = 5;
        const smallFrameWidth = 80;
        const smallFrameHeight = 60;
        const smallFrameOffset = 5;
        const idIsNowSpeaking = (id, index) => speechDetection.lastSpeaker === id  || (speechDetection.lastSpeaker === null && index === 0);
        const frameX = stats => {
            if(idIsNowSpeaking(stats.id, stats.drawIndex)){
                return speechDetection.silence ? silenceOffset : noiseOffset;
            }else{
                return smallFrameOffset + Math.max(0, stats.drawIndex-1)*smallFrameWidth;
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