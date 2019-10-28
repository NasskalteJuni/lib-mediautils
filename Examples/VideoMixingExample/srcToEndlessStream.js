function srcToEndlessStream(src, fps=30){
    const video = document.createElement('video');
    canvas.src = src;
    canvas.autoplay = true;
    canvas.loop = true;
    return canvas.captureStream(fps);
}