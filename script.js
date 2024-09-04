let audioCtx;
let isRunning;

let noiseGain;
let whiteNoiseNode;
let noiseVolume = 0.5;

const fadeTime = 2.0; // Duration for fade-in and fade-out in seconds

//
// AudioContext start and stop
//  
async function start_noise() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('audioCtx created');
        
        // White Noise Node
        noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);

        await loadWhiteNoiseWorklet();
        whiteNoiseNode = new AudioWorkletNode(audioCtx, 'white-noise-processor');
        whiteNoiseNode.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        isRunning = true;
    }
}

async function stop_noise() {
    if (!audioCtx) {
        return;
    }

    // white noise
    noiseGain.gain.cancelScheduledValues(audioCtx.currentTime);
    noiseGain.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime);

    await new Promise(resolve => setTimeout(resolve, fadeTime * 1000));

    whiteNoiseNode.port.postMessage('stop');
    whiteNoiseNode.disconnect();

    // audiocontext
    audioCtx.close();
    audioCtx = null;

    console.log('audioCtx closed');
    isRunning = false;
}

function toggleStartStop() {
    if (isRunning) {
        stop_noise().then(() => { 
            document.getElementById('startStopButton').textContent = 'Start';
        });
    } else {
        start_noise().then(() => {
            document.getElementById('startStopButton').textContent = 'Stop';
        });
    }
}

//
// AudioWorkletNode
//
async function loadWhiteNoiseWorklet() {
    if (audioCtx) {
        await audioCtx.audioWorklet.addModule('white-noise-worklet.js');
    }
}