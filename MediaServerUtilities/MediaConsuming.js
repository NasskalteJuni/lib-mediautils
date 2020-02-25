/**
 * @interface MediaConsuming
 * @description Everything that implements the MediaConsuming Interface has methods to add and remove media
 * */
/**
 * @function
 * @name MediaConsuming#addMedia
 * @param {MediaStream|MediaStreamTrack} m A media Object to add. This should be a MediaStream or MediaStreamTrack
 * @param {string} [id=m.id] A unique identifier for the added media. If none is given, this defaults to the medias id, which works fine local, but not on remote media since media ids are not synced with the remote peer
 * */
/**
 * @function
 * @name MediaConsuming#removeMedia
 * @param {MediaStream|MediaStreamTrack|string} [m] The media to remove. Can be the actual media Object that was given or its id. If omitted or '*', all media that has been added is removed
 * */