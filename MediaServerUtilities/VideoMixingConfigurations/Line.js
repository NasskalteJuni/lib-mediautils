const VideoMixingConfiguration = require('../VideoMixingConfiguration.js');

/**
 * Places streams beside each other
 * */
class Line extends VideoMixingConfiguration{

    /**
     * creates a new Line Mixing config for less than 3 persons
     * @param priority [int=0]
     * @param applicable [ids => ids.length < 3]
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