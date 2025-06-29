import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Volume2, VolumeX, Settings, ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CameraView } from './CameraView';
import { DistractionAlert } from './DistractionAlert';
import { ExplorationMode } from './ExplorationMode';
import { SeagullCompanion } from './SeagullCompanion';
import { WeatherSystem } from './WeatherSystem';
import { useVoyageStore } from '../../stores/voyageStore';
import { useAdvancedDistraction } from '../../hooks/useAdvancedDistraction';
import { useAudio } from '../../hooks/useAudio';
import { useNotificationStore } from '../../stores/notificationStore';
import { 
  getHighPrecisionTime, 
  calculatePreciseDuration, 
  formatPreciseDuration,
  createPrecisionInterval 
} from '../../utils/precisionTimer';
import { GeminiService } from '../../services/GeminiService';
import type { Destination } from '../../types';

interface SailingModeProps {
  destination: Destination;
  onEndVoyage: () => void;
}

export const SailingMode: React.FC<SailingModeProps> = ({ destination, onEndVoyage }) => {
  const [elapsedTime, setElapsedTime] = useState(0); // Keep in milliseconds for precision
  const [showControls, setShowControls] = useState(false);
  const [weatherMood, setWeatherMood] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy'>('sunny');
  const [showDistractionAlert, setShowDistractionAlert] = useState(false);
  const [isExploring, setIsExploring] = useState(false);
  const [showSeagull, setShowSeagull] = useState(false);
  const [inspirationNotes, setInspirationNotes] = useState<Array<{ content: string, type: 'text' | 'voice', timestamp: number }>>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  // Use stable selectors to prevent unnecessary re-renders
  const currentVoyage = useVoyageStore(state => state.currentVoyage);
  const distractionCount = useVoyageStore(state => state.distractionCount);
  const endVoyage = useVoyageStore(state => state.endVoyage);
  
  const { showSuccess } = useNotificationStore();
  const {
    isDistracted,
    distractionType,
    confidenceLevel,
    isMonitoring,
    lastAnalysisResults,
    diagnostics,
    handleDistractionResponse
  } = useAdvancedDistraction({ 
    isExploring, 
    currentDestination: destination,
    cameraStream 
  });
  const {
    isPlaying,
    volume,
    isMuted,
    startAmbientSound,
    stopAmbientSound,
    toggleMute,
    adjustVolume,
    setWeatherMood: setAudioWeatherMood
  } = useAudio();

  // High-precision timer
  const timerRef = useRef<ReturnType<typeof createPrecisionInterval>>();
  const startTimeRef = useRef<number>(0);
  const boatPosition = useRef({ x: 50, y: 50 });
  const trail = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const seagullTimerRef = useRef<NodeJS.Timeout>();

  // Initialize services and start monitoring
  useEffect(() => {
    // Initialize Gemini service
    GeminiService.initialize();
    
    // Small delay to ensure audio system is ready
    const timer = setTimeout(() => {
      startAmbientSound();
    }, 1000);

    // Show seagull after 5 minutes for first-time interaction
    seagullTimerRef.current = setTimeout(() => {
      setShowSeagull(true);
    }, 300000); // 5 minutes

    return () => {
      clearTimeout(timer);
      stopAmbientSound();
      if (seagullTimerRef.current) {
        clearTimeout(seagullTimerRef.current);
      }
    };
  }, [startAmbientSound, stopAmbientSound]);

  // High-precision timer effect
  useEffect(() => {
    if (currentVoyage?.id) {
      startTimeRef.current = new Date(currentVoyage.start_time).getTime();
      
      timerRef.current = createPrecisionInterval((elapsedMs) => {
        setElapsedTime(elapsedMs);

        // Show milestone notifications at precise intervals
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        
        // 30-minute milestone
        if (elapsedSeconds === 1800 && !localStorage.getItem(`milestone-30-${currentVoyage.id}`)) {
          showSuccess('30 minutes of sustained focus!', 'Great Achievement');
          localStorage.setItem(`milestone-30-${currentVoyage.id}`, 'true');
        }
        // 1-hour milestone  
        else if (elapsedSeconds === 3600 && !localStorage.getItem(`milestone-60-${currentVoyage.id}`)) {
          showSuccess('1 full hour of deep focus!', 'Excellent Work');
          localStorage.setItem(`milestone-60-${currentVoyage.id}`, 'true');
        }
      }, 100); // Update every 100ms for smooth display
      
      timerRef.current.start();
    }

    return () => {
      if (timerRef.current) {
        timerRef.current.stop();
      }
    };
  }, [currentVoyage?.id, currentVoyage?.start_time, showSuccess]);

  // Enhanced distraction alert effect
  useEffect(() => {
    if (isDistracted && !isExploring) {
      setShowDistractionAlert(true);
      if (weatherMood !== 'stormy') {
        setWeatherMood('stormy');
        setAudioWeatherMood('stormy');
      }
    } else if (!isExploring) {
      setShowDistractionAlert(false);
      if (weatherMood !== 'sunny') {
        setWeatherMood('sunny');
        setAudioWeatherMood('sunny');
      }
    }
  }, [isDistracted, isExploring, weatherMood, setAudioWeatherMood]);

  // Boat animation effect
  useEffect(() => {
    const animateBoat = () => {
      if (!isDistracted && !isExploring) {
        // Move boat forward when focused
        boatPosition.current.x += 0.1;
        if (boatPosition.current.x > 90) {
          boatPosition.current.x = 10;
          boatPosition.current.y = 30 + Math.random() * 40;
        }

        // Add to trail
        trail.current.push({
          x: (boatPosition.current.x / 100) * (window.innerWidth || 1000),
          y: (boatPosition.current.y / 100) * (window.innerHeight || 600),
          timestamp: Date.now()
        });

        // Keep trail length manageable
        if (trail.current.length > 100) {
          trail.current = trail.current.slice(-100);
        }
      }
    };

    const animationInterval = setInterval(animateBoat, 100);
    return () => clearInterval(animationInterval);
  }, [isDistracted, isExploring]);

  const handleEndVoyage = useCallback(async () => {
    await endVoyage();
    onEndVoyage();
  }, [endVoyage, onEndVoyage]);

  const handleDistractionChoice = useCallback(async (choice: 'return_to_course' | 'exploring') => {
    await handleDistractionResponse(choice);
    setShowDistractionAlert(false);

    if (choice === 'exploring') {
      setIsExploring(true);
      if (weatherMood !== 'cloudy') {
        setWeatherMood('cloudy');
        setAudioWeatherMood('cloudy');
      }
    } else {
      setIsExploring(false);
    }
  }, [handleDistractionResponse, weatherMood, setAudioWeatherMood]);

  const handleReturnToCourse = useCallback(() => {
    setIsExploring(false);
    if (weatherMood !== 'sunny') {
      setWeatherMood('sunny');
      setAudioWeatherMood('sunny');
    }
  }, [weatherMood, setAudioWeatherMood]);

  const handleCaptureInspiration = useCallback((content: string, type: 'text' | 'voice') => {
    const newNote = {
      content,
      type,
      timestamp: getHighPrecisionTime()
    };
    setInspirationNotes(prev => [...prev, newNote]);

    // Show seagull with encouraging message
    setShowSeagull(true);

    showSuccess(
      `${type === 'voice' ? 'Voice note' : 'Text note'} captured successfully!`,
      'Inspiration Saved'
    );
  }, [showSuccess]);

  // Handle camera stream changes
  const handleCameraStream = useCallback((stream: MediaStream | null) => {
    setCameraStream(stream);
    setCameraPermissionGranted(!!stream);
  }, []);

  // Format time with high precision
  const formatTime = (milliseconds: number) => {
    return formatPreciseDuration(milliseconds);
  };

  const getWeatherEmoji = () => {
    switch (weatherMood) {
      case 'sunny': return '☀️';
      case 'cloudy': return '⛅';
      case 'rainy': return '🌧️';
      case 'stormy': return '⛈️';
      default: return '☀️';
    }
  };

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    console.log('Volume slider changed to:', newVolume);
    adjustVolume(newVolume);
  }, [adjustVolume]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 relative overflow-hidden">
      {/* Weather System */}
      <WeatherSystem mood={weatherMood} />

      {/* Ocean Background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)',
            backgroundSize: '100px 100px',
          }}
        />
      </div>

      {/* Trail */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <path
          d={trail.current.length > 1 ?
            `M ${trail.current[0].x} ${trail.current[0].y} ` +
            trail.current.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ')
            : ''
          }
          stroke={destination.color_theme}
          strokeWidth="3"
          fill="none"
          opacity="0.6"
          strokeDasharray="5,5"
        />
      </svg>

      {/* Boat */}
      <motion.div
        className="absolute z-10"
        style={{
          left: `${Math.min(Math.max(boatPosition.current.x, 0), 100)}%`,
          top: `${Math.min(Math.max(boatPosition.current.y, 10), 90)}%`,
        }}
        animate={{
          y: isDistracted ? [0, -5, 0] : [0, -2, 0],
          rotate: isDistracted ? [-2, 2, -2] : [-1, 1, -1],
        }}
        transition={{
          duration: isDistracted ? 1 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Anchor className="w-8 h-8 text-white drop-shadow-lg" />
      </motion.div>

      {/* Lighthouse (Destination) */}
      <div className="absolute top-10 right-10 text-center">
        <motion.div
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
          className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mb-2"
        >
          <Compass className="w-8 h-8 text-yellow-900" />
        </motion.div>
        <p className="text-white text-sm font-medium">{destination.destination_name}</p>
      </div>

      {/* Top Status Bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
        <div className="flex items-center space-x-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <span className="text-white font-mono text-lg">{formatTime(elapsedTime)}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <span className="text-white text-sm">Distractions: {distractionCount}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <span className="text-white text-sm">{getWeatherEmoji()} {weatherMood}</span>
          </div>
          {isExploring && (
            <div className="bg-purple-500/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-white text-sm">🧭 Exploring</span>
            </div>
          )}
          {inspirationNotes.length > 0 && (
            <div className="bg-green-500/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-white text-sm">💡 {inspirationNotes.length} notes</span>
            </div>
          )}
          {cameraPermissionGranted && (
            <div className="bg-green-500/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-white text-sm">📷 AI Monitoring</span>
            </div>
          )}
          {diagnostics.geminiConfigured && (
            <div className="bg-blue-500/80 backdrop-blur-sm rounded-lg px-4 py-2">
              <span className="text-white text-sm">🤖 Gemini Ready</span>
            </div>
          )}
        </div>
        
        {/* Camera View Component */}
        <CameraView 
          isActive={true}
          onCameraStream={handleCameraStream}
        />

        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleMute}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button
            onClick={() => setShowControls(!showControls)}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Controls Panel */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 right-4 z-20"
          >
            <Card className="p-6 w-80">
              <h3 className="font-semibold mb-4">Sailing Controls</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Ambient Volume: {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
                  </label>
                  <div className="relative">
                    {/* Custom styled range input */}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="volume-slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Mute</span>
                    <span>Max</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Audio:</span>
                      <span className={`ml-2 ${isPlaying ? 'text-green-600' : 'text-red-600'}`}>
                        {isPlaying ? (isMuted ? 'Muted' : 'Playing') : 'Stopped'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Monitoring:</span>
                      <span className={`ml-2 ${isMonitoring ? 'text-green-600' : 'text-gray-500'}`}>
                        {isMonitoring ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">Mode:</span>
                      <span className={`ml-2 ${isExploring ? 'text-purple-600' : 'text-blue-600'}`}>
                        {isExploring ? 'Exploration' : 'Focus'}
                      </span>
                    </div>
                    
                    {/* Advanced monitoring status */}
                    <div className="col-span-2 border-t pt-2">
                      <p className="text-sm font-medium text-gray-700 mb-2">AI Monitoring Status:</p>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>Camera:</span>
                          <span className={diagnostics.cameraAvailable ? 'text-green-600' : 'text-gray-500'}>
                            {diagnostics.cameraAvailable ? 'Active' : 'Not available'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Combined Analysis:</span>
                          <span className={diagnostics.combined?.isActive ? 'text-green-600' : 'text-gray-500'}>
                            {diagnostics.combined?.isActive ? 'Active (60s)' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gemini AI:</span>
                          <span className={diagnostics.geminiConfigured ? 'text-green-600' : 'text-yellow-600'}>
                            {diagnostics.geminiConfigured ? 'Connected' : 'Not configured'}
                          </span>
                        </div>
                        {(isDistracted || diagnostics.combined?.isDistracted || diagnostics.url?.isDistracted) && (
                          <div className="mt-2 text-red-600">
                            <span>Overall Status: 🚨 DISTRACTED ({distractionType})</span>
                          </div>
                        )}
                        {diagnostics.combined?.lastCameraAnalysis && (
                          <div className="mt-2 text-xs text-blue-600">
                            <p>📷 Camera: {diagnostics.combined.lastCameraAnalysis.personPresent ? '✅ Present' : '❌ Absent'} | 
                            {diagnostics.combined.lastCameraAnalysis.appearsFocused ? ' ✅ Focused' : ' ❌ Distracted'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t text-xs text-gray-400">
                      <p>🔍 Active Detection Systems:</p>
                      <p>• Tab switch detection (instant)</p>
                      <p>• URL blacklist monitoring (5min timeout)</p>
                      <p>• Combined screenshot + camera analysis (60s)</p>
                      <p>• Idle detection (90s timeout)</p>
                    </div>
                  </div>
                </div>

                {inspirationNotes.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Recent Notes:</p>
                    <div className="max-h-20 overflow-y-auto text-xs text-gray-600 space-y-1">
                      {inspirationNotes.slice(-3).map((note, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded">
                          {note.type === 'voice' ? '🎤' : '📝'} {note.content.slice(0, 40)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleEndVoyage}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  icon={ArrowLeft}
                >
                  End Voyage
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Distraction Alert */}
      <DistractionAlert
        isVisible={showDistractionAlert}
        onResponse={handleDistractionChoice}
        distractionType={distractionType || 'tab_switch'}
        duration={elapsedTime}
      />

      {/* Exploration Mode */}
      <ExplorationMode
        isActive={isExploring}
        onReturnToCourse={handleReturnToCourse}
        onCaptureInspiration={handleCaptureInspiration}
      />

      {/* Seagull Companion */}
      <SeagullCompanion
        isVisible={showSeagull}
        voyageTime={elapsedTime}
        distractionCount={distractionCount}
        onDismiss={() => setShowSeagull(false)}
      />

      {/* Bottom Info */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
          <p className="text-white text-center">
            Sailing to <strong>{destination.destination_name}</strong>
          </p>
          <p className="text-white/80 text-sm text-center mt-1">
            {destination.description}
          </p>
          {!diagnostics.geminiConfigured && (
            <p className="text-yellow-300 text-xs text-center mt-2">
              💡 Add Gemini API key for advanced AI monitoring
            </p>
          )}
        </div>
      </div>

      {/* Custom CSS for volume slider */}
      <style>{`
        .volume-slider {
          background: linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(isMuted ? 0 : volume) * 100}%, #E5E7EB ${(isMuted ? 0 : volume) * 100}%, #E5E7EB 100%);
        }
        
        .volume-slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
        }
        
        .volume-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        }
        
        .volume-slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          transition: all 0.2s ease;
        }
        
        .volume-slider::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        }
        
        .volume-slider::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: transparent;
        }
        
        .volume-slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: transparent;
          border: none;
        }
        
        .volume-slider:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
      `}</style>
    </div>
  );
};