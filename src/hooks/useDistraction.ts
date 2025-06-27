import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoyageStore } from '../stores/voyageStore';
import type { DistractionDetectionEvent, PermissionState } from '../types';

interface UseDistractionProps {
  isExploring?: boolean;
}

export const useDistraction = ({ isExploring = false }: UseDistractionProps = {}) => {
  const [isDistracted, setIsDistracted] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState<PermissionState>({
    camera: false,
    microphone: false,
    screen: false
  });
  const [lastDistractionType, setLastDistractionType] = useState<'tab_switch' | 'idle' | 'camera_distraction'>('tab_switch');
  
  // Refs to track current state values without causing re-renders
  const isDistractedRef = useRef(isDistracted);
  const lastDistractionTypeRef = useRef(lastDistractionType);
  
  const distractionTimeoutRef = useRef<NodeJS.Timeout>();
  const distractionStartTime = useRef<number>();
  const idleTimeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityTime = useRef<number>(Date.now());
  
  const { isVoyageActive, recordDistraction } = useVoyageStore();
  
  // Determine if monitoring should be active
  const shouldMonitor = isVoyageActive && !isExploring;
  
  // Update refs when state changes
  useEffect(() => {
    isDistractedRef.current = isDistracted;
  }, [isDistracted]);
  
  useEffect(() => {
    lastDistractionTypeRef.current = lastDistractionType;
  }, [lastDistractionType]);

  // Stable callback functions that don't change on every render
  const handleVisibilityChange = useCallback(() => {
    if (!shouldMonitor) return;
    
    if (document.hidden) {
      distractionStartTime.current = Date.now();
      setLastDistractionType('tab_switch');
      
      distractionTimeoutRef.current = setTimeout(() => {
        if (!isDistractedRef.current) {
          setIsDistracted(true);
          recordDistraction({
            type: 'tab_switch',
            timestamp: distractionStartTime.current!,
          });
        }
      }, 10000); // 10 second threshold for tab switching
    } else {
      if (distractionTimeoutRef.current) {
        clearTimeout(distractionTimeoutRef.current);
      }
      
      if (isDistractedRef.current && distractionStartTime.current) {
        const duration = Math.floor((Date.now() - distractionStartTime.current) / 1000);
        recordDistraction({
          type: 'tab_switch',
          timestamp: distractionStartTime.current,
          duration,
        });
      }
      
      if (isDistractedRef.current) {
        setIsDistracted(false);
      }
      distractionStartTime.current = undefined;
      lastActivityTime.current = Date.now();
    }
  }, [shouldMonitor, recordDistraction]);

  const handleActivity = useCallback(() => {
    if (!shouldMonitor) return;
    
    lastActivityTime.current = Date.now();
    
    // Clear idle timeout if user becomes active
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    
    // If user was idle and becomes active, clear distraction
    if (isDistractedRef.current && lastDistractionTypeRef.current === 'idle') {
      setIsDistracted(false);
      if (distractionStartTime.current) {
        const duration = Math.floor((Date.now() - distractionStartTime.current) / 1000);
        recordDistraction({
          type: 'idle',
          timestamp: distractionStartTime.current,
          duration,
        });
        distractionStartTime.current = undefined;
      }
    }
    
    // Set new idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      if (timeSinceActivity >= 120000 && !isDistractedRef.current) { // 2 minutes of inactivity
        setIsDistracted(true);
        setLastDistractionType('idle');
        distractionStartTime.current = Date.now() - timeSinceActivity;
        recordDistraction({
          type: 'idle',
          timestamp: distractionStartTime.current,
        });
      }
    }, 120000); // 2 minute idle threshold
  }, [shouldMonitor, recordDistraction]);

  // Enhanced distraction detection with multiple methods
  useEffect(() => {
    if (!shouldMonitor) {
      // Clear any active distractions when monitoring stops
      setIsDistracted(false);
      if (distractionTimeoutRef.current) {
        clearTimeout(distractionTimeoutRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      return;
    }
    
    // Initialize activity tracking
    lastActivityTime.current = Date.now();
    
    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('scroll', handleActivity);
    
    // Initialize idle detection
    idleTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      if (timeSinceActivity >= 120000 && !isDistractedRef.current) { // 2 minutes of inactivity
        setIsDistracted(true);
        setLastDistractionType('idle');
        distractionStartTime.current = Date.now() - timeSinceActivity;
        recordDistraction({
          type: 'idle',
          timestamp: distractionStartTime.current,
        });
      }
    }, 120000); // 2 minute idle threshold
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('scroll', handleActivity);
      
      if (distractionTimeoutRef.current) {
        clearTimeout(distractionTimeoutRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [shouldMonitor, handleVisibilityChange, handleActivity, recordDistraction]);

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
      
      // TODO: Implement advanced camera-based distraction detection
      // This would involve analyzing video frames to detect:
      // - Face detection and gaze direction
      // - Presence detection (user leaving the camera view)
      // - Multiple people in frame (distractions)
      
      return true;
    } catch (error) {
      console.warn('Advanced distraction detection unavailable:', error);
      return false;
    }
  }, []);

  const handleDistractionResponse = useCallback(async (response: 'return_to_course' | 'exploring') => {
    if (response === 'return_to_course') {
      setIsDistracted(false);
      lastActivityTime.current = Date.now();
    }
    
    // Record user response if there's an active distraction
    if (distractionStartTime.current) {
      const duration = Math.floor((Date.now() - distractionStartTime.current) / 1000);
      await recordDistraction({
        type: lastDistractionTypeRef.current,
        timestamp: distractionStartTime.current,
        duration,
      });
      distractionStartTime.current = undefined;
    }
  }, [recordDistraction]);

  return {
    isDistracted,
    permissionsGranted,
    isMonitoring: shouldMonitor,
    lastDistractionType,
    requestPermissions,
    handleDistractionResponse,
  };
};