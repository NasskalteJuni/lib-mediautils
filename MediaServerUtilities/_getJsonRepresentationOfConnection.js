module.exports = function toJSON(connection){
    return {
        "peer": connection._peer,
        "id": connection._id,
        "closed": connection.closed,
        "streams": connection.streams.map(s => ({active: s.active, id: s.id})),
        "tracks": connection.tracks.map(t => ({readyState: t.readyState, muted: t.muted, kind: t.kind, id: t.id})),
        "addedTracks": connection._addedTracks.map(t => ({readyState: t.readyState, muted: t.muted, kind: t.kind, id: t.id})),
        "localDescription": connection._connection.localDescription,
        "remoteDescription": connection._connection.remoteDescription,
        "connectionState": connection._connection.connectionState,
        "signalingState": connection._connection.signalingState,
        "iceGatheringState": connection._connection.iceGatheringState,
        "iceConnectionState": connection._connection.iceConnectionState,
        "verbose": connection._verbose,
    };
};