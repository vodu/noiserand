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
let noiseVolume = 0.1;

// binaural beats generator
let binauralLeftOsc;
let binauralRightOsc;
let binauralGainLeft;
let binauralGainRight;
let binauralWaveform = 'sine';
let binauralFrequency = 200;
let binauralBeatFrequency = 10;
let binauralBeatsVolume = 0.5;

// crackle generator
let crackleGainLeft;
let crackleGainRight;
let crackleNodeLeft;
let crackleNodeRight;
let crackleRate = 5;
let crackleVolume = 1.0;

// master parametic equalizer
let eqBands = [];
const eqNumBands = 10;
const eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const eqQFactor = 0.5;

// master gain
let masterGain;
let masterVolume = 0.5;

// stereo panner
let stereoPanner;
let stereoPannerValue = 0;

// anaylser for scope
let analyser;

//
// AudioContext start and stop
//  
async function start_noise() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('audioCtx created');

        // Binaural Beats Generator
        binauralLeftOsc = audioCtx.createOscillator();
        binauralLeftOsc.type = binauralWaveform;
        binauralLeftOsc.frequency.setValueAtTime(binauralFrequency, audioCtx.currentTime);

        binauralRightOsc = audioCtx.createOscillator();
        binauralRightOsc.type = binauralWaveform;
        binauralRightOsc.frequency.setValueAtTime(binauralFrequency + binauralBeatFrequency, audioCtx.currentTime);

        binauralGainLeft = audioCtx.createGain();
        binauralGainLeft.gain.setValueAtTime(binauralBeatsVolume, audioCtx.currentTime);
        binauralGainRight = audioCtx.createGain();
        binauralGainRight.gain.setValueAtTime(binauralBeatsVolume, audioCtx.currentTime);

        binauralLeftOsc.connect(binauralGainLeft);
        binauralRightOsc.connect(binauralGainRight);

        var binauralChannelMerger = audioCtx.createChannelMerger(2);
        binauralGainLeft.connect(binauralChannelMerger, 0, 0);
        binauralGainRight.connect(binauralChannelMerger, 0, 1);

        // White Noise Gain
        noiseGainLeft = audioCtx.createGain();
        noiseGainLeft.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);
        noiseGainRight = audioCtx.createGain();
        noiseGainRight.gain.setValueAtTime(noiseVolume, audioCtx.currentTime);

        var noiseChannelMerger = audioCtx.createChannelMerger(2);
        noiseGainLeft.connect(noiseChannelMerger, 0, 0);
        noiseGainRight.connect(noiseChannelMerger, 0, 1);

        // Crackle Gain
        crackleGainLeft = audioCtx.createGain();
        crackleGainLeft.gain.setValueAtTime(crackleVolume, audioCtx.currentTime);
        crackleGainRight = audioCtx.createGain();
        crackleGainRight.gain.setValueAtTime(crackleVolume, audioCtx.currentTime);

        var crackleChannelMerger = audioCtx.createChannelMerger(2);
        crackleGainLeft.connect(crackleChannelMerger, 0, 0);
        crackleGainRight.connect(crackleChannelMerger, 0, 1);

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


        // Crackle Node
        crackleNodeLeft = new AudioWorkletNode(audioCtx, 'crackle-processor');
        crackleNodeLeft.connect(crackleGainLeft);
        crackleNodeRight = new AudioWorkletNode(audioCtx, 'crackle-processor');
        crackleNodeRight.connect(crackleGainRight);

        // Master Gain
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);

        // Stereo Panner
        stereoPanner = audioCtx.createStereoPanner();
        stereoPanner.pan.setValueAtTime(stereoPannerValue, audioCtx.currentTime);

        // Scope
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        // Connections
        binauralChannelMerger.connect(masterGain);
        noiseChannelMerger.connect(masterGain);
        crackleChannelMerger.connect(masterGain);

        masterGain.connect(eqBands[0].filter);
        for (let i = 0; i < eqBands.length - 1; i++) {
            eqBands[i].filter.connect(eqBands[i + 1].filter);
        }
        eqBands[9].filter.connect(stereoPanner);

        stereoPanner.connect(audioCtx.destination);
        stereoPanner.connect(analyser);

        binauralLeftOsc.start();
        binauralRightOsc.start();

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

    // binaural beats gain
    binauralGainLeft.gain.cancelScheduledValues(audioCtx.currentTime);
    binauralGainLeft.gain.setValueAtTime(binauralBeatsVolume, audioCtx.currentTime);
    binauralGainLeft.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime);
    binauralGainRight.gain.cancelScheduledValues(audioCtx.currentTime);
    binauralGainRight.gain.setValueAtTime(binauralBeatsVolume, audioCtx.currentTime);
    binauralGainRight.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime);

    // crackle gain
    crackleGainLeft.gain.cancelScheduledValues(audioCtx.currentTime);
    crackleGainLeft.gain.setValueAtTime(crackleVolume, audioCtx.currentTime);
    crackleGainLeft.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime);
    crackleGainRight.gain.cancelScheduledValues(audioCtx.currentTime);
    crackleGainRight.gain.setValueAtTime(crackleVolume, audioCtx.currentTime);
    crackleGainRight.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeTime);

    await new Promise(resolve => setTimeout(resolve, fadeTime * 1000));

    // binaural beats osc
    binauralLeftOsc.stop();
    binauralRightOsc.stop();

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

    // crackle nodes
    crackleNodeLeft.port.postMessage('stop');
    crackleNodeLeft.disconnect();
    crackleNodeRight.port.postMessage('stop');
    crackleNodeRight.disconnect();

    stereoPanner.disconnect();

    analyser.disconnect();

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
            cancelAnimationFrame(draw);
            document.getElementById('startStopButton').textContent = 'Start';
        });
    } else {
        start_noise().then(() => {
            draw();
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
        await audioCtx.audioWorklet.addModule('crackle-worklet.js');
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
        gainSlider.oninput = function () {
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
        eqBand.filter.gain.setValueAtTime(-6, audioCtx.currentTime);
        eqBands.push(eqBand);
    }
}

function updateEqBandGain(bandIndex, value) {
    let gain = parseFloat(value);
    eqBands[bandIndex].filter.gain.setValueAtTime(gain, audioCtx.currentTime);
}

//
// Drawing
//
function draw() {

    if (!analyser) {
        return;
    }

    requestAnimationFrame(draw);

    const canvas = document.getElementById('analyzerCanvas');
    const canvasCtx = canvas.getContext('2d');
    canvasCtx.fillStyle = "rgb(200 200 200)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0 0 0)";
    canvasCtx.beginPath();

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
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

// Binaural Beats
function updateBinauralBeatsVolume(value) {
    binauralBeatsVolume = parseFloat(value);
    document.getElementById('binauralBeatsVolumeValue').textContent = binauralBeatsVolume.toFixed(2);
    if (binauralGainLeft && binauralGainRight) {
        binauralGainLeft.gain.setValueAtTime(binauralBeatsVolume, audioCtx.currentTime);
        binauralGainRight.gain.setValueAtTime(binauralBeatsVolume, audioCtx.currentTime);
    }
}

function updateBinauralBeatsCarrierFrequency(value) {
    binauralFrequency = parseFloat(value);
    document.getElementById('binauralBeatsCarrierFreqValue').textContent = binauralFrequency.toFixed(2);
    if (binauralLeftOsc && binauralRightOsc) {
        binauralLeftOsc.frequency.setValueAtTime(binauralFrequency, audioCtx.currentTime);
        binauralRightOsc.frequency.setValueAtTime(binauralFrequency + binauralBeatFrequency, audioCtx.currentTime);
    }
}

function updateBinauralBeatsBeatFrequency(value) {
    binauralBeatFrequency = parseFloat(value);
    document.getElementById('binauralBeatsBeatFreqValue').textContent = binauralBeatFrequency.toFixed(2);
    if (binauralRightOsc) {
        binauralRightOsc.frequency.setValueAtTime(binauralFrequency + binauralBeatFrequency, audioCtx.currentTime);
    }
}

// Crackle
function updateCrackleVolume(value) {
    crackleVolume = parseFloat(value);
    document.getElementById('crackleVolumeValue').textContent = crackleVolume.toFixed(2);
    if (crackleGainLeft && crackleGainRight) {
        crackleGainLeft.gain.setValueAtTime(crackleVolume, audioCtx.currentTime);
        crackleGainRight.gain.setValueAtTime(crackleVolume, audioCtx.currentTime);
    }
}

function updateCrackleRate(value) {
    crackleRate = parseFloat(value);
    document.getElementById('crackleRateValue').textContent = crackleRate.toFixed(2);
    if (crackleNodeLeft && crackleNodeRight) {
        crackleNodeLeft.port.postMessage({ type: 'updateRate', rate: crackleRate });
        crackleNodeRight.port.postMessage({ type: 'updateRate', rate: crackleRate });
    }
}