import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Volume2, VolumeX, Settings, AlertTriangle, ArrowLeft, Compass, MessageCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DistractionAlert } from './DistractionAlert';
import { ExplorationMode } from './ExplorationMode';
import { SeagullCompanion } from './SeagullCompanion';
import { WeatherSystem } from './WeatherSystem';
import { useVoyageStore } from '../../stores/voyageStore';
import { useDistraction } from '../../hooks/useDistraction';
import { useAudio } from '../../hooks/useAudio';
import { useNotificationStore } from '../../stores/notificationStore';
import type { Destination } from '../../types';

interface SailingModeProps {
  destination: Destination;
  onEndVoyage: () => void;
}

export const SailingMode: React.FC<SailingModeProps> = ({ destination, onEndVoyage }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [weatherMood, setWeatherMood] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy'>('sunny');
  const [showDistractionAlert, setShowDistractionAlert] = useState(false);
  const [isExploring, setIsExploring] = useState(false);
  const [showSeagull, setShowSeagull] = useState(false);
  const [inspirationNotes, setInspirationNotes] = useState<Array<{content: string, type: 'text' | 'voice', timestamp: number}>>([]);
  
  const { currentVoyage, distractionCount, endVoyage } = useVoyageStore();
  const { showSuccess, showInfo } = useNotificationStore();
  const { 
    isDistracted, 
    isMonitoring, 
    handleDistractionResponse 
  } = useDistraction({ isExploring });
  const { 
    isPlaying, 
    volume, 
    startAmbientSound, 
    stopAmbientSound, 
    adjustVolume, 
    setWeatherMood: setAudioWeatherMood 
  } = useAudio();

  const intervalRef = useRef<NodeJS.Timeout>();
  const boatPosition = useRef({ x: 50, y: 50 });
  const trail = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const seagullTimerRef = useRef<NodeJS.Timeout>();

  // Start audio and show initial notification when component mounts
  useEffect(() => {
    // Small delay to ensure audio system is ready
    const timer = setTimeout(() => {
      startAmbientSound();
    }, 500);
    
    // Show seagull after 5 minutes for first-time interaction
    seagullTimerRef.current = setTimeout(() => {
      setShowSeagull(true);
    }, 300000); // 5 minutes
    
    // Show initial sailing notification
    showInfo(
      'Your voyage has begun! Stay focused on your destination.',
      'Sailing Started',
      { duration: 4000 }
    );
    
    return () => {
      clearTimeout(timer);
      stopAmbientSound();
      if (seagullTimerRef.current) {
        clearTimeout(seagullTimerRef.current);
      }
    };
  }, [startAmbientSound, stopAmbientSound, showInfo]);

  // Timer effect
  useEffect(() => {
    if (currentVoyage) {
      intervalRef.current = setInterval(() => {
        const startTime = new Date(currentVoyage.start_time).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
        
        // Show milestone notifications
        if (elapsed === 600) { // 10 minutes
          showSuccess('10 minutes of focused sailing!', 'Milestone Reached');
        } else if (elapsed === 1200) { // 20 minutes
          showSuccess('20 minutes of deep focus!', 'Great Progress');
        } else if (elapsed === 1800) { // 30 minutes
          showSuccess('30 minutes of sustained focus!', 'Excellent Work');
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentVoyage, showSuccess]);

  // Distraction alert effect
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
          x: boatPosition.current.x,
          y: boatPosition.current.y,
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

  const handleEndVoyage = async () => {
    await endVoyage();
    onEndVoyage();
  };

  const handleDistractionChoice = async (choice: 'return_to_course' | 'exploring') => {
    await handleDistractionResponse(choice);
    setShowDistractionAlert(false);
    
    if (choice === 'exploring') {
      setIsExploring(true);
      if (weatherMood !== 'cloudy') {
        setWeatherMood('cloudy');
        setAudioWeatherMood('cloudy');
      }
      
      showInfo(
        'Exploration mode activated. Feel free to explore!',
        'Exploring',
        { duration: 3000 }
      );
    } else {
      setIsExploring(false);
      showSuccess(
        'Back on course! Keep up the great focus.',
        'Course Corrected',
        { duration: 3000 }
      );
    }
  };

  const handleReturnToCourse = () => {
    setIsExploring(false);
    if (weatherMood !== 'sunny') {
      setWeatherMood('sunny');
      setAudioWeatherMood('sunny');
    }
    
    showSuccess(
      'Welcome back! Resuming focused sailing.',
      'Returned to Course'
    );
  };

  const handleCaptureInspiration = (content: string, type: 'text' | 'voice') => {
    const newNote = {
      content,
      type,
      timestamp: Date.now()
    };
    setInspirationNotes(prev => [...prev, newNote]);
    
    // Show seagull with encouraging message
    setShowSeagull(true);
    
    showSuccess(
      `${type === 'voice' ? 'Voice note' : 'Text note'} captured successfully!`,
      'Inspiration Saved'
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    console.log('Volume slider changed to:', newVolume);
    adjustVolume(newVolume);
  };

  // Toggle audio on/off
  const toggleAudio = () => {
    if (isPlaying) {
      stopAmbientSound();
    } else {
      startAmbientSound();
    }
  };

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
            `M ${trail.current[0].x}% ${trail.current[0].y}% ` +
            trail.current.slice(1).map(point => `L ${point.x}% ${point.y}%`).join(' ')
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
          left: `${boatPosition.current.x}%`,
          top: `${boatPosition.current.y}%`,
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
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleAudio}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
          >
            {isPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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
            <Card className="p-4 w-80">
              <h3 className="font-semibold mb-3">Sailing Controls</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Ambient Volume: {Math.round(volume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${volume * 100}%, #E5E7EB ${volume * 100}%, #E5E7EB 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Mute</span>
                    <span>Max</span>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Audio Status:</strong> {isPlaying ? 'Playing' : 'Stopped'}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Monitoring:</strong> {isMonitoring ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    <strong>Mode:</strong> {isExploring ? 'Exploration' : 'Focus'}
                  </p>
                </div>
                
                {inspirationNotes.length > 0 && (
                  <div className="border-t pt-3">
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
        distractionType="tab_switch"
        duration={elapsedTime * 1000}
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
        </div>
      </div>

      {/* Custom CSS for slider styling */}
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        
        input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        
        input[type="range"]::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: transparent;
        }
        
        input[type="range"]::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: transparent;
        }
      `}</style>
    </div>
  );
};