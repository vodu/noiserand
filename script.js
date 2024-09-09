// globals
let audioCtx;
let isRunning;

const fadeTime = 1.0; // Duration for fade-in and fade-out in seconds

// noise generator
let noiseGain;
let whiteNoiseNode;
let noiseVolume = 0.5;

// master gain
let masterGain;
let masterVolume = 0.5;

// stereo panner
let stereoPanner;
let stereoPannerValue = 0;

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

        // Master Gain
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

        // Stereo Panner
        stereoPanner = audioCtx.createStereoPanner();
        stereoPanner.pan.setValueAtTime(stereoPannerValue, audioCtx.currentTime);

        // Connections
        whiteNoiseNode
        .connect(noiseGain)
        .connect(masterGain)
        .connect(stereoPanner)
        .connect(audioCtx.destination);

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

    stereoPanner.disconnect();

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

// 
// UI
//
function updateMasterVolume(value) {
    masterVolume = parseFloat(value);
    document.getElementById('masterVolumeValue').textContent = masterVolume.toFixed(2);
    if (masterGain) {
        masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
    }
}

function updateStereoPanning(value) {
    stereoPannerValue = parseFloat(value);
    document.getElementById('stereoPanningValue').textContent = stereoPannerValue.toFixed(2);
    if (stereoPanner) {
        stereoPanner.pan.setValueAtTime(stereoPannerValue, audioCtx.currentTime);
    }
}
