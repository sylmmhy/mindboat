import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Volume2, VolumeX, Settings, AlertTriangle, ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useVoyageStore } from '../../stores/voyageStore';
import { useDistraction } from '../../hooks/useDistraction';
import { useAudio } from '../../hooks/useAudio';
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
  
  const { currentVoyage, distractionCount, endVoyage } = useVoyageStore();
  const { 
    isDistracted, 
    isMonitoring, 
    startMonitoring, 
    stopMonitoring, 
    handleDistractionResponse 
  } = useDistraction();
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

  // Start monitoring and audio when component mounts
  useEffect(() => {
    startMonitoring();
    startAmbientSound();
    
    return () => {
      stopMonitoring();
      stopAmbientSound();
    };
  }, [startMonitoring, stopMonitoring, startAmbientSound, stopAmbientSound]);

  // Timer effect
  useEffect(() => {
    if (currentVoyage) {
      intervalRef.current = setInterval(() => {
        const startTime = new Date(currentVoyage.start_time).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentVoyage]);

  // Distraction alert effect
  useEffect(() => {
    if (isDistracted) {
      setShowDistractionAlert(true);
      setWeatherMood('stormy');
      setAudioWeatherMood('stormy');
    } else {
      setShowDistractionAlert(false);
      setWeatherMood('sunny');
      setAudioWeatherMood('sunny');
    }
  }, [isDistracted, setAudioWeatherMood]);

  // Boat animation effect
  useEffect(() => {
    const animateBoat = () => {
      if (!isDistracted) {
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
  }, [isDistracted]);

  const handleEndVoyage = async () => {
    await endVoyage();
    onEndVoyage();
  };

  const handleDistractionChoice = async (choice: 'return_to_course' | 'exploring') => {
    await handleDistractionResponse(choice);
    setShowDistractionAlert(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 relative overflow-hidden">
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
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <span className="text-white font-mono text-lg">{formatTime(elapsedTime)}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <span className="text-white text-sm">分心次数: {distractionCount}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <span className="text-white text-sm">{getWeatherEmoji()} {weatherMood}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={() => isPlaying ? stopAmbientSound() : startAmbientSound()}
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
            <Card className="p-4 w-64">
              <h3 className="font-semibold mb-3">航行控制</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">环境音量</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => adjustVolume(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-2">监控状态: {isMonitoring ? '开启' : '关闭'}</p>
                </div>
                
                <Button
                  onClick={handleEndVoyage}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  icon={ArrowLeft}
                >
                  结束航行
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Distraction Alert */}
      <AnimatePresence>
        {showDistractionAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-30"
          >
            <Card className="p-8 max-w-md mx-4 text-center">
              <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">船长正在偏航！</h2>
              <p className="text-gray-600 mb-6">
                检测到你可能分心了，你想要...
              </p>
              
              <div className="space-y-3">
                <Button
                  onClick={() => handleDistractionChoice('return_to_course')}
                  className="w-full"
                  size="lg"
                >
                  返回航线
                </Button>
                <Button
                  onClick={() => handleDistractionChoice('exploring')}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  我在探索
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Info */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
          <p className="text-white text-center">
            正在航行至 <strong>{destination.destination_name}</strong>
          </p>
          <p className="text-white/80 text-sm text-center mt-1">
            {destination.description}
          </p>
        </div>
      </div>
    </div>
  );
};