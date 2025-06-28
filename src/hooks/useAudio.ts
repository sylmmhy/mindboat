import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export const useAudio = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const noiseRef = useRef<Tone.Noise | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const volumeRef = useRef<Tone.Volume | null>(null);

  useEffect(() => {
    // Initialize audio context and create ambient ocean sounds
    const initAudio = async () => {
      try {
        // Create noise generator for ocean waves
        noiseRef.current = new Tone.Noise('pink');
        
        // Create filter to shape the sound
        filterRef.current = new Tone.Filter({
          frequency: 800,
          type: 'lowpass',
          rolloff: -24
        });
        
        // Create volume control
        volumeRef.current = new Tone.Volume(-20); // Start quiet
        
        // Connect the audio chain
        noiseRef.current
          .connect(filterRef.current)
          .connect(volumeRef.current)
          .toDestination();
          
      } catch (error) {
        console.warn('Audio initialization failed:', error);
      }
    };

    initAudio();

    return () => {
      // Cleanup
      if (noiseRef.current) {
        noiseRef.current.dispose();
      }
      if (filterRef.current) {
        filterRef.current.dispose();
      }
      if (volumeRef.current) {
        volumeRef.current.dispose();
      }
    };
  }, []);

  const startAmbientSound = useCallback(async () => {
    try {
      await Tone.start();
      if (noiseRef.current) {
        noiseRef.current.start();
        setIsPlaying(true);
      }
    } catch (error) {
      console.warn('Failed to start ambient sound:', error);
    }
  }, []);

  const stopAmbientSound = useCallback(() => {
    if (noiseRef.current) {
      noiseRef.current.stop();
      setIsPlaying(false);
    }
  }, []);

  const adjustVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (volumeRef.current) {
      // Convert 0-1 range to decibels with better scaling
      // Use a more gradual curve for better volume control
      let db;
      if (newVolume === 0) {
        db = -Infinity; // Mute
      } else {
        // Scale from -60dB to -10dB for better control
        db = -60 + (newVolume * 50);
      }
      
      // Use rampTo for smooth volume changes
      volumeRef.current.volume.rampTo(db, 0.1);
    }
  }, []);

  const setWeatherMood = useCallback((mood: 'sunny' | 'cloudy' | 'rainy' | 'stormy') => {
    if (!filterRef.current || !volumeRef.current) return;

    switch (mood) {
      case 'sunny':
        filterRef.current.frequency.rampTo(1200, 1);
        break;
      case 'cloudy':
        filterRef.current.frequency.rampTo(800, 1);
        break;
      case 'rainy':
        filterRef.current.frequency.rampTo(400, 1);
        break;
      case 'stormy':
        filterRef.current.frequency.rampTo(200, 1);
        break;
    }
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