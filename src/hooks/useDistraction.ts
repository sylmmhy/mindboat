import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoyageStore } from '../stores/voyageStore';
import { useDestinationStore } from '../stores/destinationStore';
import type { DistractionDetectionEvent, PermissionState } from '../types';

interface UseDistractionProps {
  isExploring?: boolean;
  currentDestination?: any;
}

export const useDistraction = ({ isExploring = false, currentDestination }: UseDistractionProps = {}) => {
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
  const lastUrlRef = useRef<string>(window.location.href);
  
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

  // Check if current URL is task-related
  const isCurrentUrlTaskRelated = useCallback(() => {
    if (!currentDestination?.related_apps) return true; // Default to focused if no apps specified
    
    const currentUrl = window.location.href.toLowerCase();
    const currentDomain = window.location.hostname.toLowerCase();
    
    // List of productivity-related domains that should always be considered focused
    const productivityDomains = [
      'notion.so', 'notion.site',
      'docs.google.com', 'drive.google.com',
      'office.com', 'office365.com', 'onedrive.com',
      'zotero.org',
      'github.com', 'gitlab.com',
      'stackoverflow.com', 'stackexchange.com',
      'overleaf.com',
      'localhost' // For local development
    ];
    
    // Check if current domain is inherently productive
    if (productivityDomains.some(domain => currentDomain.includes(domain))) {
      return true;
    }
    
    // Check if current URL contains any of the related app names
    const relatedApps = currentDestination.related_apps.map((app: string) => app.toLowerCase());
    
    for (const app of relatedApps) {
      if (currentUrl.includes(app.toLowerCase()) || currentDomain.includes(app.toLowerCase())) {
        return true;
      }
    }
    
    // Check for common distracting domains
    const distractingDomains = [
      'youtube.com', 'youtu.be',
      'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com',
      'reddit.com',
      'netflix.com', 'amazon.com', 'ebay.com',
      'news.', 'cnn.com', 'bbc.com'
    ];
    
    if (distractingDomains.some(domain => currentDomain.includes(domain))) {
      return false;
    }
    
    // If we can't determine, assume it's focused (benefit of the doubt)
    return true;
  }, [currentDestination]);
  
  // Monitor URL changes for navigation-based distraction detection
  const checkUrlChange = useCallback(() => {
    if (!shouldMonitor) return;
    
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrlRef.current) {
      lastUrlRef.current = currentUrl;
      
      const isTaskRelated = isCurrentUrlTaskRelated();
      
      if (!isTaskRelated && !isDistractedRef.current) {
        // User navigated to non-task-related site
        setIsDistracted(true);
        setLastDistractionType('tab_switch'); // Using tab_switch as navigation type
        distractionStartTime.current = Date.now();
        
        recordDistraction({
          type: 'tab_switch',
          timestamp: Date.now(),
        });
      } else if (isTaskRelated && isDistractedRef.current && lastDistractionTypeRef.current === 'tab_switch') {
        // User returned to task-related site
        setIsDistracted(false);
        if (distractionStartTime.current) {
          const duration = Date.now() - distractionStartTime.current;
          recordDistraction({
            type: 'tab_switch',
            timestamp: distractionStartTime.current,
            duration,
          });
          distractionStartTime.current = undefined;
        }
      }
    }
  }, [shouldMonitor, isCurrentUrlTaskRelated, recordDistraction]);

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
      
      // Check URL when returning to tab
      setTimeout(checkUrlChange, 100);
    }
  }, [shouldMonitor, recordDistraction]);

  const handleActivity = useCallback(() => {
    if (!shouldMonitor) return;
    
    lastActivityTime.current = Date.now();
    
    // Check URL on activity
    checkUrlChange();
    
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
  }, [shouldMonitor, recordDistraction, checkUrlChange]);

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
    lastUrlRef.current = window.location.href;
    
    // Initial URL check
    setTimeout(checkUrlChange, 100);
    
    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('scroll', handleActivity);
    
    // Monitor URL changes using both popstate and a periodic check
    window.addEventListener('popstate', checkUrlChange);
    const urlCheckInterval = setInterval(checkUrlChange, 1000); // Check every second
    
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
      window.removeEventListener('popstate', checkUrlChange);
      clearInterval(urlCheckInterval);
      
      if (distractionTimeoutRef.current) {
        clearTimeout(distractionTimeoutRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [shouldMonitor, handleVisibilityChange, handleActivity, recordDistraction, checkUrlChange]);

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