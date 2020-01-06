function createVideoNoiseTrack(){
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d", {alpha: false});
    const noise = function(){
        const pixels = context.createImageData(canvas.width, canvas.height);
        const buffer = new Uint8ClampedArray(pixels.data.buffer);
        const length = buffer.length;
        for(let i = 0; i < length; i+=4){
            buffer[i] = buffer[i+1] = buffer[i+2] = Math.random() < 0.5 ? 0 : 255;
        }
        context.putImageData(pixels, 0, 0)
    };
    const loop = function(){
        noise();
        requestAnimationFrame(loop);
    };
    loop();
    return canvas.captureStream(30).getVideoTracks()[0];
}

function createAudioNoiseTrack(){
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    const length = context.sampleRate * 4096;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const bandpass = context.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1000;
    const noise = context.createBufferSource();
    const data = buffer.getChannelData(0);
    for(let i = 0; i < length; i++){
        data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;
    noise.connect(bandpass).connect(destination);
    noise.start();
    return destination.stream.getAudioTracks()[0];
}

function createRandomMediaStream(){
    return new MediaStream([createVideoNoiseTrack(), createAudioNoiseTrack()]);
}

