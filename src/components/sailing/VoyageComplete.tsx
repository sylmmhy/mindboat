import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, AlertTriangle, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { Voyage, Destination } from '../../types';

interface VoyageCompleteProps {
  voyage: Voyage;
  destination: Destination;
  onContinue: () => void;
}

export const VoyageComplete: React.FC<VoyageCompleteProps> = ({ 
  voyage, 
  destination, 
  onContinue 
}) => {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  };

  const getPerformanceMessage = () => {
    if (voyage.distraction_count === 0) {
      return "完美的专注航行！你的意志如灯塔般坚定。";
    } else if (voyage.distraction_count <= 2) {
      return "很好的专注表现！偶尔的分心是正常的。";
    } else if (voyage.distraction_count <= 5) {
      return "不错的尝试！专注是需要练习的技能。";
    } else {
      return "每一次航行都是成长，继续努力！";
    }
  };

  const getPerformanceColor = () => {
    if (voyage.distraction_count === 0) return 'text-green-600';
    if (voyage.distraction_count <= 2) return 'text-blue-600';
    if (voyage.distraction_count <= 5) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 mx-auto mb-4"
          >
            <Trophy className="w-24 h-24 text-yellow-400" />
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-2">航行完成！</h1>
          <p className="text-xl text-green-200">
            你已成功到达 {destination.destination_name}
          </p>
        </motion.div>

        {/* Voyage Summary */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-6"
        >
          {/* Main Stats */}
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-800">
                  {formatDuration(voyage.actual_duration || 0)}
                </p>
                <p className="text-sm text-gray-600">实际航行时长</p>
              </div>
              
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-800">
                  {voyage.distraction_count}
                </p>
                <p className="text-sm text-gray-600">分心次数</p>
              </div>
            </div>
          </Card>

          {/* Performance Message */}
          <Card className="p-6 text-center">
            <h3 className="text-xl font-semibold mb-3">航行评价</h3>
            <p className={`text-lg font-medium ${getPerformanceColor()}`}>
              {getPerformanceMessage()}
            </p>
          </Card>

          {/* Destination Info */}
          <Card className="p-6">
            <div className="flex items-start space-x-4">
              <div 
                className="w-4 h-16 rounded-full"
                style={{ backgroundColor: destination.color_theme }}
              />
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2 flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  {destination.destination_name}
                </h3>
                <p className="text-gray-600 mb-3">{destination.description}</p>
                <p className="text-sm text-gray-500">
                  原始任务: {destination.original_task}
                </p>
              </div>
            </div>
          </Card>

          {/* Planned vs Actual */}
          {voyage.planned_duration && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">计划对比</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">计划时长:</span>
                  <span className="font-medium">{formatDuration(voyage.planned_duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">实际时长:</span>
                  <span className="font-medium">{formatDuration(voyage.actual_duration || 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">完成度:</span>
                  <span className={`font-medium ${
                    (voyage.actual_duration || 0) >= voyage.planned_duration 
                      ? 'text-green-600' 
                      : 'text-orange-600'
                  }`}>
                    {Math.round(((voyage.actual_duration || 0) / voyage.planned_duration) * 100)}%
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Continue Button */}
          <div className="text-center pt-4">
            <Button
              onClick={onContinue}
              size="lg"
              icon={ArrowRight}
              className="px-8"
            >
              查看航行地图
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};