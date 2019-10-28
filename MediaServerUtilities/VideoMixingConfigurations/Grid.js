const VideoMixingConfiguration = require('../VideoMixingConfiguration.js');

/**
 * @private
 * @param n [UInt] the positive integer to factor
 * @return array of tuples of factoring numbers, unique (only a,b but not a,b and b,a) and sorted biggest factors first
 * */
function factors(n){
    if(n === null || n === undefined || isNaN(n)) throw new Error('Invalid argument, n must be a number but is ' + n);
    if(n === 0 || n === 1) return [[n, n]];
    const factorDict = {};
    // honestly, there is no need for factoring algorithms like rho,
    // n will be less than 30, one could even hard-code the results...
    for(let i = 1; i <= Math.floor(n/2); i++){
        const isDivisor = n%i === 0;
        if(isDivisor){
            if(!factorDict[i]) factorDict[n/i] = i;
        }
    }
    return Object.keys(factorDict).map(k => [factorDict[k],+k]);
}

/**
 * Places Streams in a grid
 * */
class Grid extends VideoMixingConfiguration{

    /**
     * Creates a grid of videos, which works best for square numbers but also for numbers which can be factored by a and b with |a-b| <= 2
     * Everything else seemed to look bad
     * @param priority [int=0]
     * @param applicable [function=differenceBetweenTwoBiggestFactors(ids.length) <= 2]
     * */
    constructor(priority = 0, applicable = ids =>Math.abs(factors(ids.length)[0][1]-factors(ids.length)[0][0]) <= 2){
        super({
            applicable,
            priority: 0,
            positions: function(id, index, arr){
                const [rows, columns] = factors(arr.length)[0];
                const frameWidth = this.width/columns;
                const frameHeight = this.height/rows;
                return {
                    x: (index % columns) * frameWidth,
                    y: ~~(index / columns) * frameHeight,
                    width: frameWidth,
                    height: frameHeight
                };
            }
        });
    }
}

module.exports = Grid;