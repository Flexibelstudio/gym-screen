class SoundEngine {
    private ctx: AudioContext | null = null;

    private init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    private playTone(freq: number, type: OscillatorType, duration: number, volume: number, slideDown = false) {
        try {
            const ctx = this.init();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            if (slideDown) {
                osc.frequency.exponentialRampToValueAtTime(freq / 2, ctx.currentTime + duration);
            }
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.error("Audio error", e);
        }
    }

    private playNoise(duration: number, volume: number) {
        try {
            const ctx = this.init();
            const bufferSize = ctx.sampleRate * duration;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1500;
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            
            noise.start();
        } catch (e) {
            console.error("Audio error", e);
        }
    }

    cardFlip() {
        this.playNoise(0.1, 0.3);
        this.playTone(400, 'sine', 0.1, 0.2, true);
    }

    diceRoll() {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                this.playTone(600 + Math.random() * 400, 'triangle', 0.05, 0.1, true);
                this.playNoise(0.05, 0.1);
            }, i * 100 + Math.random() * 50);
        }
    }

    mechanicalSpin(durationMs: number) {
        let elapsed = 0;
        let tickInterval = 50; 
        
        const tick = () => {
            if (elapsed >= durationMs) return;
            this.playTone(800, 'square', 0.02, 0.02);
            
            const progress = elapsed / durationMs;
            tickInterval = 50 + (progress * progress * 200); 
            
            elapsed += tickInterval;
            setTimeout(tick, tickInterval);
        };
        
        tick();
    }
    
    clunk() {
        this.playTone(200, 'square', 0.15, 0.1, true);
    }

    success() {
        try {
            const ctx = this.init();
            const notes = [523.25, 659.25, 783.99, 1046.50]; 
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                
                const startTime = ctx.currentTime + i * 0.1;
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.4);
            });
        } catch (e) {
            console.error("Audio error", e);
        }
    }
}

export const sounds = new SoundEngine();
