/**
 * Enhanced Distraction Alert with Voice Interaction
 * 
 * Provides both visual and voice-based distraction alerts with
 * intelligent response handling and exploration mode support.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Compass, Mic, Volume2, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useVoiceInteraction } from '../../hooks/useVoiceInteraction';

interface EnhancedDistractionAlertProps {
  isVisible: boolean;
  onResponse: (response: 'return_to_course' | 'exploring') => void;
  distractionType: 'tab_switch' | 'idle' | 'camera_distraction' | 'camera_absence' | 'blacklisted_content' | 'irrelevant_content';
  duration?: number;
  enableVoice?: boolean;
}

export const EnhancedDistractionAlert: React.FC<EnhancedDistractionAlertProps> = ({
  isVisible,
  onResponse,
  distractionType,
  duration,
  enableVoice = true
}) => {
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [voiceResponseReceived, setVoiceResponseReceived] = useState(false);
  const [showVoicePrompt, setShowVoicePrompt] = useState(false);
  const [voiceAlertTriggered, setVoiceAlertTriggered] = useState(false);

  const {
    isVoiceEnabled,
    isSpeaking,
    handleVoiceDistractionAlert,
    voiceStatus
  } = useVoiceInteraction({
    isVoyageActive: true, // Always active when alert is shown
    isExploring: false,
    onDistractionResponse: (response) => {
      console.log('🎤 [ALERT] Voice response received:', response);
      setVoiceResponseReceived(true);
      handleResponse(response);
    }
  });

  // Reset state when alert becomes visible
  useEffect(() => {
    if (isVisible) {
      console.log('🚨 [ALERT] Distraction alert became visible:', {
        distractionType,
        enableVoice,
        isVoiceEnabled,
        voiceFeatures: voiceStatus.features
      });
      
      setVoiceResponseReceived(false);
      setShowVoicePrompt(false);
      setVoiceAlertTriggered(false);
    }
  }, [isVisible, distractionType, enableVoice, isVoiceEnabled, voiceStatus]);

  // Trigger voice alert when distraction becomes visible
  useEffect(() => {
    if (isVisible && enableVoice && isVoiceEnabled && !voiceResponseReceived && !voiceAlertTriggered) {
      console.log('🎤 [ALERT] Triggering voice alert for distraction:', distractionType);
      
      const triggerVoiceAlert = async () => {
        setVoiceAlertTriggered(true);
        
        try {
          const success = await handleVoiceDistractionAlert(distractionType);
          console.log('🎤 [ALERT] Voice alert result:', success);
          
          if (success) {
            setShowVoicePrompt(true);
          } else {
            console.log('🎤 [ALERT] Voice alert failed, showing manual controls only');
          }
        } catch (error) {
          console.error('🎤 [ALERT] Voice alert error:', error);
        }
      };

      // Small delay to ensure UI is ready
      setTimeout(triggerVoiceAlert, 500);
    }
  }, [isVisible, enableVoice, isVoiceEnabled, distractionType, handleVoiceDistractionAlert, voiceResponseReceived, voiceAlertTriggered]);

  const getDistractionMessage = () => {
    switch (distractionType) {
      case 'tab_switch':
        return "I noticed you switched away from your focus area. The winds have shifted!";
      case 'camera_absence':
      case 'camera_distraction':
        return "The AI noticed you're not at your workstation. Time to return to your voyage!";
      case 'blacklisted_content':
        return "You've sailed into distracting waters. Let's navigate back to your destination!";
      case 'irrelevant_content':
        return "The current content doesn't seem related to your voyage goal. Shall we return to course?";
      case 'idle':
        return "You seem to be taking a break. The sea is calm and peaceful.";
      default:
        return "The captain seems to be off course!";
    }
  };

  const getDistractionIcon = () => {
    switch (distractionType) {
      case 'tab_switch':
      case 'blacklisted_content':
      case 'irrelevant_content':
        return <Compass className="w-16 h-16 text-yellow-500" />;
      case 'camera_absence':
      case 'camera_distraction':
        return <AlertTriangle className="w-16 h-16 text-orange-500" />;
      case 'idle':
        return <Volume2 className="w-16 h-16 text-blue-500" />;
      default:
        return <AlertTriangle className="w-16 h-16 text-yellow-500" />;
    }
  };

  const handleResponse = (response: 'return_to_course' | 'exploring') => {
    console.log('🚨 [ALERT] Manual response selected:', response);
    setSelectedResponse(response);
    setTimeout(() => {
      onResponse(response);
      setSelectedResponse(null);
      setVoiceResponseReceived(false);
      setShowVoicePrompt(false);
      setVoiceAlertTriggered(false);
    }, 500);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Card className="max-w-md w-full p-8 text-center">
              <motion.div
                animate={{ 
                  rotate: [0, -5, 5, -5, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  repeatType: 'reverse'
                }}
                className="mb-6"
              >
                {getDistractionIcon()}
              </motion.div>

              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Course Correction Needed
              </h2>
              
              <p className="text-gray-600 mb-2">
                {getDistractionMessage()}
              </p>
              
              {duration && (
                <p className="text-sm text-gray-500 mb-6">
                  Away for {Math.round(duration / 1000)} seconds
                </p>
              )}

              {/* Voice Interaction Status */}
              <AnimatePresence>
                {showVoicePrompt && isSpeaking && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Volume2 className="w-5 h-5 text-blue-600" />
                      </motion.div>
                      <span className="text-blue-800 text-sm">AI is speaking...</span>
                    </div>
                  </motion.div>
                )}

                {showVoicePrompt && !isSpeaking && isVoiceEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Mic className="w-5 h-5 text-green-600" />
                      </motion.div>
                      <span className="text-green-800 text-sm font-medium">Listening for your response...</span>
                    </div>
                    <p className="text-xs text-green-600">
                      Say "I'm exploring" or "return to course"
                    </p>
                  </motion.div>
                )}

                {enableVoice && !isVoiceEnabled && voiceStatus.features.speechRecognition && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Volume2 className="w-5 h-5 text-yellow-600" />
                      <span className="text-yellow-800 text-sm">Voice recognition available, but AI voice needs API key</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Manual Response Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => handleResponse('return_to_course')}
                  className={`w-full transition-all ${
                    selectedResponse === 'return_to_course' 
                      ? 'bg-green-600 scale-105' 
                      : ''
                  }`}
                  size="lg"
                  icon={ArrowLeft}
                  disabled={selectedResponse !== null}
                >
                  Return to Course
                </Button>
                
                <Button
                  onClick={() => handleResponse('exploring')}
                  variant="outline"
                  className={`w-full transition-all ${
                    selectedResponse === 'exploring' 
                      ? 'border-blue-600 bg-blue-50 scale-105' 
                      : ''
                  }`}
                  size="lg"
                  icon={Compass}
                  disabled={selectedResponse !== null}
                >
                  I'm Exploring
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-500">
                  Choose "I'm Exploring" to temporarily pause distraction detection
                </p>
                
                {isVoiceEnabled && (
                  <p className="text-xs text-blue-600">
                    🎤 You can also respond with voice in English
                  </p>
                )}
                
                {!isVoiceEnabled && voiceStatus.features.speechRecognition && (
                  <p className="text-xs text-yellow-600">
                    💡 Add ElevenLabs API key to enable AI voice responses
                  </p>
                )}

                {!voiceStatus.features.speechRecognition && (
                  <p className="text-xs text-red-600">
                    ❌ Voice features not supported in this browser
                  </p>
                )}
              </div>

              {/* Debug info in development */}
              {import.meta.env.DEV && (
                <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-left">
                  <p><strong>Debug Info:</strong></p>
                  <p>Voice Enabled: {isVoiceEnabled ? '✅' : '❌'}</p>
                  <p>Speech Recognition: {voiceStatus.features.speechRecognition ? '✅' : '❌'}</p>
                  <p>ElevenLabs: {voiceStatus.features.elevenLabs ? '✅' : '❌'}</p>
                  <p>Alert Triggered: {voiceAlertTriggered ? '✅' : '❌'}</p>
                  <p>Speaking: {isSpeaking ? '✅' : '❌'}</p>
                </div>
              )}
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};