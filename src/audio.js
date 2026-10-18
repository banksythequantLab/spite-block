// All sound is synthesized with WebAudio at runtime: no sample files, no licensed assets.
export class Audio {
  constructor() { this.ctx = null; this.sfxOn = true; this.musicOn = true; this.musicTimer = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return false;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.16; this.music.connect(this.master);
    // tiny feedback-delay "room" for the music
    const d = c.createDelay(); d.delayTime.value = 0.28; const fb = c.createGain(); fb.gain.value = 0.3;
    this.music.connect(d); d.connect(fb); fb.connect(d); d.connect(this.master);
    const len = c.sampleRate * 0.5; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const ch = this.noiseBuf.getChannelData(0); for (let i=0;i<len;i++) ch[i] = Math.random()*2-1;
    if (this.musicOn) this.startMusic();
    return true;
  }
  tone({ f=440, f2=null, type='sine', t=0.15, v=0.3, at=0, dest=null, attack=0.005 }) {
    if (!this.ctx || (!dest && !this.sfxOn)) return; const c = this.ctx, now = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20,f2), now + t);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(v, now + attack); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    o.connect(g); g.connect(dest || this.sfx); o.start(now); o.stop(now + t + 0.05);
  }
  noise({ t=0.1, v=0.3, freq=2000, q=1, type='bandpass', at=0, dest=null, f2=null }) {
    if (!this.ctx || (!dest && !this.sfxOn)) return; const c = this.ctx, now = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, now); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + t);
    const g = c.createGain(); g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfx); s.start(now); s.stop(now + t + 0.05);
  }
  play(name, n = 1) {
    if (!this.ctx) return;
    switch (name) {
      case 'move': this.tone({ f: 1800, type: 'triangle', t: 0.03, v: 0.08 }); break;
      case 'rotate': this.tone({ f: 600, f2: 900, type: 'triangle', t: 0.07, v: 0.1 }); this.noise({ t: 0.05, v: 0.05, freq: 4000 }); break;
      case 'slam': this.tone({ f: 140, f2: 40, type: 'sine', t: 0.3, v: 0.7 }); this.noise({ t: 0.18, v: 0.35, freq: 600, type: 'lowpass' }); break;
      case 'lock': this.tone({ f: 220, f2: 120, type: 'sine', t: 0.08, v: 0.2 }); break;
      case 'clear': { const base = [523.25, 659.25, 783.99, 1046.5]; for (let i=0;i<Math.min(4,n)+2;i++) this.tone({ f: base[i%4] * (1 + 0.5*Math.floor(i/4)) * (1 + 0.06*(n-1)), type: 'sine', t: 0.6, v: 0.18, at: i*0.06 }); this.noise({ t: 0.5, v: 0.15, freq: 6000, f2: 1500 }); break; }
      case 'veto': this.tone({ f: 90, f2: 50, t: 0.15, v: 0.6 }); this.noise({ t: 0.08, v: 0.5, freq: 1200 }); this.tone({ f: 880, type: 'square', t: 0.12, v: 0.06, at: 0.1 }); break;
      case 'vetoFail': this.tone({ f: 300, f2: 150, type: 'sawtooth', t: 0.35, v: 0.12 }); break;
      case 'rageCharge': this.tone({ f: 200, f2: 1200, type: 'sawtooth', t: 0.6, v: 0.08 }); break;
      case 'rageFire': this.noise({ t: 0.35, v: 0.4, freq: 300, f2: 4000 }); this.tone({ f: 900, f2: 200, type: 'square', t: 0.3, v: 0.08 }); break;
      case 'stun': this.tone({ f: 180, f2: 700, type: 'sine', t: 0.25, v: 0.35 }); this.tone({ f: 700, f2: 160, type: 'sine', t: 0.4, v: 0.3, at: 0.22 }); break;
      case 'envelope': this.noise({ t: 0.2, v: 0.12, freq: 3000, f2: 800 }); this.tone({ f: 330, f2: 247, type: 'triangle', t: 0.4, v: 0.1, at: 0.1 }); break;
      case 'gameOver': [392, 349.2, 329.6, 261.6].forEach((f,i)=>this.tone({ f, type: 'triangle', t: 0.55, v: 0.18, at: i*0.32 })); break;
    }
  }
  setMusic(on) { this.musicOn = on; if (!this.ctx) return; if (on) this.startMusic(); else { clearInterval(this.musicTimer); this.musicTimer = null; } }
  // light lounge loop: ii-V-I-vi with soft electric-piano chords, walking bass, brushed hats
  startMusic() {
    if (this.musicTimer) return; const c = this.ctx; const bpm = 92, beat = 60/bpm; let bar = 0, next = c.currentTime + 0.1;
    const chords = [[293.7,349.2,440,523.3],[196,246.9,293.7,349.2],[261.6,329.6,392,493.9],[220,261.6,329.6,392]];
    const bass = [[73.4,87.3,110,98],[49,61.7,73.4,82.4],[65.4,82.4,98,110],[55,65.4,82.4,61.7]];
    const schedule = () => {
      while (next < c.currentTime + 1.2) {
        const ch = chords[bar % 4], at = next - c.currentTime;
        ch.forEach(f => { this.tone({ f, type: 'sine', t: beat*1.6, v: 0.05, at, dest: this.music, attack: 0.02 }); this.tone({ f: f*2, type: 'triangle', t: beat*0.8, v: 0.012, at, dest: this.music }); });
        ch.forEach(f => this.tone({ f, type: 'sine', t: beat*1.2, v: 0.03, at: at + beat*2.5, dest: this.music, attack: 0.02 }));
        bass[bar % 4].forEach((f,i) => this.tone({ f, type: 'triangle', t: beat*0.9, v: 0.14, at: at + i*beat, dest: this.music, attack: 0.01 }));
        for (let i=0;i<8;i++) this.noise({ t: 0.06, v: i%2 ? 0.02 : 0.035, freq: 7000, q: 0.7, type: 'highpass', at: at + i*beat/2 + (i%2 ? beat*0.08 : 0), dest: this.music });
        next += beat*4; bar++;
      }
    };
    schedule(); this.musicTimer = setInterval(schedule, 400);
  }
}
