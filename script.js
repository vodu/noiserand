let audioCtx;
let isRunning;

async function start_noise() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('audioCtx created');
        isRunning = true;
    }
}

async function stop_noise() {
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
        console.log('audioCtx closed');
        isRunning = false;
    }
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
