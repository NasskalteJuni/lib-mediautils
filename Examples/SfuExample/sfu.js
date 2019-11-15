/* globals MediaUtilities */
const connections = new MediaUtilities.ConnectionManager();
const quality = {};

connections.onNewPeerConnection((user, connection) => {
    // add every other users video and audio tracks
    console.log('add video tracks to new connection', connections.getVideoTracksExceptUser(user));
    connections.getVideoTracksExceptUser(user).forEach(t => connection.addTransceiver(...new MediaUtilities.Transcriber(t, {streams: [], direction: "sendonly"}).transcribe(quality[user] || "medium")));
    connections.getAudioTracksExceptUser(user).forEach(t => connection.addTransceiver(...new MediaUtilities.Transcriber(t, {streams: [], direction: "sendonly"}).transcribe(quality[user] || "medium")));
});
connections.onTrack((user, track) => {
    console.log('track to forward added');
    // add the new track to every other user
    const transcriber = new MediaUtilities.Transcriber(track, {streams: [], direction: "sendonly"});
    connections.users
        .filter(u => u !== user)
        .forEach(u => {
            connections.getPeerConnection(u).addTransceiver(...transcriber.transcribe(quality[user] || "medium"));
        });
});
// just forward ice candidates and offers when they are generated
connections.onIceCandidate((user, candidate) =>  Tunnel.doExport('ice', {user, content: candidate, type: 'ice'}));
connections.onOffer((user, offer) => Tunnel.doExport('offer', {user, content: offer, type: 'offer'}));
// handle messages that are passed into the browser environment
Tunnel.onImport(async ({type, content, user}) => {
    switch (type) {
        case 'ice':
            await connections.addIceCandidate(user, content);
            break;
        case 'offer':
            const answer = await connections.handleOffer(user, content);
            console.log(answer);
            Tunnel.doExport('answer',{type: 'answer', content: answer, user});
            break;
        case 'answer':
            await connections.handleAnswer(user, content);
            break;
    }
});