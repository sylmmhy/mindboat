import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoyageStore } from '../stores/voyageStore';
import type { DistractionDetectionEvent, PermissionState } from '../types';

export const useDistraction = () => {
  const [isDistracted, setIsDistracted] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState<PermissionState>({
    camera: false,
    microphone: false,
    screen: false
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  const distractionTimeoutRef = useRef<NodeJS.Timeout>();
  const distractionStartTime = useRef<number>();
  const { isVoyageActive, recordDistraction } = useVoyageStore();
  
  // Page Visibility API - Tab switching detection
  useEffect(() => {
    if (!isVoyageActive || !isMonitoring) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away from tab
        distractionStartTime.current = Date.now();
        distractionTimeoutRef.current = setTimeout(() => {
          setIsDistracted(true);
          recordDistraction({
            type: 'tab_switch',
            timestamp: distractionStartTime.current!,
          });
        }, 15000); // 15 second threshold
      } else {
        // User returned to tab
        if (distractionTimeoutRef.current) {
          clearTimeout(distractionTimeoutRef.current);
        }
        
        // If user was marked as distracted, record the return
        if (isDistracted && distractionStartTime.current) {
          const duration = Math.floor((Date.now() - distractionStartTime.current) / 1000);
          recordDistraction({
            type: 'tab_switch',
            timestamp: distractionStartTime.current,
            duration,
          });
        }
        
        setIsDistracted(false);
        distractionStartTime.current = undefined;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (distractionTimeoutRef.current) {
        clearTimeout(distractionTimeoutRef.current);
      }
    };
  }, [isVoyageActive, isMonitoring, isDistracted, recordDistraction]);

  const requestPermissions = useCallback(async () => {
    try {
      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setPermissionsGranted(prev => ({
        ...prev,
        camera: true,
        microphone: true
      }));
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.warn('Advanced distraction detection unavailable:', error);
      // Fall back to basic tab-switching detection
      return false;
    }
  }, []);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    setIsDistracted(false);
    if (distractionTimeoutRef.current) {
      clearTimeout(distractionTimeoutRef.current);
    }
  }, []);

  const handleDistractionResponse = useCallback(async (response: 'return_to_course' | 'exploring') => {
    if (response === 'return_to_course') {
      setIsDistracted(false);
    } else {
      // Entering exploration mode - temporarily stop monitoring
      setIsMonitoring(false);
      setIsDistracted(false);
    }
    
    // Record user response if there's an active distraction
    if (distractionStartTime.current) {
      const duration = Math.floor((Date.now() - distractionStartTime.current) / 1000);
      await recordDistraction({
        type: 'tab_switch',
        timestamp: distractionStartTime.current,
        duration,
      });
    }
  }, [recordDistraction]);

  return {
    isDistracted,
    permissionsGranted,
    isMonitoring,
    requestPermissions,
    startMonitoring,
    stopMonitoring,
    handleDistractionResponse,
  };
};