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

  // Debug logging function
  const debugLog = useCallback((message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Distraction Debug] ${message}`, data || '');
    }
  }, []);

  // Check if current URL is task-related
  const isCurrentUrlTaskRelated = useCallback(() => {
    if (!currentDestination?.related_apps) {
      debugLog('No related apps specified, defaulting to focused');
      return true; // Default to focused if no apps specified
    }
    
    const currentUrl = window.location.href.toLowerCase();
    const currentDomain = window.location.hostname.toLowerCase();
    
    debugLog('Checking URL task relevance', {
      currentUrl,
      currentDomain,
      relatedApps: currentDestination.related_apps
    });
    
    // List of productivity-related domains that should always be considered focused
    const productivityDomains = [
      'notion.so', 'notion.site',
      'docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com',
      'office.com', 'office365.com', 'onedrive.com', 'outlook.com',
      'zotero.org',
      'github.com', 'gitlab.com', 'bitbucket.org',
      'stackoverflow.com', 'stackexchange.com',
      'overleaf.com',
      'obsidian.md',
      'evernote.com',
      'dropbox.com',
      'localhost', '127.0.0.1' // For local development
    ];
    
    // Check if current domain is inherently productive
    for (const domain of productivityDomains) {
      if (currentDomain.includes(domain)) {
        debugLog('Matched productivity domain', domain);
        return true;
      }
    }
    
    // Check if current URL contains any of the related app names
    const relatedApps = currentDestination.related_apps.map((app: string) => app.toLowerCase());
    
    // Enhanced matching for related apps
    for (const app of relatedApps) {
      // Direct URL/domain matching
      if (currentUrl.includes(app) || currentDomain.includes(app)) {
        debugLog('Matched related app in URL', app);
        return true;
      }
      
      // Special mappings for common apps
      const appMappings: Record<string, string[]> = {
        'word': ['office.com', 'office365.com', 'onedrive.com'],
        'excel': ['office.com', 'office365.com', 'onedrive.com'],
        'powerpoint': ['office.com', 'office365.com', 'onedrive.com'],
        'outlook': ['outlook.com', 'office.com', 'office365.com'],
        'google docs': ['docs.google.com'],
        'google sheets': ['sheets.google.com'],
        'google slides': ['slides.google.com'],
        'google drive': ['drive.google.com'],
        'chrome': ['google.com'], // Very broad, might need refinement
        'firefox': [], // Desktop app, no URL equivalent
        'safari': [], // Desktop app, no URL equivalent
        'vs code': ['github.com', 'code.visualstudio.com'],
        'visual studio code': ['github.com', 'code.visualstudio.com'],
        'terminal': [], // Desktop app, no URL equivalent
        'calendar': ['calendar.google.com', 'outlook.com'],
        'timer': ['focus-timer', 'pomodoro'], // Generic timer apps
        'music': ['spotify.com', 'apple.com/music', 'youtube.com/music'] // Background music might be acceptable
      };
      
      if (appMappings[app]) {
        for (const mapping of appMappings[app]) {
          if (currentDomain.includes(mapping)) {
            debugLog('Matched app mapping', { app, mapping });
            return true;
          }
        }
      }
    }
    
    // Check for common distracting domains
    const distractingDomains = [
      'youtube.com', 'youtu.be',
      'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
      'reddit.com',
      'netflix.com', 'hulu.com', 'disney.com', 'amazon.com/prime',
      'twitch.tv',
      'ebay.com', 'amazon.com/s', // Shopping
      'cnn.com', 'bbc.com', 'news.', 'reuters.com' // News sites
    ];
    
    for (const domain of distractingDomains) {
      if (currentDomain.includes(domain) || currentUrl.includes(domain)) {
        debugLog('Matched distracting domain', domain);
        return false;
      }
    }
    
    // If we can't determine, assume it's focused (benefit of the doubt)
    debugLog('No match found, defaulting to focused');
    return true;
  }, [currentDestination, debugLog]);
  
  // Monitor URL changes for navigation-based distraction detection
  const checkUrlChange = useCallback(() => {
    if (!shouldMonitor) return;
    
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrlRef.current) {
      debugLog('URL changed', { from: lastUrlRef.current, to: currentUrl });
      lastUrlRef.current = currentUrl;
      
      const isTaskRelated = isCurrentUrlTaskRelated();
      debugLog('Task relevance check result', isTaskRelated);
      
      if (!isTaskRelated && !isDistractedRef.current) {
        // User navigated to non-task-related site
        debugLog('Triggering distraction due to navigation');
        setIsDistracted(true);
        setLastDistractionType('tab_switch');
        distractionStartTime.current = Date.now();
        
        recordDistraction({
          type: 'tab_switch',
          timestamp: Date.now(),
        });
      } else if (isTaskRelated && isDistractedRef.current && lastDistractionTypeRef.current === 'tab_switch') {
        // User returned to task-related site
        debugLog('Clearing distraction due to return to task');
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
  }, [shouldMonitor, isCurrentUrlTaskRelated, recordDistraction, debugLog]);

  // Stable callback functions that don't change on every render
  const handleVisibilityChange = useCallback(() => {
    if (!shouldMonitor) return;
    
    debugLog('Visibility change', { hidden: document.hidden });
    
    if (document.hidden) {
      // Tab became hidden - user switched away
      debugLog('Tab became hidden, starting distraction timer');
      distractionStartTime.current = Date.now();
      setLastDistractionType('tab_switch');
      
      // Reduced timeout to 3 seconds for faster detection
      distractionTimeoutRef.current = setTimeout(() => {
        if (!isDistractedRef.current) {
          debugLog('Tab switch distraction triggered after timeout');
          setIsDistracted(true);
          recordDistraction({
            type: 'tab_switch',
            timestamp: distractionStartTime.current!,
          });
        }
      }, 3000); // Reduced from 10 seconds to 3 seconds
    } else {
      // Tab became visible - user returned
      debugLog('Tab became visible');
      
      if (distractionTimeoutRef.current) {
        clearTimeout(distractionTimeoutRef.current);
        debugLog('Cleared distraction timeout');
      }
      
      // Record the distraction if one was active
      if (isDistractedRef.current && distractionStartTime.current) {
        const duration = Math.floor((Date.now() - distractionStartTime.current) / 1000);
        debugLog('Recording completed distraction', { duration });
        recordDistraction({
          type: 'tab_switch',
          timestamp: distractionStartTime.current,
          duration,
        });
      }
      
      // Always clear distraction when returning to tab
      if (isDistractedRef.current) {
        debugLog('Clearing distraction on tab return');
        setIsDistracted(false);
      }
      distractionStartTime.current = undefined;
      lastActivityTime.current = Date.now();
      
      // Check URL when returning to tab (in case user navigated while away)
      setTimeout(() => {
        debugLog('Performing URL check after tab return');
        checkUrlChange();
      }, 100);
    }
  }, [shouldMonitor, recordDistraction, checkUrlChange, debugLog]);

  const handleActivity = useCallback(() => {
    if (!shouldMonitor) return;
    
    lastActivityTime.current = Date.now();
    
    // Check URL on activity to catch any navigation
    checkUrlChange();
    
    // Clear idle timeout if user becomes active
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    
    // If user was idle and becomes active, clear distraction
    if (isDistractedRef.current && lastDistractionTypeRef.current === 'idle') {
      debugLog('Clearing idle distraction due to activity');
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
    
    // Set new idle timeout (reduced to 90 seconds for testing)
    idleTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      if (timeSinceActivity >= 90000 && !isDistractedRef.current) { // 90 seconds for easier testing
        debugLog('Triggering idle distraction');
        setIsDistracted(true);
        setLastDistractionType('idle');
        distractionStartTime.current = Date.now() - timeSinceActivity;
        recordDistraction({
          type: 'idle',
          timestamp: distractionStartTime.current,
        });
      }
    }, 90000); // Reduced from 120 seconds to 90 seconds
  }, [shouldMonitor, recordDistraction, checkUrlChange, debugLog]);

  // Enhanced distraction detection with multiple methods
  useEffect(() => {
    debugLog('Distraction monitoring effect', { shouldMonitor, isExploring, isVoyageActive });
    
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
    
    debugLog('Initializing distraction monitoring', {
      initialUrl: lastUrlRef.current,
      currentDestination: currentDestination?.destination_name,
      relatedApps: currentDestination?.related_apps
    });
    
    // Initial URL check
    setTimeout(() => {
      debugLog('Performing initial URL check');
      checkUrlChange();
    }, 100);
    
    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('scroll', handleActivity);
    
    // Monitor URL changes using both popstate and a periodic check
    window.addEventListener('popstate', checkUrlChange);
    const urlCheckInterval = setInterval(() => {
      debugLog('Periodic URL check');
      checkUrlChange();
    }, 2000); // Check every 2 seconds
    
    // Initialize idle detection
    idleTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      if (timeSinceActivity >= 90000 && !isDistractedRef.current) {
        debugLog('Initial idle timeout triggered');
        setIsDistracted(true);
        setLastDistractionType('idle');
        distractionStartTime.current = Date.now() - timeSinceActivity;
        recordDistraction({
          type: 'idle',
          timestamp: distractionStartTime.current,
        });
      }
    }, 90000);
    
    return () => {
      debugLog('Cleaning up distraction monitoring');
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
  }, [shouldMonitor, handleVisibilityChange, handleActivity, recordDistraction, checkUrlChange, currentDestination, debugLog]);

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
      return false;
    }
  }, []);

  const handleDistractionResponse = useCallback(async (response: 'return_to_course' | 'exploring') => {
    debugLog('Handling distraction response', response);
    
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
  }, [recordDistraction, debugLog]);

  return {
    isDistracted,
    permissionsGranted,
    isMonitoring: shouldMonitor,
    lastDistractionType,
    requestPermissions,
    handleDistractionResponse,
  };
};