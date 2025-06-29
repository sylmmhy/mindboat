/**
 * Voice Interaction Hook
 * 
 * Manages voice-based interactions for distraction alerts,
 * exploration mode, and inspiration capture.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceService } from '../services/VoiceService';
import { useNotificationStore } from '../stores/notificationStore';

interface UseVoiceInteractionProps {
  isVoyageActive: boolean;
  isExploring: boolean;
  onDistractionResponse?: (response: 'return_to_course' | 'exploring') => void;
  onInspirationCaptured?: (content: string, type: 'voice' | 'text') => void;
}

export const useVoiceInteraction = ({
  isVoyageActive,
  isExploring,
  onDistractionResponse,
  onInspirationCaptured
}: UseVoiceInteractionProps) => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(VoiceService.getStatus());
  
  const { showError, showSuccess } = useNotificationStore();
  const initializationAttempted = useRef(false);

  // Initialize voice service
  useEffect(() => {
    const initializeVoice = async () => {
      if (initializationAttempted.current) return;
      initializationAttempted.current = true;

      console.log('🎤 [VOICE] Initializing voice service...');

      try {
        const initialized = await VoiceService.initialize();
        const status = VoiceService.getStatus();
        
        console.log('🎤 [VOICE] Initialization result:', {
          initialized,
          status,
          speechRecognition: status.features.speechRecognition,
          elevenLabs: status.features.elevenLabs,
          fullFeatures: status.features.fullFeatures
        });

        setIsVoiceEnabled(initialized && status.features.speechRecognition);
        setVoiceStatus(status);

        if (initialized && status.features.fullFeatures) {
          showSuccess('Voice assistant ready with full features', 'AI Voice');
          console.log('🎤 [VOICE] ✅ Full voice features available');
        } else if (status.features.speechRecognition) {
          showSuccess('Voice recognition ready (AI voice needs API key)', 'Voice Features');
          console.log('🎤 [VOICE] ⚠️ Speech recognition only - ElevenLabs API key needed for AI voice');
        } else {
          console.log('🎤 [VOICE] ❌ Voice features not available');
        }
      } catch (error) {
        console.error('🎤 [VOICE] Initialization failed:', error);
        showError('Voice feature initialization failed', 'Voice Assistant');
      }
    };

    if (isVoyageActive) {
      initializeVoice();
    }
  }, [isVoyageActive, showError, showSuccess]);

  // Handle distraction alert with voice
  const handleVoiceDistractionAlert = useCallback(async (distractionType: string) => {
    console.log('🎤 [VOICE] Distraction alert triggered:', {
      distractionType,
      isVoiceEnabled,
      hasCallback: !!onDistractionResponse,
      voiceStatus: voiceStatus.features
    });

    if (!isVoiceEnabled || !onDistractionResponse) {
      console.log('🎤 [VOICE] Voice alert skipped - not enabled or no callback');
      return false;
    }

    try {
      setIsSpeaking(true);
      console.log('🎤 [VOICE] Starting voice distraction alert...');
      
      await VoiceService.handleDistractionAlert(distractionType, (response) => {
        console.log('🎤 [VOICE] Voice response received:', response);
        onDistractionResponse(response);
        setIsSpeaking(false);
      });

      console.log('🎤 [VOICE] ✅ Voice alert initiated successfully');
      return true;
    } catch (error) {
      console.error('🎤 [VOICE] Voice distraction alert failed:', error);
      setIsSpeaking(false);
      return false;
    }
  }, [isVoiceEnabled, onDistractionResponse, voiceStatus]);

  // Capture voice inspiration
  const captureVoiceInspiration = useCallback(async () => {
    if (!isVoiceEnabled || !onInspirationCaptured) return null;

    try {
      setIsListening(true);
      console.log('🎤 [VOICE] Starting voice inspiration capture...');
      
      const inspiration = await VoiceService.captureVoiceInspiration();
      
      if (inspiration) {
        onInspirationCaptured(inspiration, 'voice');
        showSuccess('Voice inspiration recorded', 'Sailing Log');
        console.log('🎤 [VOICE] ✅ Voice inspiration captured:', inspiration);
        return inspiration;
      }
      
      console.log('🎤 [VOICE] No inspiration captured');
      return null;
    } catch (error) {
      console.error('🎤 [VOICE] Voice inspiration capture failed:', error);
      showError('Voice recording failed, please try again', 'Recording Error');
      return null;
    } finally {
      setIsListening(false);
    }
  }, [isVoiceEnabled, onInspirationCaptured, showError, showSuccess]);

  // Announce voyage completion
  const announceVoyageCompletion = useCallback(async (destinationName: string, duration: string) => {
    if (!isVoiceEnabled) return;

    try {
      setIsSpeaking(true);
      console.log('🎤 [VOICE] Announcing voyage completion...');
      await VoiceService.announceVoyageCompletion(destinationName, duration);
      console.log('🎤 [VOICE] ✅ Voyage completion announced');
    } catch (error) {
      console.error('🎤 [VOICE] Voyage completion announcement failed:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, [isVoiceEnabled]);

  // Stop all voice activities
  const stopVoiceActivities = useCallback(() => {
    VoiceService.stopListening();
    setIsListening(false);
    setIsSpeaking(false);
    console.log('🎤 [VOICE] All voice activities stopped');
  }, []);

  // Update voice status periodically
  useEffect(() => {
    if (!isVoyageActive) return;

    const interval = setInterval(() => {
      const newStatus = VoiceService.getStatus();
      setVoiceStatus(newStatus);
      
      // Update voice enabled state based on current status
      setIsVoiceEnabled(newStatus.initialized && newStatus.features.speechRecognition);
    }, 2000);

    return () => clearInterval(interval);
  }, [isVoyageActive]);

  // Cleanup on unmount or voyage end
  useEffect(() => {
    if (!isVoyageActive) {
      stopVoiceActivities();
    }
  }, [isVoyageActive, stopVoiceActivities]);

  // Debug logging for voice state changes
  useEffect(() => {
    console.log('🎤 [VOICE] State update:', {
      isVoiceEnabled,
      isListening,
      isSpeaking,
      isVoyageActive,
      isExploring,
      features: voiceStatus.features
    });
  }, [isVoiceEnabled, isListening, isSpeaking, isVoyageActive, isExploring, voiceStatus]);

  return {
    isVoiceEnabled,
    isListening,
    isSpeaking,
    voiceStatus,
    handleVoiceDistractionAlert,
    captureVoiceInspiration,
    announceVoyageCompletion,
    stopVoiceActivities
  };
};