// speechSynthesis + captions. Exposes `level` (0..1 mouth openness) driven by word-boundary events,
// with a synthetic syllable fallback when boundaries are not fired (some browsers/voices).
export class Voice {
  constructor(onCaption) { this.onCaption = onCaption; this.enabled = true; this.last = -1e9; this.synth = globalThis.speechSynthesis;
    this.speakingUntil = 0; this.pulse = 0; this.gotBoundary = false; }
  pickVoice() { if (!this.synth) return null; const vs = this.synth.getVoices(); return vs.find(v=>/en-GB/i.test(v.lang)) || vs.find(v=>/^en/i.test(v.lang)) || null; }
  say(text, important = false) {
    if (!text) return false; const now = performance.now();
    if (!important && now - this.last < 6000) return false;
    this.last = now; this.onCaption(text);
    this.speakingUntil = now + text.split(' ').length * 330 + 300; this.gotBoundary = false;
    if (!this.enabled || !this.synth) return true;
    try { this.synth.cancel(); const u = new SpeechSynthesisUtterance(text); const v = this.pickVoice(); if (v) u.voice = v; u.rate = 1.05; u.pitch = 0.8;
      u.onboundary = () => { this.gotBoundary = true; this.pulse = 1; };
      u.onend = () => { this.speakingUntil = performance.now(); };
      this.synth.speak(u); } catch {}
    return true;
  }
  /** call each frame; returns mouth openness 0..1 */
  level(dt) {
    const now = performance.now(); if (now > this.speakingUntil) { this.pulse = 0; return 0; }
    if (!this.gotBoundary) return 0.25 + 0.35 * Math.abs(Math.sin(now / 75)) * (0.6 + 0.4*Math.sin(now/310)); // syllable-ish fallback
    this.pulse = Math.max(0, this.pulse - dt * 5); return 0.15 + 0.8 * this.pulse * (0.7 + 0.3*Math.sin(now/40));
  }
}
