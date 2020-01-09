const AudioMixer = require('./AudioMixer.js');
const VideoMixer = require('./VideoMixer.js');
const ConnectionManager = require('./ConnectionManager.js');
const Connect = require('./ConnectWithSignaledLock.js');
const Recorder = require('./Recorder.js');
const SpeechDetection = require('./SpeechDetection.js');
const Transcriber = require('./Transcriber.js');
const VideoMixingConfiguration = require('./VideoMixingConfiguration.js');


const Grid = require('./VideoMixingConfigurations/Grid.js');
const Middle = require('./VideoMixingConfigurations/Middle.js');
const Line = require('./VideoMixingConfigurations/Line.js');

module.exports = {
    VideoMixer,
    AudioMixer,
    Transcriber,
    Connect,
    ConnectionManager,
    Recorder,
    SpeechDetection,
    VideoMixingConfiguration,
    VideoMixingConfigurations: {
        Grid,
        Middle,
        Line
    }
};