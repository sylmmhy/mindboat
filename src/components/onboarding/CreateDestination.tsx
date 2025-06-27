import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { useDestinationStore } from '../../stores/destinationStore';
import { useUserStore } from '../../stores/userStore';
import type { Destination } from '../../types';

interface CreateDestinationProps {
  onComplete: () => void;
}

export const CreateDestination: React.FC<CreateDestinationProps> = ({ onComplete }) => {
  const [newTask, setNewTask] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { destinations, createDestination, deleteDestination, isLoading } = useDestinationStore();
  const { user } = useUserStore();

  const handleCreateDestination = async () => {
    if (!newTask.trim() || !user) return;
    
    setIsCreating(true);
    await createDestination(newTask, user.id);
    setNewTask('');
    setIsCreating(false);
  };

  const handleDeleteDestination = async (id: string) => {
    await deleteDestination(id);
  };

  const canProceed = destinations.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Create Your Sailing Destinations
          </h1>
          <p className="text-xl text-purple-200 mb-2">
            "Winds of Intention" will carry you to different destinations
          </p>
          <p className="text-lg text-purple-300">
            When your actions align with the wind, your sails will fill
          </p>
        </motion.div>

        {/* Create New Destination */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8"
        >
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center">
            <Plus className="w-6 h-6 mr-2" />
            Add New Task
          </h2>
          
          <div className="flex gap-4">
            <Input
              placeholder="e.g., Complete thesis, Learn piano, Build app..."
              value={newTask}
              onChange={setNewTask}
              className="flex-1"
            />
            <Button
              onClick={handleCreateDestination}
              disabled={!newTask.trim()}
              loading={isCreating}
              icon={MapPin}
            >
              Generate Destination
            </Button>
          </div>
        </motion.div>

        {/* Destinations Grid */}
        <AnimatePresence>
          {destinations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mb-8"
            >
              <h2 className="text-2xl font-semibold text-white mb-6">
                Your Destinations
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {destinations.map((destination, index) => (
                  <DestinationCard
                    key={destination.id}
                    destination={destination}
                    index={index}
                    onDelete={handleDeleteDestination}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: canProceed ? 1 : 0.5 }}
          className="text-center"
        >
          <Button
            onClick={onComplete}
            disabled={!canProceed}
            size="lg"
            icon={ArrowRight}
            className="px-8"
          >
            Start Sailing
          </Button>
          {!canProceed && (
            <p className="text-purple-300 mt-4">
              Please create at least one destination to continue
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

interface DestinationCardProps {
  destination: Destination;
  index: number;
  onDelete: (id: string) => void;
}

const DestinationCard: React.FC<DestinationCardProps> = ({ destination, index, onDelete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="relative group">
        {/* Color Theme Bar */}
        <div 
          className="h-2 w-full"
          style={{ backgroundColor: destination.color_theme }}
        />
        
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {destination.destination_name}
            </h3>
            <Button
              onClick={() => onDelete(destination.id)}
              variant="ghost"
              size="sm"
              icon={Trash2}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50"
            />
          </div>
          
          <p className="text-gray-600 mb-4 text-sm">
            {destination.description}
          </p>
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Related Apps:</p>
            <div className="flex flex-wrap gap-2">
              {destination.related_apps.map((app, appIndex) => (
                <span
                  key={appIndex}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  {app}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            Original task: {destination.original_task}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};