import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  
  // Use the fixed advanced distraction detection hook
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
  const boatPosition = useRef({ x: 10, y: 60 });
  const trail = useRef<Array<{ x: number, y: number, timestamp: number }>>([]);

  // Initialize timer when voyage starts
  useEffect(() => {
    if (currentVoyage) {
      startTimeRef.current = getHighPrecisionTime();
      
      timerRef.current = createPrecisionInterval(() => {
        const currentTime = getHighPrecisionTime();
        const elapsed = calculatePreciseDuration(startTimeRef.current, currentTime);
        setElapsedTime(elapsed);
      }, 100); // Update every 100ms for smooth display

      // Start ambient audio
      startAmbientSound();
    }

    return () => {
      if (timerRef.current) {
        timerRef.current.stop();
      }
    };
  }, [currentVoyage, startAmbientSound]);

  // Show distraction alert when distraction is detected
  useEffect(() => {
    if (isDistracted && !isExploring) {
      setShowDistractionAlert(true);
      
      // Update weather to reflect distraction
      if (weatherMood === 'sunny') {
        setWeatherMood('cloudy');
        setAudioWeatherMood('cloudy');
      }
    } else {
      setShowDistractionAlert(false);
    }
  }, [isDistracted, isExploring, weatherMood, setAudioWeatherMood]);

  // Boat animation and trail management
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
    try {
      await endVoyage();
      stopAmbientSound();
      onEndVoyage();
    } catch (error) {
      console.error('Failed to end voyage:', error);
    }
  }, [endVoyage, stopAmbientSound, onEndVoyage]);

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
      if (weatherMood !== 'sunny') {
        setWeatherMood('sunny');
        setAudioWeatherMood('sunny');
      }
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
          duration: isDistracted ? 1.5 : 3,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
      >
        <div className="relative">
          <Anchor 
            size={32} 
            className={`text-white ${isDistracted ? 'opacity-70' : 'opacity-100'} drop-shadow-lg`}
            style={{ color: destination.color_theme }}
          />
          {isDistracted && (
            <motion.div
              className="absolute -top-2 -right-2"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <span className="text-yellow-400 text-lg">⚠️</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Controls Toggle */}
      <motion.button
        className="absolute top-4 right-4 z-20 bg-white/10 backdrop-blur-sm rounded-full p-3 hover:bg-white/20 transition-colors"
        onClick={() => setShowControls(!showControls)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Settings className="w-5 h-5 text-white" />
      </motion.button>

      {/* Controls Panel */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute top-4 right-16 z-20"
          >
            <Card className="p-4 bg-white/90 backdrop-blur-sm min-w-80">
              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Voyage Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Destination:</span>
                      <span className="font-medium">{destination.destination_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Elapsed Time:</span>
                      <span className="font-mono">{formatTime(elapsedTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Weather:</span>
                      <span>{getWeatherEmoji()} {weatherMood}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Distractions:</span>
                      <span className={distractionCount > 0 ? 'text-orange-600' : 'text-green-600'}>
                        {distractionCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audio Controls */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Audio</h4>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={toggleMute}
                      className={`p-2 rounded-lg transition-colors ${
                        isMuted ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="flex-1 volume-slider"
                    />
                  </div>
                </div>

                {/* Debug Information */}
                {import.meta.env.DEV && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-700 mb-2">Debug Info</h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="font-medium">Detection Status:</p>
                          <p>Monitoring: {isMonitoring ? '✅ Active' : '❌ Inactive'}</p>
                          <p>Distracted: {isDistracted ? '🚨 Yes' : '✅ No'}</p>
                          <p>Exploring: {isExploring ? '🧭 Yes' : '❌ No'}</p>
                          <p>Type: {distractionType || 'None'}</p>
                        </div>
                        <div>
                          <p className="font-medium">Systems:</p>
                          <p>Tab Switch: {diagnostics.tabSwitch?.isDistracted ? '🚨 Alert' : '✅ OK'}</p>
                          <p>URL Check: {diagnostics.url?.isDistracted ? '🚨 Alert' : '✅ OK'}</p>
                          <p>Combined: {diagnostics.combined?.isDistracted ? '🚨 Alert' : '✅ OK'}</p>
                        </div>
                      </div>
                      
                      {/* Camera Analysis */}
                      {diagnostics.combined?.lastCameraAnalysis && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <p className="font-medium">📹 Camera Analysis:</p>
                          <p>👤 User: {diagnostics.combined.lastCameraAnalysis.userPresent ? 
                            '✅ Present' : '❌ Absent'} | 
                            {diagnostics.combined.lastCameraAnalysis.appearsFocused ? ' ✅ Focused' : ' ❌ Distracted'}</p>
                        </div>
                      )}
                      
                      {/* Screen Analysis */}
                      {diagnostics.combined?.lastScreenshotAnalysis?.screenAnalysis && (
                        <div className="mt-1 text-xs text-green-600">
                          <p>🖥️ Screen: {diagnostics.combined.lastScreenshotAnalysis.screenAnalysis.contentType} | 
                          {diagnostics.combined.lastScreenshotAnalysis.screenAnalysis.isProductiveContent ? ' ✅ Productive' : ' ❌ Distracting'}</p>
                        </div>
                      )}
                      
                      {/* URL Information */}
                      {diagnostics.url?.currentUrl && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p>🔗 Current URL: {diagnostics.url.currentUrl.length > 50 ? 
                            diagnostics.url.currentUrl.substring(0, 50) + '...' : 
                            diagnostics.url.currentUrl}</p>
                          <p>URL Status: {diagnostics.url?.isDistracted ? '🚨 Distracting' : '✅ Relevant'}</p>
                        </div>
                      )}
                      
                      {/* Distraction Level */}
                      {(diagnostics.combined?.lastScreenshotAnalysis?.distractionLevel && 
                        diagnostics.combined.lastScreenshotAnalysis.distractionLevel !== 'none') && (
                        <div className="mt-1 text-xs text-orange-600">
                          <p>⚠️ Distraction Level: {diagnostics.combined.lastScreenshotAnalysis.distractionLevel}</p>
                          <p>💡 Suggested Action: {diagnostics.combined.lastScreenshotAnalysis.suggestedAction}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t text-xs text-gray-400">
                      <p>🔍 Active Detection Systems:</p>
                      <p>• Tab switch detection (5s timeout)</p>
                      <p>• URL blacklist monitoring (real-time)</p>
                      <p>• Combined screenshot + camera analysis (60s interval)</p>
                      <p>• Idle detection (90s timeout)</p>
                      <p>• Activity monitoring (mouse/keyboard)</p>
                    </div>
                  </div>
                )}

                {/* Recent Notes */}
                {inspirationNotes.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Recent Notes:</p>
                    <div className="max-h-16 overflow-y-auto text-xs text-gray-600 space-y-1">
                      {inspirationNotes.slice(-3).map((note, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded">
                          {note.type === 'voice' ? '🎤' : '📝'} {note.content.slice(0, 50)}
                          {note.content.length > 50 ? '...' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={handleEndVoyage}
                    variant="secondary"
                    className="w-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    End Voyage
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main HUD */}
      <div className="absolute top-4 left-4 z-10">
        <Card className="p-4 bg-white/10 backdrop-blur-sm text-white">
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-mono">{formatTime(elapsedTime)}</div>
              <div className="text-sm opacity-75">sailing time</div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center">
              <div className="text-xl">{getWeatherEmoji()}</div>
              <div className="text-sm opacity-75">{weatherMood}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Destination Info */}
      <div className="absolute bottom-4 left-4 z-10">
        <Card className="p-4 bg-white/10 backdrop-blur-sm text-white max-w-md">
          <div className="flex items-start space-x-3">
            <Compass className="w-6 h-6 mt-1 flex-shrink-0" style={{ color: destination.color_theme }} />
            <div>
              <h3 className="font-semibold text-lg">{destination.destination_name}</h3>
              <p className="text-sm opacity-75 mt-1">{destination.description}</p>
              {distractionCount > 0 && (
                <p className="text-xs text-yellow-200 mt-2">
                  ⚠️ {distractionCount} course correction{distractionCount !== 1 ? 's' : ''} so far
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Camera View */}
      {cameraPermissionGranted && (
        <div className="absolute bottom-4 right-4 z-10">
          <CameraView
            stream={cameraStream}
            onStreamChange={handleCameraStream}
            className="w-32 h-24 rounded-lg border-2 border-white/20"
          />
        </div>
      )}

      {/* Seagull Companion */}
      <AnimatePresence>
        {showSeagull && (
          <SeagullCompanion
            onClose={() => setShowSeagull(false)}
            message="Great insight captured! 🌊"
            position={{ x: 70, y: 20 }}
          />
        )}
      </AnimatePresence>

      {/* Distraction Alert */}
      <DistractionAlert
        isVisible={showDistractionAlert}
        onResponse={handleDistractionChoice}
        distractionType={distractionType}
        duration={diagnostics.tabSwitch?.startTime ? Date.now() - diagnostics.tabSwitch.startTime : undefined}
      />

      {/* Exploration Mode */}
      <AnimatePresence>
        {isExploring && (
          <ExplorationMode
            onReturnToCourse={handleReturnToCourse}
            onCaptureInspiration={handleCaptureInspiration}
          />
        )}
      </AnimatePresence>

      {/* Volume Slider Styles */}
      <style>{`
        .volume-slider {
          height: 8px;
          border-radius: 4px;
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