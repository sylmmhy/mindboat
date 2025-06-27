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
  const [lastDistractionType, setLastDistractionType] = useState<'tab_switch' | 'idle' | 'camera_distraction'>('tab_switch');
  
  const distractionTimeoutRef = useRef<NodeJS.Timeout>();
  const distractionStartTime = useRef<number>();
  const idleTimeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityTime = useRef<number>(Date.now());
  
  const { isVoyageActive, recordDistraction } = useVoyageStore();
  
  // Enhanced distraction detection with multiple methods
  useEffect(() => {
    if (!isVoyageActive || !isMonitoring) return;
    
    // Page Visibility API - Tab switching detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        distractionStartTime.current = Date.now();
        setLastDistractionType('tab_switch');
        
        distractionTimeoutRef.current = setTimeout(() => {
          setIsDistracted(true);
          recordDistraction({
            type: 'tab_switch',
            timestamp: distractionStartTime.current!,
          });
        }, 10000); // 10 second threshold for tab switching
      } else {
        if (distractionTimeoutRef.current) {
          clearTimeout(distractionTimeoutRef.current);
        }
        
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
        lastActivityTime.current = Date.now();
      }
    };

    // Mouse and keyboard activity detection for idle detection
    const handleActivity = () => {
      lastActivityTime.current = Date.now();
      
      // Clear idle timeout if user becomes active
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      
      // If user was idle and becomes active, clear distraction
      if (isDistracted && lastDistractionType === 'idle') {
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
        if (timeSinceActivity >= 120000) { // 2 minutes of inactivity
          setIsDistracted(true);
          setLastDistractionType('idle');
          distractionStartTime.current = Date.now() - timeSinceActivity;
          recordDistraction({
            type: 'idle',
            timestamp: distractionStartTime.current,
          });
        }
      }, 120000); // 2 minute idle threshold
    };

    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('scroll', handleActivity);
    
    // Initialize idle detection
    handleActivity();
    
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
  }, [isVoyageActive, isMonitoring, isDistracted, lastDistractionType, recordDistraction]);

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

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    lastActivityTime.current = Date.now();
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    setIsDistracted(false);
    
    if (distractionTimeoutRef.current) {
      clearTimeout(distractionTimeoutRef.current);
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
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
        type: lastDistractionType,
        timestamp: distractionStartTime.current,
        duration,
      });
      distractionStartTime.current = undefined;
    }
  }, [recordDistraction, lastDistractionType]);

  return {
    isDistracted,
    permissionsGranted,
    isMonitoring,
    lastDistractionType,
    requestPermissions,
    startMonitoring,
    stopMonitoring,
    handleDistractionResponse,
  };
};