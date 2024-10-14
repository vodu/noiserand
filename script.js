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

// master parametic equalizer
let eqBands = [];
const eqNumBands = 10;
const eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const eqQFactor = 1.0;

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

        // todo: create equalizer on page load finished
        if (eqBands.length == 0) {
            createParametricEqualizer();
        }

        // White Noise Node
        whiteNoiseNodeLeft = new AudioWorkletNode(audioCtx, 'white-noise-processor');
        whiteNoiseNodeLeft.connect(noiseGainLeft);
        whiteNoiseNodeRight = new AudioWorkletNode(audioCtx, 'white-noise-processor');
        whiteNoiseNodeRight.connect(noiseGainRight);

        // Pink Noise Node
        pinkNoiseNodeLeft = new AudioWorkletNode(audioCtx, 'pink-noise-processor');
        pinkNoiseNodeRight = new AudioWorkletNode(audioCtx, 'pink-noise-processor');

        // Brown Noise Node
        brownNoiseNodeLeft = new AudioWorkletNode(audioCtx, 'brown-noise-processor');
        brownNoiseNodeRight = new AudioWorkletNode(audioCtx, 'brown-noise-processor');

        // Master Gain
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

        // Stereo Panner
        stereoPanner = audioCtx.createStereoPanner();
        stereoPanner.pan.setValueAtTime(stereoPannerValue, audioCtx.currentTime);

        // Connections
        noiseChannelMerger
        .connect(masterGain)
        .connect(stereoPanner)
        .connect(audioCtx.destination);

        // Parametric Equalizer
        eqBands.forEach(eqBand => {
            masterGain.connect(eqBand.filter);
            eqBand.filter.connect(stereoPanner);
        });

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

    // parametric equalizer
    eqBands.forEach(eqBand => {
        eqBand.filter.disconnect();
    });
    eqBands = [];
    const eqContainer = document.getElementById('param-eq-controls');
    eqContainer.innerHTML = '';

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
// Parametric Equalizer
//
function createParametricEqualizer() {
    if (!audioCtx) {
        return;
    }

    const eqContainer = document.getElementById('param-eq-controls');

    for (let i = 0; i < eqNumBands; i++) {

        const bandContainer = document.createElement('div');
        const freqLabel = document.createElement('label');
        freqLabel.textContent = eqFrequencies[i] + ' Hz';
        bandContainer.appendChild(freqLabel);

        const gainSlider = document.createElement('input');
        gainSlider.type = 'range';
        gainSlider.min = -24;
        gainSlider.max = 24;
        gainSlider.step = 0.5;
        gainSlider.value = 0;
        gainSlider.oninput = function() {
            updateEqBandGain(i, gainSlider.value);
        };
        bandContainer.appendChild(gainSlider);
        eqContainer.appendChild(bandContainer);

        const eqBand = {
            gain: gainSlider,
            filter: audioCtx.createBiquadFilter()
        }
        eqBand.filter.type = 'peaking';
        eqBand.filter.frequency.setValueAtTime(eqFrequencies[i], audioCtx.currentTime);
        eqBand.filter.Q.setValueAtTime(eqQFactor, audioCtx.currentTime);
        eqBand.filter.gain.setValueAtTime(0, audioCtx.currentTime);
        eqBands.push(eqBand);
    }
}

function updateEqBandGain(bandIndex, value) {
    let gain = parseFloat(value);
    eqBands[bandIndex].filter.gain.setValueAtTime(gain, audioCtx.currentTime);
}

// 
// UI
//

// Master Volume
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

// Noise
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

// function updateNoiseFilterFrequency(value) {
//     let float_value = parseFloat(value);
//     let min_freq = 20;
//     let max_freq = 20000;
//     noiseFilterFrequency = Math.exp(Math.log(min_freq) + float_value * (Math.log(max_freq) - Math.log(min_freq)));
//     document.getElementById('noiseFilterFrequencyValue').textContent = noiseFilterFrequency.toFixed(0);
//     if (noiseBandpassFilter) {
//         noiseBandpassFilter.frequency.setValueAtTime(noiseFilterFrequency, audioCtx.currentTime);
//     }
// }

// function updateNoiseFilterQ(value) {
//     noiseFilterQ = parseFloat(value);
//     document.getElementById('noiseFilterQValue').textContent = noiseFilterQ.toFixed(1);
//     if (noiseBandpassFilter) {
//         noiseBandpassFilter.Q.setValueAtTime(value, audioCtx.currentTime);
//     }
// }
