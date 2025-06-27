import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Mic, Camera, FileText, ArrowLeft, Save, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface ExplorationModeProps {
  isActive: boolean;
  onReturnToCourse: () => void;
  onCaptureInspiration: (content: string, type: 'text' | 'voice') => void;
}

export const ExplorationMode: React.FC<ExplorationModeProps> = ({
  isActive,
  onReturnToCourse,
  onCaptureInspiration
}) => {
  const [showCapturePanel, setShowCapturePanel] = useState(false);
  const [captureType, setCaptureType] = useState<'text' | 'voice'>('text');
  const [textNote, setTextNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleCaptureInspiration = () => {
    if (captureType === 'text' && textNote.trim()) {
      onCaptureInspiration(textNote, 'text');
      setTextNote('');
      setShowCapturePanel(false);
    }
  };

  const handleVoiceCapture = () => {
    if (!isRecording) {
      setIsRecording(true);
      // In a real implementation, this would start voice recording
      setTimeout(() => {
        setIsRecording(false);
        onCaptureInspiration('Voice note captured', 'voice');
        setShowCapturePanel(false);
      }, 3000);
    }
  };

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-sm z-40"
    >
      {/* Floating exploration indicator */}
      <div className="absolute top-4 left-4 right-4">
        <Card className="p-4 bg-purple-100 border-purple-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              >
                <Compass className="w-6 h-6 text-purple-600" />
              </motion.div>
              <div>
                <h3 className="font-semibold text-purple-800">Exploration Mode Active</h3>
                <p className="text-sm text-purple-600">
                  Feel free to explore! Distraction detection is paused.
                </p>
              </div>
            </div>
            <Button
              onClick={onReturnToCourse}
              variant="outline"
              size="sm"
              icon={ArrowLeft}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              Return to Course
            </Button>
          </div>
        </Card>
      </div>

      {/* Capture inspiration button */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <Button
          onClick={() => setShowCapturePanel(true)}
          size="lg"
          className="bg-purple-600 hover:bg-purple-700 shadow-lg"
          icon={FileText}
        >
          Capture Inspiration
        </Button>
      </div>

      {/* Capture panel */}
      <AnimatePresence>
        {showCapturePanel && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-24 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4"
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Capture Your Discovery</h3>
                <Button
                  onClick={() => setShowCapturePanel(false)}
                  variant="ghost"
                  size="sm"
                  icon={X}
                />
              </div>

              <div className="flex space-x-2 mb-4">
                <Button
                  onClick={() => setCaptureType('text')}
                  variant={captureType === 'text' ? 'primary' : 'outline'}
                  size="sm"
                  icon={FileText}
                  className="flex-1"
                >
                  Text Note
                </Button>
                <Button
                  onClick={() => setCaptureType('voice')}
                  variant={captureType === 'voice' ? 'primary' : 'outline'}
                  size="sm"
                  icon={Mic}
                  className="flex-1"
                >
                  Voice Note
                </Button>
              </div>

              {captureType === 'text' ? (
                <div className="space-y-4">
                  <textarea
                    value={textNote}
                    onChange={(e) => setTextNote(e.target.value)}
                    placeholder="What inspired you? Jot down your thoughts..."
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <Button
                    onClick={handleCaptureInspiration}
                    disabled={!textNote.trim()}
                    className="w-full"
                    icon={Save}
                  >
                    Save Inspiration
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <motion.div
                    animate={isRecording ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Button
                      onClick={handleVoiceCapture}
                      className={`w-20 h-20 rounded-full ${
                        isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                      disabled={isRecording}
                    >
                      <Mic className="w-8 h-8" />
                    </Button>
                  </motion.div>
                  <p className="text-sm text-gray-600">
                    {isRecording ? 'Recording... (3s demo)' : 'Tap to start recording'}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient exploration background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            background: [
              'radial-gradient(circle at 20% 20%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 80%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 20%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
            ]
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="w-full h-full"
        />
      </div>
    </motion.div>
  );
};