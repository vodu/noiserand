class GranularProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() {
            return [
                {
                    name: 'position', // 0 to 1, relative position in the buffer
                    defaultValue: 0.5,
                    minValue: 0,
                    maxValue: 1,
                },
                {
                    name: 'grainSize', // in seconds
                    defaultValue: 0.1,
                    minValue: 0.01,
                    maxValue: 1,
                },
                {
                    name: 'density', // grains per second
                    defaultValue: 10,
                    minValue: 1,
                    maxValue: 100,
                },
                {
                    name: 'spread', // 0 to 0.5, how much to randomize grain start position around the target position
                    defaultValue: 0.01,
                    minValue: 0,
                    maxValue: 0.5,
                }
            ];
        }
    
        constructor() {
            super();

            this.buffer = null;
            this.bufferLength = 0;
            this.sampleRate = sampleRate;

            this.samplesUntilNextGrain = 0; // sampler counter for when to spawn the next grain
            this.maxNumGrains = 200;
            this.grains = new Array(this.maxNumGrains).fill(null).map(() => ({
                active: false,
                position: 0, // position in the audio buffer
                start: 0,
                duration: 0,
            }));

            // Parameters
            // Get default values from the static parameterDescriptors
            const descriptors = GranularProcessor.parameterDescriptors;
            this.position = descriptors.find(p => p.name === 'position').defaultValue;
            this.grainSize = descriptors.find(p => p.name === 'grainSize').defaultValue;
            this.density = descriptors.find(p => p.name === 'density').defaultValue;
            this.spread = descriptors.find(p => p.name === 'spread').defaultValue;

            this.port.onmessage = (event) => {
                if (event.data.type === 'updatePosition') {
                    this.position = event.data.position;
                } else if (event.data.type === 'loadBuffer') {
                    this.buffer = event.data.channels;
                    this.bufferLength = event.data.length;
                    this.sampleRate = event.data.sampleRate;
                } else if (event.data.type === 'updateGrainSize') {
                    this.grainSize = event.data.grainSize;
                } else if (event.data.type === 'updateDensity') {
                    this.density = event.data.density;
                } else if (event.data.type === 'updateSpread') {
                    this.spread = event.data.spread;
                }
            };
        }

        spawnGrain(positionSamples, grainSizeSamples) {
            if (!this.buffer) { return; }

            const spreadSamples = Math.floor(this.bufferLength * this.spread);
            // Randomize start position within spread around the target position
            let newPosition = Math.floor(positionSamples + (Math.random() * 2 - 1) * spreadSamples);
            newPosition = Math.max(0, Math.min(this.bufferLength - grainSizeSamples, newPosition)); // clamp to valid range

            for (let grain of this.grains) {
                if (!grain.active) {
                    grain.active = true;
                    grain.position = newPosition;
                    grain.start = 0;
                    grain.duration = grainSizeSamples;
                    break;
                }
                // console.warn('Max grains reached, skipping grain spawn');
            }
        }

        process(inputs, outputs, parameters) {
            const output = outputs[0];
            const left = output[0];
            const right = output[1] || left; // if mono, duplicate to right
            left.fill(0);
            right.fill(0);

            if (!this.buffer) {return true;}

            const grainSizeSamples = Math.floor(this.grainSize * this.sampleRate);
            const positionSamples = Math.floor(this.bufferLength * this.position);
            const spawnIntervalSamples = Math.floor(this.sampleRate / this.density);

            for (let i = 0; i < left.length; i++) {

                // spawn new grain if it's time
                if (this.samplesUntilNextGrain <= 0) {
                    this.spawnGrain(positionSamples, grainSizeSamples);
                    this.samplesUntilNextGrain = spawnIntervalSamples;
                }
                this.samplesUntilNextGrain--;

                // Process active grains
                for (let grain of this.grains) {
                    if (grain.active) {
                        // track grain position in the buffer and apply envelope
                        const grainStartPos = grain.position;
                        const readPos = grainStartPos + grain.start;
                        const idx = Math.floor(readPos);
                        // Apply a Hanning window to the grain for smooth fade in/out
                        const env = 0.5 - 0.5 * Math.cos((2 * Math.PI * grain.start) / grain.duration);
                        if (idx < this.bufferLength) {
                            left[i] += this.buffer[0][idx] * env;
                            right[i] += this.buffer[1][idx] * env;
                            grain.start++;
                            if (grain.start >= grain.duration) {
                                grain.start = 0;
                                grain.position = 0;
                                grain.duration = 0;
                                grain.active = false;
                            }
                        } 
                    }
                }

            }
            return true;
        }
}

registerProcessor('granular-processor', GranularProcessor);
