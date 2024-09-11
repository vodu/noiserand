// globals
let audioCtx;
let isRunning;

const fadeTime = 1.0; // Duration for fade-in and fade-out in seconds

// noise generator
let noiseGainLeft;
let noiseGainRight;
let whiteNoiseNodeLeft;
let whiteNoiseNodeRight;
let pinkNoiseNodeLeft;
let pinkNoiseNodeRight;
let brownNoiseNodeLeft;
let brownNoiseNodeRight;
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
        
        // White Noise Gain
        noiseGainLeft = audioCtx.createGain();
        noiseGainRight = audioCtx.createGain();
        noiseGainLeft.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);
        noiseGainRight.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);

        var noiseChannelMerger = audioCtx.createChannelMerger(2);
        noiseGainLeft.connect(noiseChannelMerger, 0, 0);
        noiseGainRight.connect(noiseChannelMerger, 0, 1);

        await loadNoiseWorklet();

        // White Noise Node
        whiteNoiseNodeLeft = new AudioWorkletNode(audioCtx, 'white-noise-processor');
        whiteNoiseNodeLeft.connect(noiseGainLeft);
        whiteNoiseNodeRight = new AudioWorkletNode(audioCtx, 'white-noise-processor');
        whiteNoiseNodeRight.connect(noiseGainRight);

        // Pink Noise Node
        pinkNoiseNodeLeft = new AudioWorkletNode(audioCtx, 'pink-noise-processor');
        pinkNoiseNodeRight = new AudioWorkletNode(audioCtx, 'pink-noise-processor');

        brownNoiseNodeLeft = new AudioWorkletNode(audioCtx, 'brown-noise-processor');
        brownNoiseNodeRight = new AudioWorkletNode(audioCtx, 'brown-noise-processor');


        // Master Gain
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

        // Stereo Panner
        stereoPanner = audioCtx.createStereoPanner();
        stereoPanner.pan.setValueAtTime(stereoPannerValue, audioCtx.currentTime);

        // Connections
        noiseChannelMerger.connect(masterGain)
        .connect(stereoPanner)
        .connect(audioCtx.destination);

        isRunning = true;
    }
}

async function stop_noise() {
    if (!audioCtx) {
        return;
    }

    // noise gain
    noiseGainLeft.gain.cancelScheduledValues(audioCtx.currentTime);
    noiseGainLeft.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);
    noiseGainLeft.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime);
    noiseGainRight.gain.cancelScheduledValues(audioCtx.currentTime);
    noiseGainRight.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);
    noiseGainRight.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime);

    await new Promise(resolve => setTimeout(resolve, fadeTime * 1000));

    // white noise
    whiteNoiseNodeLeft.port.postMessage('stop');
    whiteNoiseNodeLeft.disconnect();
    whiteNoiseNodeRight.port.postMessage('stop');
    whiteNoiseNodeRight.disconnect();

    // pink noise
    pinkNoiseNodeLeft.port.postMessage('stop');
    pinkNoiseNodeLeft.disconnect();
    pinkNoiseNodeRight.port.postMessage('stop');
    pinkNoiseNodeRight.disconnect();

    // brown noise
    brownNoiseNodeLeft.port.postMessage('stop');
    brownNoiseNodeLeft.disconnect();
    brownNoiseNodeRight.port.postMessage('stop');
    brownNoiseNodeRight.disconnect();

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
async function loadNoiseWorklet() {
    if (audioCtx) {
        await audioCtx.audioWorklet.addModule('noise-worklet.js');
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

function updateNoiseVolume(value) {
    noiseVolume = parseFloat(value);
    document.getElementById('noiseVolumeValue').textContent = noiseVolume.toFixed(2);
    if (noiseGainLeft && noiseGainRight) {
        noiseGainLeft.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);
        noiseGainRight.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);
    }
}

function updateNoiseType(value) {
    console.log('updateNoiseType: ' + value);

    if (value === 'white') {
        whiteNoiseNodeLeft.connect(noiseGainLeft);
        whiteNoiseNodeRight.connect(noiseGainRight);
        pinkNoiseNodeLeft.disconnect();
        pinkNoiseNodeRight.disconnect();
        brownNoiseNodeLeft.disconnect();
        brownNoiseNodeRight.disconnect();
    } else if (value == 'pink') {
        pinkNoiseNodeLeft.connect(noiseGainLeft);
        pinkNoiseNodeRight.connect(noiseGainRight);
        whiteNoiseNodeLeft.disconnect();
        whiteNoiseNodeRight.disconnect();
        brownNoiseNodeLeft.disconnect();
        brownNoiseNodeRight.disconnect();
    } else if (value == 'brown') {
        brownNoiseNodeLeft.connect(noiseGainLeft);
        brownNoiseNodeRight.connect(noiseGainRight);
        whiteNoiseNodeLeft.disconnect();
        whiteNoiseNodeRight.disconnect();
        pinkNoiseNodeLeft.disconnect();
        pinkNoiseNodeRight.disconnect();
    }
}
