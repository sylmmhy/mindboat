import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export const useAudio = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2); // Start at 20%
  const noiseRef = useRef<Tone.Noise | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const gainRef = useRef<Tone.Gain | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Initialize audio context and create ambient ocean sounds
    const initAudio = async () => {
      try {
        if (isInitialized.current) return;
        
        // Create noise generator for ocean waves
        noiseRef.current = new Tone.Noise('pink');
        
        // Create filter to shape the sound
        filterRef.current = new Tone.Filter({
          frequency: 800,
          type: 'lowpass',
          rolloff: -24
        });
        
        // Create gain control - this is our main volume control
        gainRef.current = new Tone.Gain(0); // Start muted
        
        // Connect the audio chain: Noise → Filter → Gain → Destination
        noiseRef.current
          .connect(filterRef.current)
          .connect(gainRef.current)
          .toDestination();
        
        isInitialized.current = true;
        console.log('Audio system initialized');
          
      } catch (error) {
        console.warn('Audio initialization failed:', error);
      }
    };

    initAudio();

    return () => {
      // Cleanup
      if (noiseRef.current) {
        noiseRef.current.dispose();
        noiseRef.current = null;
      }
      if (filterRef.current) {
        filterRef.current.dispose();
        filterRef.current = null;
      }
      if (gainRef.current) {
        gainRef.current.dispose();
        gainRef.current = null;
      }
      isInitialized.current = false;
    };
  }, []);

  const startAmbientSound = useCallback(async () => {
    try {
      if (!isInitialized.current || !noiseRef.current || isPlaying) {
        return;
      }

      // Start Tone.js context
      await Tone.start();
      console.log('Tone.js context started');
      
      // Start the noise
      noiseRef.current.start();
      setIsPlaying(true);
      
      // Apply current volume setting
      updateVolume(volume);
      console.log('Ambient sound started with volume:', volume);
      
    } catch (error) {
      console.warn('Failed to start ambient sound:', error);
    }
  }, [volume, isPlaying]);

  const stopAmbientSound = useCallback(() => {
    try {
      if (noiseRef.current && isPlaying) {
        noiseRef.current.stop();
        setIsPlaying(false);
        console.log('Ambient sound stopped');
      }
    } catch (error) {
      console.warn('Failed to stop ambient sound:', error);
    }
  }, [isPlaying]);

  const updateVolume = useCallback((newVolume: number) => {
    if (!gainRef.current) {
      console.warn('Gain node not available');
      return;
    }

    try {
      if (newVolume === 0) {
        // Completely mute
        gainRef.current.gain.rampTo(0, 0.1);
        console.log('Audio muted');
      } else {
        // Scale volume: 0.1 to 1 becomes 0.05 to 0.3 gain
        const gainValue = 0.05 + (newVolume * 0.25);
        gainRef.current.gain.rampTo(gainValue, 0.1);
        console.log('Volume set to:', newVolume, 'Gain:', gainValue);
      }
    } catch (error) {
      console.warn('Failed to update volume:', error);
    }
  }, []);

  const adjustVolume = useCallback((newVolume: number) => {
    console.log('Adjusting volume from', volume, 'to', newVolume);
    setVolume(newVolume);
    updateVolume(newVolume);
  }, [volume, updateVolume]);

  const setWeatherMood = useCallback((mood: 'sunny' | 'cloudy' | 'rainy' | 'stormy') => {
    if (!filterRef.current) return;

    try {
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
      console.log('Weather mood set to:', mood);
    } catch (error) {
      console.warn('Failed to set weather mood:', error);
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