import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export const useAudio = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.1); // Start at 10%
  const noiseRef = useRef<Tone.Noise | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const volumeRef = useRef<Tone.Volume | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);

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
        
        // Create gain control for better volume management
        gainRef.current = new Tone.Gain(0.1); // Start with low gain
        
        // Create volume control
        volumeRef.current = new Tone.Volume(-60); // Start very quiet
        
        // Connect the audio chain
        noiseRef.current
          .connect(filterRef.current)
          .connect(gainRef.current)
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
      if (gainRef.current) {
        gainRef.current.dispose();
      }
    };
  }, []);

  const startAmbientSound = useCallback(async () => {
    try {
      await Tone.start();
      if (noiseRef.current && !isPlaying) {
        noiseRef.current.start();
        setIsPlaying(true);
        
        // Apply current volume setting
        adjustVolumeInternal(volume);
      }
    } catch (error) {
      console.warn('Failed to start ambient sound:', error);
    }
  }, [volume, isPlaying]);

  const stopAmbientSound = useCallback(() => {
    if (noiseRef.current && isPlaying) {
      noiseRef.current.stop();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const adjustVolumeInternal = useCallback((newVolume: number) => {
    if (gainRef.current && volumeRef.current) {
      if (newVolume === 0) {
        // Completely mute
        gainRef.current.gain.rampTo(0, 0.1);
        volumeRef.current.volume.rampTo(-Infinity, 0.1);
      } else {
        // Scale volume from very quiet to moderate
        const gainValue = newVolume * 0.3; // Max gain of 0.3
        const dbValue = -60 + (newVolume * 30); // Scale from -60dB to -30dB
        
        gainRef.current.gain.rampTo(gainValue, 0.1);
        volumeRef.current.volume.rampTo(dbValue, 0.1);
      }
    }
  }, []);

  const adjustVolume = useCallback((newVolume: number) => {
    console.log('Adjusting volume to:', newVolume); // Debug log
    setVolume(newVolume);
    adjustVolumeInternal(newVolume);
  }, [adjustVolumeInternal]);

  const setWeatherMood = useCallback((mood: 'sunny' | 'cloudy' | 'rainy' | 'stormy') => {
    if (!filterRef.current) return;

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