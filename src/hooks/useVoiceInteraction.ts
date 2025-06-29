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

      try {
        const initialized = await VoiceService.initialize();
        setIsVoiceEnabled(initialized);
        setVoiceStatus(VoiceService.getStatus());

        if (initialized && voiceStatus.features.fullFeatures) {
          showSuccess('语音助手已就绪', 'AI语音功能');
        } else if (voiceStatus.features.speechRecognition) {
          showSuccess('语音识别已就绪', '部分语音功能');
        }
      } catch (error) {
        console.error('Voice initialization failed:', error);
        showError('语音功能初始化失败', '语音助手');
      }
    };

    if (isVoyageActive) {
      initializeVoice();
    }
  }, [isVoyageActive, showError, showSuccess]);

  // Handle distraction alert with voice
  const handleVoiceDistractionAlert = useCallback(async (distractionType: string) => {
    if (!isVoiceEnabled || !onDistractionResponse) return false;

    try {
      setIsSpeaking(true);
      
      await VoiceService.handleDistractionAlert(distractionType, (response) => {
        onDistractionResponse(response);
        setIsSpeaking(false);
      });

      return true;
    } catch (error) {
      console.error('Voice distraction alert failed:', error);
      setIsSpeaking(false);
      return false;
    }
  }, [isVoiceEnabled, onDistractionResponse]);

  // Capture voice inspiration
  const captureVoiceInspiration = useCallback(async () => {
    if (!isVoiceEnabled || !onInspirationCaptured) return null;

    try {
      setIsListening(true);
      const inspiration = await VoiceService.captureVoiceInspiration();
      
      if (inspiration) {
        onInspirationCaptured(inspiration, 'voice');
        showSuccess('语音灵感已记录', '航海日志');
        return inspiration;
      }
      
      return null;
    } catch (error) {
      console.error('Voice inspiration capture failed:', error);
      showError('语音录制失败，请重试', '录音错误');
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
      await VoiceService.announceVoyageCompletion(destinationName, duration);
    } catch (error) {
      console.error('Voyage completion announcement failed:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, [isVoiceEnabled]);

  // Stop all voice activities
  const stopVoiceActivities = useCallback(() => {
    VoiceService.stopListening();
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  // Update voice status periodically
  useEffect(() => {
    if (!isVoyageActive) return;

    const interval = setInterval(() => {
      setVoiceStatus(VoiceService.getStatus());
    }, 2000);

    return () => clearInterval(interval);
  }, [isVoyageActive]);

  // Cleanup on unmount or voyage end
  useEffect(() => {
    if (!isVoyageActive) {
      stopVoiceActivities();
    }
  }, [isVoyageActive, stopVoiceActivities]);

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