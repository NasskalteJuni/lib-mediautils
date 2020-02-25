const VideoMixingConfiguration = require('../VideoMixingConfiguration.js');

/**
 * Places streams beside each other
 * @extends VideoMixingConfiguration
 * @class
 * */
class Line extends VideoMixingConfiguration{

    /**
     * creates a new Line Mixing config for less or equal to 3 persons which places the videos right besides each other and skews them eventually
     * @param {Number} [priority=0]
     * @param {Boolean|Function} [applicable=ids=>ids.length<4]
     * */
    constructor(priority = 0, applicable = ids => ids.length < 3){
        super({
            applicable,
            priority,
            positions: function(id, index, arr){
                return {
                    x: (this.width/arr.length) * index,
                    y: 0,
                    width: this.width/arr.length,
                    height: this.height
                }
            }
        });
    }
}

module.exports = Line;