const AudioMixer = require('./AudioMixer.js');
const VideoMixer = require('./VideoMixer.js');
const Recorder = require('./Recorder.js');
const ConnectionManager = require('./ConnectionManager.js');
const Connection = require('./ConnectionWithSignaledLock.js');
const SpeechDetection = require('./SpeechDetection.js');
const Transcriber = require('./Transcriber.js');
const VideoMixingConfiguration = require('./VideoMixingConfiguration.js');
const Signaler = require('./Signaler.js');
const Conference = require('./ConferenceWithLocalMixing.js');
const PlaceHolderMediaGenerator = require('./PlaceholderMediaGenerator.js');
const wrapTunnelAsSignaler = require('./TunnelSignaler.js');

const Grid = require('./VideoMixingConfigurations/Grid.js');
const Middle = require('./VideoMixingConfigurations/Middle.js');
const Line = require('./VideoMixingConfigurations/Line.js');
const Speaker = require('./VideoMixingConfigurations/Speaker.js');

module.exports = {
    Signaler,
    Recorder,
    VideoMixer,
    AudioMixer,
    Transcriber,
    Connection,
    ConnectionManager,
    SpeechDetection,
    Conference,
    VideoMixingConfiguration,
    PlaceHolderMediaGenerator,
    VideoMixingConfigurations: {
        Grid,
        Middle,
        Line,
        Speaker
    },
    wrapTunnelAsSignaler
};