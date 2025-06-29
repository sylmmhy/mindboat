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

  const {
    isVoiceEnabled,
    isSpeaking,
    handleVoiceDistractionAlert,
    voiceStatus
  } = useVoiceInteraction({
    isVoyageActive: isVisible,
    isExploring: false,
    onDistractionResponse: (response) => {
      setVoiceResponseReceived(true);
      handleResponse(response);
    }
  });

  // Trigger voice alert when distraction becomes visible
  useEffect(() => {
    if (isVisible && enableVoice && isVoiceEnabled && !voiceResponseReceived) {
      const triggerVoiceAlert = async () => {
        const success = await handleVoiceDistractionAlert(distractionType);
        if (success) {
          setShowVoicePrompt(true);
        }
      };

      // Small delay to ensure UI is ready
      setTimeout(triggerVoiceAlert, 500);
    }
  }, [isVisible, enableVoice, isVoiceEnabled, distractionType, handleVoiceDistractionAlert, voiceResponseReceived]);

  const getDistractionMessage = () => {
    switch (distractionType) {
      case 'tab_switch':
        return "我注意到你切换了标签页。海风变向了！";
      case 'camera_absence':
      case 'camera_distraction':
        return "AI注意到你不在工作区域。是时候回到航行中了！";
      case 'blacklisted_content':
        return "你已经驶入了令人分心的水域。让我们导航回到你的目的地！";
      case 'irrelevant_content':
        return "当前内容似乎与你的航行目标无关。要返回航道吗？";
      case 'idle':
        return "你似乎在休息。大海平静而宁和。";
      default:
        return "船长似乎偏离了航道！";
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
    setSelectedResponse(response);
    setTimeout(() => {
      onResponse(response);
      setSelectedResponse(null);
      setVoiceResponseReceived(false);
      setShowVoicePrompt(false);
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
                需要调整航向
              </h2>
              
              <p className="text-gray-600 mb-2">
                {getDistractionMessage()}
              </p>
              
              {duration && (
                <p className="text-sm text-gray-500 mb-6">
                  离开了 {Math.round(duration / 1000)} 秒
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
                      <span className="text-blue-800 text-sm">AI正在说话...</span>
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
                      <span className="text-green-800 text-sm font-medium">正在聆听你的回应...</span>
                    </div>
                    <p className="text-xs text-green-600">
                      说出 "I'm exploring" 或 "return to course"
                    </p>
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
                  disabled={selectedResponse !== null || isSpeaking}
                >
                  返回航道
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
                  disabled={selectedResponse !== null || isSpeaking}
                >
                  我在探索
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-500">
                  选择"我在探索"将暂时暂停分心检测
                </p>
                
                {isVoiceEnabled && (
                  <p className="text-xs text-blue-600">
                    🎤 你也可以用英语语音回应
                  </p>
                )}
                
                {!isVoiceEnabled && voiceStatus.features.speechRecognition && (
                  <p className="text-xs text-yellow-600">
                    💡 添加 ElevenLabs API 密钥以启用AI语音
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};