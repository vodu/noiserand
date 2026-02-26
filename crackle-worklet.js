class CrackleProcessor extends AudioWorkletProcessor {
    
    static get parameterDescriptors() {
        return [
            {
                name: 'rate',
                defaultValue: 5,
                minValue: 0,
                maxValue: 100,
                automationRate: 'k-rate'
            },
            {
                name: 'decayTime',
                defaultValue: 0.001,
                minValue: 0.001,
                maxValue: 0.1,
                automationRate: 'k-rate'
            }
        ];
    }

    constructor() {
        super();
        this.rate = 5; // impulses per second
        this.decayTime = 0.001; // seconds
        this.currentValue = 0; // current output value
        this.decayCoeff = 0.999;
        this.ampValue = 1.0;

        this.port.onmessage = (event) => {
            if (event.data.type === 'updateRate') {
                this.rate = event.data.rate;
            } else if (event.data.type === 'updateDecay') {
                this.decayTime = event.data.decayTime;
            }
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        const probability = this.rate / sampleRate;
        
        // Exponential decay coefficient
        this.decayCoeff = Math.exp(-1 / (this.decayTime * sampleRate));

        for (let channel = 0; channel < output.length; ++channel) {
            for (let i = 0; i < output[channel].length; ++i) {
                
                if(Math.random() < probability) {
                    // this.ampValue = this.ampValue * -1.0; // flip sign for alternating crackle
                    this.ampValue = Math.random() * 4 - 2; // random amplitude between -2 and 2 for more variation
                    this.currentValue += this.ampValue;
                }
                this.currentValue *= this.decayCoeff;
                output[channel][i] = this.currentValue;
            }
        }
        return true;
    }
}

registerProcessor('crackle-processor', CrackleProcessor);