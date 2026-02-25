class CrackleProcessor extends AudioWorkletProcessor {
    
    static get parameterDescriptors() {
        return [
            {
                name: 'rate',
                defaultValue: 5,
                minValue: 0,
                maxValue: 100,
                automationRate: 'k-rate'
            }];
    }

    constructor() {
        super();
        this.rate = 5; // impulses per second

        this.port.onmessage = (event) => {
            if (event.data.type === 'updateRate') {
                this.rate = event.data.rate;
            }
        }
    }

    updateRate(newRate) {
        this.rate = newRate;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        const probability = this.rate / sampleRate;

        for (let channel = 0; channel < output.length; ++channel) {
            for (let i = 0; i < output[channel].length; ++i) {
                
                if(Math.random() < probability) {
                    output[channel][i] = 1; // impulse
                }
            }
        }
        return true;
    }
}

registerProcessor('crackle-processor', CrackleProcessor);