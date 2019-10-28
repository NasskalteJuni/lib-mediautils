/**
 * @private
 * */
class _CurrentConfigFinder{

    /**
     * get the config that is applicable AND has the highest priority
     * @param configurations [object] an object with the config ids as key and the configurations as values
     * @param streamIds [array] list of current ids
     * @return object of structure {id: VideoMixingConfiguration}
     * */
    static findCurrentConfig(configurations, streamIds) {
        let highestApplicableId = null;
        for (let id in configurations) {
            if (configurations.hasOwnProperty(id)) {
                const currentConfig = configurations[id];
                if (currentConfig.applicable(streamIds)) {
                    if (configurations[highestApplicableId].priority(streamIds) < currentConfig.priority(streamIds)) {
                        highestApplicableId = id
                    }
                }
            }
        }
        const result = {};
        result[highestApplicableId] = configurations[highestApplicableId];
        return result;
    }

}