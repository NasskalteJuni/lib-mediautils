const currentSpeakerOnly = new MediaUtilities.VideoMixingConfiguration({
    priority: 0,
    applicable: true,
    positions: {
        x: s => window['speaking'] ? 0 : 10,
        y: s => window['speaking'] ? 0 : 10,
        width: s => s.id === window['currentSpeaker'] ? (window['speaking'] ? s.width : s.width - 20) : 0,
        height: s => s.id === window['currentSpeaker'] ? (window['speaking'] ? s.height : s.height - 20) : 0
    }
});