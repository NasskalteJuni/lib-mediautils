const VideoMixingConfiguration = require('../VideoMixingConfiguration.js');

/**
 * Places 1 video in the middle and the other 4s in a grid around it
 * @extends VideoMixingConfiguration
 * @class
 * */
class Middle extends VideoMixingConfiguration{

    /**
     * create a grid of streams where one stream (the last one) is in the middle. It is only applicable for 5 conference call members
     * @param {Number} [priority=0] the priority of the config
     * */
    constructor(priority = 0){
        super({
            priority,
            applicable: videos => videos.length === 5,
            positions: [
                // since we cannot refer to 'this' to get width and height at the moment,
                // we pass functions for values that will receive a stats object with width, height and id of the current stream.
                // these functions are calculated just before the painting happens and can be used for dynamic updates on each frame
                // 2x2 grid
                {x: 0, y: 0, width: s => s.width/2, height: s => s.height/2},
                {x: s => s.width/2, y: 0, width: s => s.width/2, height: s => s.height/2},
                {x: 0, y: s => s.height/2, width: s => s.width/2, height: s => s.height/2},
                {x: s => s.width/2, y: s => s.height/2, width: s => s.width/2, height: s => s.height/2},
                // last video in the middle above all
                {x: s => s.width/4, y: s => s.height/4, width: s => s.width/2, height: s => s.height/2}
            ]
        });
    }
}

module.exports = Middle;