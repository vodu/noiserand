class WhiteNoiseProcessor extends AudioWorkletProcessor {

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        for (let channel = 0; channel < output.length; ++channel) {
            for (let i = 0; i < output[channel].length; ++i) {
                output[channel][i] = Math.random() * 2 - 1;
            }
        }
        return true;
    }
}

registerProcessor('white-noise-processor', WhiteNoiseProcessor);

class PinkNoiseProcessor extends AudioWorkletProcessor {
    
    constructor() {
        super();
        this.b0 = 0;
        this.b1 = 0;
        this.b2 = 0;
        this.b3 = 0;
        this.b4 = 0;
        this.b5 = 0;
        this.b6 = 0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        for (let channel = 0; channel < output.length; ++channel) {
            for (let i = 0; i < output[channel].length; ++i) {
                let white = Math.random() * 2 - 1;
                this.b0 = 0.99886 * this.b0 + white * 0.0555179;
                this.b1 = 0.99332 * this.b1 + white * 0.0750759;
                this.b2 = 0.96900 * this.b2 + white * 0.1538520;
                this.b3 = 0.86650 * this.b3 + white * 0.3104856;
                this.b4 = 0.55000 * this.b4 + white * 0.5329522;
                this.b5 = -0.7616 * this.b5 - white * 0.0168980;
                output[channel][i] = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
                output[channel][i] *= 0.11; // (roughly) compensate for gain
                this.b6 = white * 0.115926;
            }
        }
        return true;
    }
    
}

registerProcessor('pink-noise-processor', PinkNoiseProcessor);

class BrownNoiseProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.lastOut = 0.0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        for (let channel = 0; channel < output.length; ++channel) {
            for (let i = 0; i < output[channel].length; ++i) {
                let white = Math.random() * 2 - 1;
                output[channel][i] = (this.lastOut + (0.02 * white)) / 1.02;
                this.lastOut = output[channel][i];
                output[channel][i] *= 3.5; // (roughly) compensate for gain
            }
        }
        return true
    }
}

registerProcessor('brown-noise-processor', BrownNoiseProcessor);
