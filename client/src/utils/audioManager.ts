class AudioManager {
  private context: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private volume: number = 0.3;
  private muted: boolean = false;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext(): void {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.log('Web Audio API not supported');
    }
  }

  private createBeepSound(frequency: number, duration: number): AudioBuffer | null {
    if (!this.context) return null;

    const sampleRate = this.context.sampleRate;
    const frameCount = sampleRate * duration;
    const buffer = this.context.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 3);
      const wave = Math.sin(2 * Math.PI * frequency * t) * 0.3 + 
                   Math.sin(2 * Math.PI * frequency * 1.5 * t) * 0.1;
      data[i] = wave * envelope * this.volume;
    }

    return buffer;
  }

  private createDrumSound(type: 'kick' | 'snare'): AudioBuffer | null {
    if (!this.context) return null;

    const sampleRate = this.context.sampleRate;
    const frameCount = sampleRate * 0.3;
    const buffer = this.context.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 10);
      
      if (type === 'kick') {
        const freq = 60 * Math.exp(-t * 20);
        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * this.volume * 0.8;
      } else {
        const noise = (Math.random() - 0.5) * 2;
        const tone = Math.sin(2 * Math.PI * 200 * t);
        data[i] = (noise * 0.7 + tone * 0.3) * envelope * this.volume * 0.6;
      }
    }

    return buffer;
  }

  public initSounds(): void {
    if (!this.context) return;

    this.sounds.set('ui_hover', this.createBeepSound(800, 0.1)!);
    this.sounds.set('ui_click', this.createBeepSound(1200, 0.15)!);
    this.sounds.set('ui_error', this.createBeepSound(300, 0.4)!);
    this.sounds.set('ui_success', this.createBeepSound(600, 0.3)!);
    
    this.sounds.set('food_eat', this.createBeepSound(1500, 0.1)!);
    this.sounds.set('food_golden', this.createBeepSound(2000, 0.2)!);
    this.sounds.set('player_join', this.createBeepSound(900, 0.25)!);
    this.sounds.set('player_leave', this.createBeepSound(400, 0.3)!);
    this.sounds.set('game_start', this.createDrumSound('kick')!);
    this.sounds.set('game_end', this.createDrumSound('snare')!);
    this.sounds.set('collision', this.createBeepSound(150, 0.5)!);
    
    this.sounds.set('room_create', this.createBeepSound(1100, 0.2)!);
    this.sounds.set('room_join', this.createBeepSound(750, 0.2)!);
    this.sounds.set('code_copy', this.createBeepSound(1800, 0.1)!);
    
    this.sounds.set('golden_warning', this.createBeepSound(1000, 0.1)!);
  }

  public play(soundName: string): void {
    if (!this.context || this.muted || !this.sounds.has(soundName)) return;

    const buffer = this.sounds.get(soundName);
    if (!buffer) return;

    try {
      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();
      
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(this.context.destination);
      gainNode.gain.value = this.volume;
      
      source.start(0);
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  }

  public resume(): void {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }
}

export const audioManager = new AudioManager();

let isInitialized = false;
export const initAudio = () => {
  if (!isInitialized) {
    audioManager.resume();
    audioManager.initSounds();
    isInitialized = true;
  }
}; 