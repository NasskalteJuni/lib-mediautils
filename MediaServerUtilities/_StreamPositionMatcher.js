function toPriority(pos){
    if(typeof pos.id !== "undefined") return 0;
    else if(typeof pos.index !== "undefined") return 1;
    else return 2;
}

function sortPositionsByType(positions){
    return positions.sort((a, b) => {
        const aPriority = toPriority(a);
        const bPriority = toPriority(b);
        // sort according to priority id first, indexed second, auto last
        const comparison =  aPriority - bPriority;
        // if indexed, sort also by index
        if(comparison === 0 && aPriority === 1) return a.index-b.index;
        else return comparison;
    })
}

/**
 * @private
 * */
class _StreamPositionMatcher{

    /**
     * adds the matching source and id to the position object
     * @param streams [object] {id: source}
     * @param positions [array]
     * @throws Error when there are more positions than streams, the id defined in a position does not exist for a stream or the index cannot be used
     * */
    static matchStreamsToPositions(streams, positions){
        const ids = Object.keys(streams);
        positions.sort(sortPositionsByType);
        positions.forEach((pos) => {
            let id = null;
            if(typeof pos.id !== undefined){
                id = typeof pos.id === "function" ? pos.id(ids) : pos.id;
                if(!streams[id]) throw new Error('no stream with id '+id);
                pos.source = streams[id];
            }else if(typeof pos.index !== undefined){
                let index = typeof pos.index === "function" ? pos.index(ids) : pos.index;
                if(index > ids.length) throw new Error('not enough streams for index '+index);
                id = ids[index];
                pos.source = streams[id];
                pos.id = id;
            }else{
                if(!ids.length) throw new Error('more position definitions than streams');
                id = ids[0];
                pos.source = streams[id]
            }
            ids.shift();
        });
        return positions;
    }
}