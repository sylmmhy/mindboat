import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Play, Camera, Mic, Monitor, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useDestinationStore } from '../../stores/destinationStore';
import { useVoyageStore } from '../../stores/voyageStore';
import { useDistraction } from '../../hooks/useDistraction';
import { useUserStore } from '../../stores/userStore';
import type { Destination } from '../../types';

interface VoyagePreparationProps {
  onStartVoyage: (destination: Destination) => void;
}

export const VoyagePreparation: React.FC<VoyagePreparationProps> = ({ onStartVoyage }) => {
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [plannedDuration, setPlannedDuration] = useState(25); // Default 25 minutes
  const [permissionsStep, setPermissionsStep] = useState(false);
  
  const { destinations } = useDestinationStore();
  const { startVoyage, isLoading } = useVoyageStore();
  const { user } = useUserStore();
  const { requestPermissions, permissionsGranted } = useDistraction();

  const handleDestinationSelect = (destination: Destination) => {
    setSelectedDestination(destination);
    setPermissionsStep(true);
  };

  const handleRequestPermissions = async () => {
    await requestPermissions();
  };

  const handleStartSailing = async () => {
    if (!selectedDestination || !user) return;
    
    await startVoyage(selectedDestination.id, user.id, plannedDuration);
    onStartVoyage(selectedDestination);
  };

  const encouragementMessages = [
    "May the wind guide your way and the sea open your path",
    "Every moment of focus brings you closer to your ideal self",
    "Find inner peace in the ocean of concentration",
    "Let thoughts be your sail and focus your rudder toward your goal",
  ];

  const randomEncouragement = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];

  if (permissionsStep && selectedDestination) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-20 h-20 mx-auto mb-4">
              <Anchor className="w-20 h-20 text-blue-300" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Prepare to Sail</h1>
            <p className="text-blue-200">Destination: {selectedDestination.destination_name}</p>
          </motion.div>

          <Card className="p-8 mb-6">
            <h2 className="text-2xl font-semibold mb-6 text-center">Voyage Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planned Duration (minutes)
                </label>
                <input
                  type="number"
                  value={plannedDuration}
                  onChange={(e) => setPlannedDuration(Number(e.target.value))}
                  min="5"
                  max="180"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Sensor Permissions</h3>
                <p className="text-sm text-gray-600 mb-4">
                  To better detect distraction, we need the following permissions:
                </p>
                
                <div className="space-y-3">
                  <PermissionItem
                    icon={Camera}
                    title="Camera"
                    description="Detect when your gaze leaves the screen"
                    granted={permissionsGranted.camera}
                  />
                  <PermissionItem
                    icon={Mic}
                    title="Microphone"
                    description="Detect environmental sound changes"
                    granted={permissionsGranted.microphone}
                  />
                  <PermissionItem
                    icon={Monitor}
                    title="Tab Switching"
                    description="Detect when switching to other apps"
                    granted={true} // Always available
                  />
                </div>

                {!permissionsGranted.camera && !permissionsGranted.microphone && (
                  <Button
                    onClick={handleRequestPermissions}
                    className="w-full mt-4"
                    variant="outline"
                  >
                    Request Permissions
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-800 mb-2">Daily Inspiration</p>
              <p className="text-gray-600 italic">"{randomEncouragement}"</p>
            </div>
          </Card>

          <div className="text-center">
            <Button
              onClick={handleStartSailing}
              loading={isLoading}
              size="lg"
              icon={Play}
              className="px-8 py-4 text-xl"
            >
              Start Sailing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Sailing Destination
          </h1>
          <p className="text-xl text-purple-200">
            Every moment of focus brings you closer to your ideal self
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {destinations.map((destination, index) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                index={index}
                onSelect={handleDestinationSelect}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

interface PermissionItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  granted: boolean;
}

const PermissionItem: React.FC<PermissionItemProps> = ({ icon: Icon, title, description, granted }) => (
  <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
    <Icon className="w-5 h-5 text-gray-600" />
    <div className="flex-1">
      <p className="font-medium text-gray-800">{title}</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
    {granted ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <AlertCircle className="w-5 h-5 text-yellow-500" />
    )}
  </div>
);

interface DestinationCardProps {
  destination: Destination;
  index: number;
  onSelect: (destination: Destination) => void;
}

const DestinationCard: React.FC<DestinationCardProps> = ({ destination, index, onSelect }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card 
        className="cursor-pointer transform transition-all duration-200 hover:scale-105"
        onClick={() => onSelect(destination)}
      >
        <div 
          className="h-3 w-full"
          style={{ backgroundColor: destination.color_theme }}
        />
        
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            {destination.destination_name}
          </h3>
          
          <p className="text-gray-600 mb-4 text-sm">
            {destination.description}
          </p>
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Related Apps:</p>
            <div className="flex flex-wrap gap-2">
              {destination.related_apps.slice(0, 3).map((app, appIndex) => (
                <span
                  key={appIndex}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  {app}
                </span>
              ))}
              {destination.related_apps.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  +{destination.related_apps.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};