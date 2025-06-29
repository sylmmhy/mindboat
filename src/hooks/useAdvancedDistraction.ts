/**
 * Advanced Distraction Detection Hook - Complete Detection System
 * 
 * This hook implements comprehensive distraction detection using:
 * 1. Tab switching detection via Page Visibility API
 * 2. Combined screenshot + camera analysis every 60 seconds
 * 3. URL blacklist checking (independent)
 * 4. Activity and idle monitoring
 * 
 * All detection methods work together to provide comprehensive distraction monitoring.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoyageStore } from '../stores/voyageStore';
import { GeminiService } from '../services/GeminiService';
import { ScreenshotService } from '../services/ScreenshotService';
import { 
  DISTRACTION_BLACKLIST, 
  PRODUCTIVITY_WHITELIST, 
  DISTRACTION_THRESHOLDS 
} from '../config/prompts';
import type { DistractionDetectionEvent } from '../types';

interface UseAdvancedDistractionProps {
  isExploring?: boolean;
  currentDestination?: any;
  cameraStream?: MediaStream | null;
}

// Tab switching detection state
interface TabSwitchDetectionState {
  isDistracted: boolean;
  startTime: number | null;
  isTabHidden: boolean;
}

// Combined screenshot + camera detection state
interface CombinedDetectionState {
  isDistracted: boolean;
  startTime: number | null;
  lastCheck: number;
  confidenceLevel: number;
  error: string | null;
  lastCameraAnalysis: any;
  lastScreenshotAnalysis: any;
  isActive: boolean;
}

interface UrlDetectionState {
  isDistracted: boolean;
  startTime: number | null;
  currentUrl: string;
  distractionType: 'blacklisted_content' | 'irrelevant_content' | null;
}

export const useAdvancedDistraction = ({ 
  isExploring = false, 
  currentDestination,
  cameraStream 
}: UseAdvancedDistractionProps = {}) => {
  
  // Get voyage store functions
  const { isVoyageActive, recordDistraction } = useVoyageStore();

  // Tab switching detection state
  const [tabSwitchState, setTabSwitchState] = useState<TabSwitchDetectionState>({
    isDistracted: false,
    startTime: null,
    isTabHidden: false
  });

  // Combined detection state (screenshot + camera in one analysis)
  const [combinedState, setCombinedState] = useState<CombinedDetectionState>({
    isDistracted: false,
    startTime: null,
    lastCheck: Date.now(),
    confidenceLevel: 0,
    error: null,
    lastCameraAnalysis: null,
    lastScreenshotAnalysis: null,
    isActive: false
  });

  const [urlState, setUrlState] = useState<UrlDetectionState>({
    isDistracted: false,
    startTime: null,
    currentUrl: window.location.href,
    distractionType: null
  });

  // Combined state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastAnalysisResults, setLastAnalysisResults] = useState<{
    combined?: any;
    url?: any;
    tabSwitch?: any;
  }>({});

  // Refs for intervals and timeouts
  const combinedCheckInterval = useRef<NodeJS.Timeout>();
  const urlCheckInterval = useRef<NodeJS.Timeout>();
  const distractionTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Refs for state tracking
  const isExploringRef = useRef(isExploring);
  const lastUrlRef = useRef(window.location.href);
  const lastActivityTime = useRef<number>(Date.now());
  const idleTimeoutRef = useRef<NodeJS.Timeout>();

  // Update exploring ref when state changes
  useEffect(() => {
    isExploringRef.current = isExploring;
  }, [isExploring]);

  // Debug logging function
  const debugLog = useCallback((category: string, message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[${category.toUpperCase()}] ${message}`, data || '');
    }
  }, []);

  // Tab switching detection using Page Visibility API
  const handleVisibilityChange = useCallback(() => {
    const shouldMonitor = isVoyageActive && !isExploringRef.current;
    if (!shouldMonitor) return;
    
    const isHidden = document.hidden;
    
    debugLog('TAB_SWITCH', 'Visibility change detected', { 
      hidden: isHidden,
      documentVisibilityState: document.visibilityState,
      timestamp: new Date().toISOString(),
      voyageActive: isVoyageActive,
      exploring: isExploringRef.current
    });
    
    if (isHidden) {
      // Tab became hidden - user switched away
      debugLog('TAB_SWITCH', 'User switched away from tab - starting timer');
      const startTime = Date.now();
      
      setTabSwitchState(prev => ({
        ...prev,
        startTime,
        isTabHidden: true
      }));
      
      // Set timeout for distraction detection (5 seconds)
      distractionTimeoutRef.current = setTimeout(() => {
        setTabSwitchState(prev => {
          if (prev.isTabHidden && !prev.isDistracted) {
            debugLog('TAB_SWITCH', 'Distraction triggered - user away for 5+ seconds');
            
            // Record distraction
            setTimeout(() => {
              recordDistraction({
                type: 'tab_switch',
                timestamp: startTime,
              });
            }, 0);

            return {
              ...prev,
              isDistracted: true
            };
          }
          return prev;
        });
      }, 5000);
    } else {
      // Tab became visible - user returned
      debugLog('TAB_SWITCH', 'User returned to tab', {
        hadTimeout: !!distractionTimeoutRef.current,
        wasDistracted: tabSwitchState.isDistracted,
        timeAway: tabSwitchState.startTime ? 
          `${Math.round((Date.now() - tabSwitchState.startTime) / 1000)}s` : 'N/A'
      });
      
      // Clear timeout if user returned quickly
      if (distractionTimeoutRef.current) {
        clearTimeout(distractionTimeoutRef.current);
        debugLog('TAB_SWITCH', 'Cleared distraction timeout - user returned quickly');
      }
      
      // Handle distraction completion
      setTabSwitchState(prev => {
        if (prev.startTime) {
          const duration = Date.now() - prev.startTime;
          
          // Only record if distraction lasted more than 3 seconds
          if (duration >= 3000) {
            debugLog('TAB_SWITCH', 'Recording completed distraction', { 
              duration: `${Math.round(duration / 1000)} seconds`,
              wasTriggered: prev.isDistracted 
            });
            
            // Record completion with duration
            setTimeout(() => {
              recordDistraction({
                type: 'tab_switch',
                timestamp: prev.startTime!,
                duration,
              });
            }, 0);
          }
        }
        
        // Clear tab switch distraction state
        return {
          isDistracted: false,
          startTime: null,
          isTabHidden: false
        };
      });
      
      // Reset activity tracking
      lastActivityTime.current = Date.now();
      
      // Check URL when returning to tab (in case user navigated while away)
      setTimeout(() => {
        debugLog('TAB_SWITCH', 'Performing URL check after tab return');
        checkUrlChange();
      }, 100);
    }
  }, [isVoyageActive, recordDistraction, debugLog, tabSwitchState.isDistracted, tabSwitchState.startTime]);

  // URL checking for blacklisted/irrelevant content
  const checkUrlChange = useCallback(() => {
    if (!isVoyageActive || isExploringRef.current) return;

    const currentUrl = window.location.href;
    const previousUrl = lastUrlRef.current;
    
    if (currentUrl === previousUrl) return;
    
    debugLog('URL', 'URL changed detected', { from: previousUrl, to: currentUrl });
    lastUrlRef.current = currentUrl;
    
    // Check against blacklist
    const isBlacklisted = DISTRACTION_BLACKLIST.some(item => 
      currentUrl.toLowerCase().includes(item.toLowerCase())
    );
    
    // Check if task-related (simplified check)
    const isTaskRelated = currentDestination?.related_apps?.some((app: string) => 
      currentUrl.toLowerCase().includes(app.toLowerCase())
    ) || false;
    
    if (isBlacklisted) {
      debugLog('URL', 'Blacklisted site detected', { url: currentUrl });
      setUrlState(prev => ({
        ...prev,
        isDistracted: true,
        startTime: Date.now(),
        currentUrl,
        distractionType: 'blacklisted_content'
      }));
      
      recordDistraction({
        type: 'tab_switch',
        timestamp: Date.now(),
      });
    } else if (!isTaskRelated && !isBlacklisted) {
      // Check if it's an irrelevant site (not blacklisted but not related to task)
      const isProductivitySite = PRODUCTIVITY_WHITELIST.some(item => 
        currentUrl.toLowerCase().includes(item.toLowerCase())
      );
      
      if (!isProductivitySite) {
        debugLog('URL', 'Potentially irrelevant site detected', { url: currentUrl });
        setUrlState(prev => ({
          ...prev,
          isDistracted: true,
          startTime: Date.now(),
          currentUrl,
          distractionType: 'irrelevant_content'
        }));
        
        recordDistraction({
          type: 'tab_switch',
          timestamp: Date.now(),
        });
      }
    } else if (isTaskRelated && urlState.isDistracted) {
      // User returned to task-related site
      debugLog('URL', 'Clearing distraction due to return to task');
      setUrlState(prev => ({
        ...prev,
        isDistracted: false,
        startTime: null,
        distractionType: null
      }));
    }
  }, [isVoyageActive, currentDestination, urlState.isDistracted, recordDistraction, debugLog]);

  // Activity monitoring
  const handleActivity = useCallback(() => {
    const shouldMonitor = isVoyageActive && !isExploringRef.current;
    if (!shouldMonitor) return;
    
    lastActivityTime.current = Date.now();
    
    // Check URL on activity to catch any navigation
    checkUrlChange();
    
    // Clear idle timeout if user becomes active
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    
    // Set new idle timeout (90 seconds)
    idleTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      if (timeSinceActivity >= 90000 && !combinedState.isDistracted && !tabSwitchState.isDistracted) {
        debugLog('ACTIVITY', 'Idle distraction triggered after 90s of inactivity');
        
        // Set as combined distraction for simplicity
        setCombinedState(prev => ({
          ...prev,
          isDistracted: true,
          startTime: Date.now() - timeSinceActivity
        }));
        
        recordDistraction({
          type: 'idle',
          timestamp: Date.now() - timeSinceActivity,
        });
      }
    }, 90000);
  }, [isVoyageActive, checkUrlChange, debugLog, combinedState.isDistracted, tabSwitchState.isDistracted]);

  // Combined screenshot + camera analysis
  const performCombinedAnalysis = useCallback(async () => {
    if (!isVoyageActive || isExploringRef.current) return;

    debugLog('COMBINED', 'Starting combined analysis');
    
    // Mark combined analysis as active
    setCombinedState(prev => ({ ...prev, isActive: true }));
    
    try {
      // Take screenshot
      const screenshot = await ScreenshotService.captureScreen();
      if (!screenshot) {
        debugLog('COMBINED', 'No screenshot captured');
        return;
      }

      // Capture camera frame if available
      let cameraFrame = null;
      if (cameraStream) {
        try {
          // Create canvas to capture current camera frame
          const video = document.createElement('video');
          video.srcObject = cameraStream;
          video.play();
          
          // Wait for video to load
          await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
          });
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          cameraFrame = canvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
          debugLog('COMBINED', 'Camera frame capture failed', error);
        }
      }

      // Perform combined analysis
      const analysisPrompt = `Analyze this workspace for distraction. 
Task: ${currentDestination?.destination_name || 'Focus work'}
Screenshot: ${screenshot}
${cameraFrame ? `Camera: ${cameraFrame}` : 'No camera feed'}

Respond with JSON:
{
  "contentRelevant": boolean,
  "userPresent": boolean,
  "userFocused": boolean,
  "distractionLevel": "none" | "low" | "medium" | "high",
  "confidenceLevel": number,
  "cameraAnalysis": {
    "userPresent": boolean,
    "appearsFocused": boolean,
    "lookingAtScreen": boolean
  },
  "screenAnalysis": {
    "contentType": string,
    "isProductiveContent": boolean,
    "hasDistractions": boolean
  }
}`;

      const analysis = await GeminiService.analyzeContent(analysisPrompt);
      
      if (analysis) {
        const currentTime = Date.now();
        
        // Check if distraction detected
        const isContentIrrelevant = !analysis.contentRelevant;
        const cameraIssues = cameraFrame && (!analysis.userPresent || !analysis.userFocused);
        
        if (isContentIrrelevant || cameraIssues) {
          setCombinedState(prev => {
            if (!prev.isDistracted) {
              const distractionDuration = currentTime - prev.lastCheck;
              debugLog('COMBINED', 'Distraction detected via combined analysis', { 
                distractionDuration,
                contentIrrelevant: isContentIrrelevant,
                cameraIssues
              });

              // Record distraction
              setTimeout(() => {
                recordDistraction({
                  type: cameraIssues ? 'camera_distraction' : 'tab_switch',
                  timestamp: currentTime,
                });
              }, 0);

              return {
                ...prev,
                isDistracted: true,
                startTime: currentTime,
                confidenceLevel: analysis.confidenceLevel,
                lastCameraAnalysis: analysis.cameraAnalysis,
                lastScreenshotAnalysis: analysis
              };
            }
            
            return {
              ...prev,
              lastCheck: currentTime,
              confidenceLevel: analysis.confidenceLevel,
              lastCameraAnalysis: analysis.cameraAnalysis,
              lastScreenshotAnalysis: analysis
            };
          });
        } else {
          // Both content and camera are good - clear distraction
          setCombinedState(prev => {
            if (prev.isDistracted || prev.startTime) {
              debugLog('COMBINED', 'Combined distraction cleared - all good', { 
                contentRelevant: analysis.contentRelevant,
                cameraAnalysis: analysis.cameraAnalysis 
              });
            }
            return {
              ...prev,
              isDistracted: false,
              startTime: null,
              lastCheck: currentTime,
              confidenceLevel: analysis.confidenceLevel,
              lastCameraAnalysis: analysis.cameraAnalysis,
              lastScreenshotAnalysis: analysis
            };
          });
        }
      }

    } catch (error) {
      debugLog('COMBINED', 'Combined analysis failed', { error: error instanceof Error ? error.message : error });
      setCombinedState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      }));
    }
  }, [isVoyageActive, cameraStream, currentDestination, recordDistraction, debugLog]);

  // Set up all monitoring systems
  useEffect(() => {
    const shouldMonitor = isVoyageActive && !isExploring;
    setIsMonitoring(shouldMonitor);

    if (!shouldMonitor) {
      // Clear all intervals and reset states
      if (combinedCheckInterval.current) clearInterval(combinedCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);
      if (distractionTimeoutRef.current) clearTimeout(distractionTimeoutRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);

      setTabSwitchState({
        isDistracted: false,
        startTime: null,
        isTabHidden: false
      });

      setCombinedState({
        isDistracted: false,
        startTime: null,
        lastCheck: Date.now(),
        confidenceLevel: 0,
        error: null,
        lastCameraAnalysis: null,
        lastScreenshotAnalysis: null,
        isActive: false
      });

      setUrlState({
        isDistracted: false,
        startTime: null,
        currentUrl: window.location.href,
        distractionType: null
      });

      debugLog('SYSTEM', 'Monitoring stopped - all detection cleared');
      return;
    }

    debugLog('SYSTEM', 'Starting comprehensive monitoring systems', {
      hasCamera: !!cameraStream,
      currentUrl: window.location.href,
      destination: currentDestination?.destination_name
    });

    // Initialize activity tracking
    lastActivityTime.current = Date.now();
    lastUrlRef.current = window.location.href;

    // Set up tab switching detection
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up activity monitoring
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('click', handleActivity);
    document.addEventListener('scroll', handleActivity);

    // Set up URL monitoring
    window.addEventListener('popstate', checkUrlChange);
    urlCheckInterval.current = setInterval(() => {
      debugLog('URL', 'Periodic URL check');
      checkUrlChange();
    }, 5000);

    // Set up combined analysis (every 60 seconds)
    combinedCheckInterval.current = setInterval(() => {
      performCombinedAnalysis();
    }, 60000);

    // Initial checks
    setTimeout(() => {
      debugLog('SYSTEM', 'Performing initial checks');
      checkUrlChange();
    }, 100);

    // Initial idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      if (timeSinceActivity >= 90000 && !tabSwitchState.isDistracted && !combinedState.isDistracted) {
        debugLog('ACTIVITY', 'Initial idle timeout triggered');
        setCombinedState(prev => ({
          ...prev,
          isDistracted: true,
          startTime: Date.now() - timeSinceActivity
        }));
        recordDistraction({
          type: 'idle',
          timestamp: Date.now() - timeSinceActivity,
        });
      }
    }, 90000);

    return () => {
      debugLog('SYSTEM', 'Cleaning up all monitoring systems');
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('scroll', handleActivity);
      window.removeEventListener('popstate', checkUrlChange);
      
      // Clear intervals and timeouts
      if (combinedCheckInterval.current) clearInterval(combinedCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);
      if (distractionTimeoutRef.current) clearTimeout(distractionTimeoutRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [isVoyageActive, isExploring, handleVisibilityChange, handleActivity, checkUrlChange, performCombinedAnalysis, recordDistraction, debugLog, cameraStream, currentDestination, tabSwitchState.isDistracted, combinedState.isDistracted]);

  /**
   * Handle user response to distraction alert
   */
  const handleDistractionResponse = useCallback(async (response: 'return_to_course' | 'exploring') => {
    debugLog('RESPONSE', 'Handling distraction response', { response });
    
    if (response === 'return_to_course') {
      // Clear all distraction states
      setTabSwitchState(prev => ({
        ...prev,
        isDistracted: false,
        startTime: null
      }));

      setCombinedState(prev => ({
        ...prev,
        isDistracted: false,
        startTime: null
      }));
      
      setUrlState(prev => ({
        ...prev,
        isDistracted: false,
        startTime: null,
        distractionType: null
      }));
    }
    
    // Record the response if there was an active distraction
    const activeStartTime = tabSwitchState.startTime || combinedState.startTime || urlState.startTime;
    if (activeStartTime) {
      const duration = Date.now() - activeStartTime;
      setTimeout(() => {
        recordDistraction({
          type: getDominantDistractionType(),
          timestamp: activeStartTime,
          duration,
        });
      }, 0);
    }
  }, [recordDistraction, debugLog, tabSwitchState.startTime, combinedState.startTime, urlState.startTime]);

  // Helper function to determine dominant distraction type
  const getDominantDistractionType = () => {
    if (tabSwitchState.isDistracted) return 'tab_switch';
    if (urlState.isDistracted) return urlState.distractionType || 'tab_switch';
    if (combinedState.isDistracted) return 'camera_distraction';
    return 'tab_switch';
  };

  // Combined distraction state
  const isDistracted = tabSwitchState.isDistracted || combinedState.isDistracted || urlState.isDistracted;
  const distractionType = getDominantDistractionType();

  // Diagnostics for debugging
  const diagnostics = {
    tabSwitch: tabSwitchState,
    combined: combinedState,
    url: urlState,
    monitoring: isMonitoring,
    voyageActive: isVoyageActive,
    exploring: isExploring,
    // Add missing properties that SailingMode.tsx expects
    geminiConfigured: GeminiService.isConfigured(),
    cameraAvailable: !!cameraStream
  };

  return {
    isDistracted,
    distractionType,
    confidenceLevel: combinedState.confidenceLevel,
    isMonitoring,
    lastAnalysisResults: {
      combined: combinedState.lastScreenshotAnalysis,
      url: urlState,
      tabSwitch: tabSwitchState
    },
    diagnostics,
    handleDistractionResponse
  };
};