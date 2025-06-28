import { useCallback, useEffect, useRef, useState } from 'react';

export const useAudio = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2); // Start at 20%
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Create pink noise buffer
  const createNoiseBuffer = useCallback((audioContext: AudioContext) => {
    const bufferSize = audioContext.sampleRate * 2; // 2 seconds of audio
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    // Generate pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    
    return buffer;
  }, []);

  // Initialize audio system
  const initializeAudio = useCallback(async () => {
    try {
      if (audioContextRef.current) {
        return true; // Already initialized
      }

      // Create audio context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create nodes
      gainNodeRef.current = audioContextRef.current.createGain();
      filterNodeRef.current = audioContextRef.current.createBiquadFilter();
      
      // Configure filter for ocean-like sound
      filterNodeRef.current.type = 'lowpass';
      filterNodeRef.current.frequency.value = 800;
      filterNodeRef.current.Q.value = 1;
      
      // Set initial volume (muted)
      gainNodeRef.current.gain.value = 0;
      
      // Connect nodes: Source -> Filter -> Gain -> Destination
      filterNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      // Create noise buffer
      noiseBufferRef.current = createNoiseBuffer(audioContextRef.current);
      
      console.log('Audio system initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      return false;
    }
  }, [createNoiseBuffer]);

  // Start playing audio
  const startAmbientSound = useCallback(async () => {
    try {
      if (isPlaying) return;

      const initialized = await initializeAudio();
      if (!initialized || !audioContextRef.current || !noiseBufferRef.current) {
        console.error('Audio system not properly initialized');
        return;
      }

      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Create and start source node
      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = noiseBufferRef.current;
      sourceNodeRef.current.loop = true;
      sourceNodeRef.current.connect(filterNodeRef.current!);
      
      // Apply current volume
      if (gainNodeRef.current) {
        const gainValue = volume === 0 ? 0 : volume * 0.3; // Scale to reasonable level
        gainNodeRef.current.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
      }
      
      sourceNodeRef.current.start();
      setIsPlaying(true);
      
      console.log('Ambient sound started with volume:', volume);
    } catch (error) {
      console.error('Failed to start ambient sound:', error);
    }
  }, [isPlaying, volume, initializeAudio]);

  // Stop playing audio
  const stopAmbientSound = useCallback(() => {
    try {
      if (!isPlaying || !sourceNodeRef.current) return;

      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
      setIsPlaying(false);
      
      console.log('Ambient sound stopped');
    } catch (error) {
      console.error('Failed to stop ambient sound:', error);
    }
  }, [isPlaying]);

  // Adjust volume
  const adjustVolume = useCallback((newVolume: number) => {
    console.log('Adjusting volume from', volume, 'to', newVolume);
    setVolume(newVolume);
    
    if (gainNodeRef.current && audioContextRef.current) {
      const gainValue = newVolume === 0 ? 0 : newVolume * 0.3; // Scale to reasonable level
      gainNodeRef.current.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
      console.log('Gain set to:', gainValue);
    }
  }, [volume]);

  // Set weather mood by adjusting filter frequency
  const setWeatherMood = useCallback((mood: 'sunny' | 'cloudy' | 'rainy' | 'stormy') => {
    if (!filterNodeRef.current || !audioContextRef.current) return;

    try {
      const currentTime = audioContextRef.current.currentTime;
      
      switch (mood) {
        case 'sunny':
          filterNodeRef.current.frequency.setTargetAtTime(1200, currentTime, 0.5);
          break;
        case 'cloudy':
          filterNodeRef.current.frequency.setTargetAtTime(800, currentTime, 0.5);
          break;
        case 'rainy':
          filterNodeRef.current.frequency.setTargetAtTime(400, currentTime, 0.5);
          break;
        case 'stormy':
          filterNodeRef.current.frequency.setTargetAtTime(200, currentTime, 0.5);
          break;
      }
      console.log('Weather mood set to:', mood);
    } catch (error) {
      console.warn('Failed to set weather mood:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isPlaying,
    volume,
    startAmbientSound,
    stopAmbientSound,
    adjustVolume,
    setWeatherMood,
  };
};