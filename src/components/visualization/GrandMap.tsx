import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Map, Calendar, Clock, TrendingUp, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useVoyageStore } from '../../stores/voyageStore';
import { useUserStore } from '../../stores/userStore';
import type { Voyage } from '../../types';

interface GrandMapProps {
  onBack: () => void;
}

export const GrandMap: React.FC<GrandMapProps> = ({ onBack }) => {
  const { voyageHistory, loadVoyageHistory } = useVoyageStore();
  const { user } = useUserStore();
  const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null);

  useEffect(() => {
    if (user) {
      loadVoyageHistory(user.id);
    }
  }, [user, loadVoyageHistory]);

  const totalFocusTime = voyageHistory.reduce((total, voyage) => 
    total + (voyage.actual_duration || 0), 0
  );

  const totalVoyages = voyageHistory.length;
  const averageFocusTime = totalVoyages > 0 ? Math.round(totalFocusTime / totalVoyages) : 0;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const generateMapPath = () => {
    if (voyageHistory.length === 0) return '';
    
    const points = voyageHistory.map((_, index) => {
      const x = 10 + (index * 80) / Math.max(voyageHistory.length - 1, 1);
      const y = 30 + Math.sin(index * 0.5) * 20 + Math.random() * 10;
      return { x, y };
    });

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cp1x = prev.x + (curr.x - prev.x) * 0.3;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) * 0.3;
      const cp2y = curr.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
    
    return path;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <Map className="w-10 h-10 mr-3" />
              航行大地图
            </h1>
            <p className="text-xl text-blue-200">你的专注成长轨迹</p>
          </div>
          <Button
            onClick={onBack}
            variant="outline"
            icon={ArrowLeft}
            className="text-white border-white hover:bg-white/10"
          >
            返回
          </Button>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Card className="p-6 text-center">
            <Calendar className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{totalVoyages}</p>
            <p className="text-sm text-gray-600">总航行次数</p>
          </Card>
          
          <Card className="p-6 text-center">
            <Clock className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{formatDuration(totalFocusTime)}</p>
            <p className="text-sm text-gray-600">累计专注时长</p>
          </Card>
          
          <Card className="p-6 text-center">
            <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{formatDuration(averageFocusTime)}</p>
            <p className="text-sm text-gray-600">平均航行时长</p>
          </Card>
        </motion.div>

        {/* Map Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-6">你的航行轨迹</h2>
            
            {voyageHistory.length === 0 ? (
              <div className="text-center py-12">
                <Map className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">还没有完成的航行</p>
                <p className="text-gray-400">开始你的第一次专注航行吧！</p>
              </div>
            ) : (
              <div className="relative">
                <svg 
                  viewBox="0 0 100 80" 
                  className="w-full h-64 md:h-80"
                  style={{ background: 'linear-gradient(to bottom, #e0f2fe 0%, #b3e5fc 100%)' }}
                >
                  {/* Ocean waves background */}
                  <defs>
                    <pattern id="waves" x="0" y="0" width="20" height="10" patternUnits="userSpaceOnUse">
                      <path d="M0,5 Q5,0 10,5 T20,5" stroke="#81d4fa" strokeWidth="0.5" fill="none" opacity="0.3"/>
                    </pattern>
                  </defs>
                  <rect width="100" height="80" fill="url(#waves)" />
                  
                  {/* Voyage path */}
                  <path
                    d={generateMapPath()}
                    stroke="#1976d2"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5,5"
                  />
                  
                  {/* Voyage points */}
                  {voyageHistory.map((voyage, index) => {
                    const x = 10 + (index * 80) / Math.max(voyageHistory.length - 1, 1);
                    const y = 30 + Math.sin(index * 0.5) * 20 + Math.random() * 10;
                    
                    return (
                      <g key={voyage.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r="3"
                          fill={voyage.destination?.color_theme || '#3B82F6'}
                          stroke="white"
                          strokeWidth="2"
                          className="cursor-pointer hover:r-4 transition-all"
                          onClick={() => setSelectedVoyage(voyage)}
                        />
                        {selectedVoyage?.id === voyage.id && (
                          <circle
                            cx={x}
                            cy={y}
                            r="6"
                            fill="none"
                            stroke={voyage.destination?.color_theme || '#3B82F6'}
                            strokeWidth="2"
                            opacity="0.5"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
                
                <p className="text-sm text-gray-500 mt-4 text-center">
                  点击地图上的点查看航行详情
                </p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Voyage Details */}
        {selectedVoyage && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">航行详情</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">目的地</h4>
                  <p className="text-lg font-semibold" style={{ color: selectedVoyage.destination?.color_theme }}>
                    {selectedVoyage.destination?.destination_name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedVoyage.destination?.description}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">航行时长:</span>
                    <span className="font-medium">{formatDuration(selectedVoyage.actual_duration || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">分心次数:</span>
                    <span className="font-medium">{selectedVoyage.distraction_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">航行日期:</span>
                    <span className="font-medium">
                      {new Date(selectedVoyage.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};