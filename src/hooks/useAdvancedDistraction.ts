/**
 * Advanced Distraction Detection Hook - Independent Parallel Detection
 * 
 * This hook implements sophisticated distraction detection using multiple independent systems:
 * 1. Camera monitoring for user presence and focus (independent)
 * 2. Screenshot analysis for content relevance (independent)  
 * 3. URL blacklist checking (independent)
 * 4. Tab switching detection (handled by useDistraction hook)
 * 
 * Each detection method runs independently and reports its own status.
 * Distraction is triggered when ANY detection method indicates distraction.
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

// Independent state for each detection method
interface CameraDetectionState {
  isDistracted: boolean;
  startTime: number | null;
  lastCheck: number;
  confidenceLevel: number;
  error: string | null;
}

interface ScreenshotDetectionState {
  isDistracted: boolean;
  startTime: number | null;
  lastCheck: number;
  confidenceLevel: number;
  error: string | null;
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
  
  // Independent state for each detection method
  const [cameraState, setCameraState] = useState<CameraDetectionState>({
    isDistracted: false,
    startTime: null,
    lastCheck: Date.now(),
    confidenceLevel: 0,
    error: null
  });

  const [screenshotState, setScreenshotState] = useState<ScreenshotDetectionState>({
    isDistracted: false,
    startTime: null,
    lastCheck: Date.now(),
    confidenceLevel: 0,
    error: null
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
    camera?: any;
    screenshot?: any;
  }>({});

  // Refs for intervals
  const cameraCheckInterval = useRef<NodeJS.Timeout>();
  const screenshotCheckInterval = useRef<NodeJS.Timeout>();
  const urlCheckInterval = useRef<NodeJS.Timeout>();

  // Store refs for current values to avoid stale closures
  const isExploringRef = useRef(isExploring);
  const cameraStreamRef = useRef(cameraStream);
  const currentDestinationRef = useRef(currentDestination);

  // Update refs when state changes
  useEffect(() => {
    isExploringRef.current = isExploring;
  }, [isExploring]);

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    currentDestinationRef.current = currentDestination;
  }, [currentDestination]);

  const { isVoyageActive, recordDistraction } = useVoyageStore();

  // Debug logging with different prefixes for each detection method
  const debugLog = useCallback((method: string, message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`🎯 [${method}] ${message}`, data || '');
    }
  }, []);

  // Calculate combined distraction state
  const isDistracted = cameraState.isDistracted || screenshotState.isDistracted || urlState.isDistracted;
  const distractionType = 
    cameraState.isDistracted ? 'camera_distraction' :
    screenshotState.isDistracted ? 'irrelevant_content' :
    urlState.distractionType || 'tab_switch';
  const confidenceLevel = Math.max(cameraState.confidenceLevel, screenshotState.confidenceLevel);

  /**
   * Check if URL is in blacklist
   */
  const isUrlBlacklisted = useCallback((url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return DISTRACTION_BLACKLIST.some(blacklistedItem => 
      lowerUrl.includes(blacklistedItem.toLowerCase())
    );
  }, []);

  /**
   * Check if URL is in productivity whitelist
   */
  const isUrlWhitelisted = useCallback((url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return PRODUCTIVITY_WHITELIST.some(whitelistedItem => 
      lowerUrl.includes(whitelistedItem.toLowerCase())
    );
  }, []);

  /**
   * Check if URL is relevant to current task
   */
  const isUrlRelevantToTask = useCallback((url: string): boolean => {
    if (!currentDestinationRef.current?.related_apps) {
      return true; // If no related apps specified, assume relevant
    }

    const lowerUrl = url.toLowerCase();
    const relatedApps = currentDestinationRef.current.related_apps.map((app: string) => app.toLowerCase());

    return relatedApps.some((app: string) => 
      lowerUrl.includes(app) || lowerUrl.includes(app.replace(/\s+/g, ''))
    );
  }, []);

  /**
   * INDEPENDENT: Analyze camera feed for user presence and focus
   */
  const checkCameraForDistraction = useCallback(async () => {
    if (!cameraStreamRef.current || !GeminiService.isConfigured()) {
      debugLog('CAMERA', 'Skipping camera check - no stream or Gemini not configured');
      return;
    }

    debugLog('CAMERA', 'Starting camera analysis...');

    try {
      setCameraState(prev => ({ ...prev, error: null }));

      // Capture frame from camera stream
      const video = document.createElement('video');
      video.srcObject = cameraStreamRef.current;
      video.muted = true;
      
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });
      await video.play();

      // Capture image from video
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to capture camera frame'));
        }, 'image/jpeg', 0.8);
      });

      // Analyze with Gemini
      const userGoal = currentDestinationRef.current?.description || 'Focus on work';
      const currentTask = currentDestinationRef.current?.destination_name || 'Current task';

      const analysis = await GeminiService.analyzeCameraImage(blob, userGoal, currentTask);
      
      setLastAnalysisResults(prev => ({ ...prev, camera: analysis }));
      debugLog('CAMERA', 'Analysis completed', { analysis });

      // Check for distraction
      const currentTime = Date.now();
      const personAbsent = !analysis.personPresent || !analysis.appearsFocused;

      if (personAbsent) {
        setCameraState(prev => {
          if (!prev.startTime) {
            debugLog('CAMERA', 'Started tracking camera absence', { analysis });
            return {
              ...prev,
              startTime: currentTime,
              lastCheck: currentTime,
              confidenceLevel: analysis.confidenceLevel
            };
          } else {
            // Check if absence duration exceeds threshold
            const absenceDuration = currentTime - prev.startTime;
            
            if (absenceDuration > DISTRACTION_THRESHOLDS.CAMERA_ABSENCE_THRESHOLD && !prev.isDistracted) {
              debugLog('CAMERA', '🚨 Camera distraction triggered!', { 
                absenceDuration, 
                threshold: DISTRACTION_THRESHOLDS.CAMERA_ABSENCE_THRESHOLD 
              });

              // Record distraction
              recordDistraction({
                type: 'camera_distraction',
                timestamp: prev.startTime,
              });

              return {
                ...prev,
                isDistracted: true,
                confidenceLevel: analysis.confidenceLevel
              };
            }
            
            return {
              ...prev,
              lastCheck: currentTime,
              confidenceLevel: analysis.confidenceLevel
            };
          }
        });
      } else {
        // Person is present and focused - clear camera-related distraction
        setCameraState(prev => {
          if (prev.isDistracted || prev.startTime) {
            debugLog('CAMERA', '✅ Camera distraction cleared - person returned', { analysis });
          }
          return {
            ...prev,
            isDistracted: false,
            startTime: null,
            lastCheck: currentTime,
            confidenceLevel: analysis.confidenceLevel
          };
        });
      }

    } catch (error) {
      debugLog('CAMERA', '❌ Camera analysis failed', { error: error instanceof Error ? error.message : error });
      setCameraState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Camera analysis failed',
        lastCheck: Date.now()
      }));
    }
  }, [recordDistraction, debugLog]);

  /**
   * INDEPENDENT: Analyze screenshot for content relevance
   */
  const checkScreenshotForDistraction = useCallback(async () => {
    if (!GeminiService.isConfigured() || !ScreenshotService.isSupported()) {
      debugLog('SCREENSHOT', 'Skipping screenshot check - Gemini not configured or screenshots not supported');
      return;
    }

    debugLog('SCREENSHOT', 'Starting screenshot analysis...');

    try {
      setScreenshotState(prev => ({ ...prev, error: null }));

      const userGoal = currentDestinationRef.current?.description || 'Focus on work';
      const currentTask = currentDestinationRef.current?.destination_name || 'Current task';
      const relatedApps = currentDestinationRef.current?.related_apps || [];

      const { analysis } = await ScreenshotService.captureAndAnalyze(
        userGoal,
        currentTask, 
        relatedApps,
        cameraStreamRef.current || undefined
      );

      setLastAnalysisResults(prev => ({ ...prev, screenshot: analysis }));
      debugLog('SCREENSHOT', 'Analysis completed', { analysis });

      const currentTime = Date.now();
      const contentIrrelevant = !analysis.contentRelevant && analysis.distractionLevel !== 'none';

      if (contentIrrelevant) {
        setScreenshotState(prev => {
          if (!prev.startTime) {
            debugLog('SCREENSHOT', 'Started tracking irrelevant content', { analysis });
            return {
              ...prev,
              startTime: currentTime,
              lastCheck: currentTime,
              confidenceLevel: analysis.confidenceLevel
            };
          } else {
            // Check if irrelevant content duration exceeds threshold
            const irrelevantDuration = currentTime - prev.startTime;
            
            if (irrelevantDuration > DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD && !prev.isDistracted) {
              debugLog('SCREENSHOT', '🚨 Content distraction triggered!', { 
                irrelevantDuration, 
                threshold: DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD 
              });

              // Record distraction
              recordDistraction({
                type: 'tab_switch',
                timestamp: prev.startTime,
              });

              return {
                ...prev,
                isDistracted: true,
                confidenceLevel: analysis.confidenceLevel
              };
            }
            
            return {
              ...prev,
              lastCheck: currentTime,
              confidenceLevel: analysis.confidenceLevel
            };
          }
        });
      } else {
        // Content is relevant - clear content-related distraction
        setScreenshotState(prev => {
          if (prev.isDistracted || prev.startTime) {
            debugLog('SCREENSHOT', '✅ Content distraction cleared - relevant content detected', { analysis });
          }
          return {
            ...prev,
            isDistracted: false,
            startTime: null,
            lastCheck: currentTime,
            confidenceLevel: analysis.confidenceLevel
          };
        });
      }

    } catch (error) {
      debugLog('SCREENSHOT', '❌ Screenshot analysis failed', { error: error instanceof Error ? error.message : error });
      setScreenshotState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Screenshot analysis failed',
        lastCheck: Date.now()
      }));
    }
  }, [recordDistraction, debugLog]);

  /**
   * INDEPENDENT: Check URL for blacklisted content
   */
  const checkUrlForDistraction = useCallback(() => {
    const currentUrl = window.location.href;
    
    debugLog('URL', 'Checking URL for distraction', { currentUrl });
    
    // Update current URL in state
    setUrlState(prev => ({ ...prev, currentUrl }));

    // Skip check if URL is whitelisted
    if (isUrlWhitelisted(currentUrl)) {
      debugLog('URL', 'URL is whitelisted, clearing any distraction', { currentUrl });
      setUrlState(prev => ({
        ...prev,
        isDistracted: false,
        startTime: null,
        distractionType: null
      }));
      return;
    }

    const currentTime = Date.now();
    const isBlacklisted = isUrlBlacklisted(currentUrl);
    const isIrrelevant = !isUrlRelevantToTask(currentUrl) && !isBlacklisted;

    if (isBlacklisted) {
      debugLog('URL', 'Blacklisted content detected', { currentUrl });
      setUrlState(prev => {
        if (!prev.startTime || prev.distractionType !== 'blacklisted_content') {
          debugLog('URL', 'Started tracking blacklisted content', { currentUrl });
          return {
            ...prev,
            startTime: currentTime,
            distractionType: 'blacklisted_content'
          };
        } else {
          // Check if blacklisted duration exceeds threshold
          const blacklistedDuration = currentTime - prev.startTime;
          
          if (blacklistedDuration > DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD && !prev.isDistracted) {
            debugLog('URL', '🚨 Blacklist distraction triggered!', { 
              blacklistedDuration, 
              threshold: DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD 
            });

            // Record distraction
            recordDistraction({
              type: 'tab_switch',
              timestamp: prev.startTime,
            });

            return {
              ...prev,
              isDistracted: true
            };
          }
          
          return prev;
        }
      });
    } else if (isIrrelevant) {
      debugLog('URL', 'Irrelevant content detected', { currentUrl });
      setUrlState(prev => {
        if (!prev.startTime || prev.distractionType !== 'irrelevant_content') {
          debugLog('URL', 'Started tracking irrelevant content', { currentUrl });
          return {
            ...prev,
            startTime: currentTime,
            distractionType: 'irrelevant_content'
          };
        } else {
          // Check if irrelevant duration exceeds threshold
          const irrelevantDuration = currentTime - prev.startTime;
          
          if (irrelevantDuration > DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD && !prev.isDistracted) {
            debugLog('URL', '🚨 Irrelevant content distraction triggered!', { 
              irrelevantDuration, 
              threshold: DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD 
            });

            // Record distraction
            recordDistraction({
              type: 'tab_switch',
              timestamp: prev.startTime,
            });

            return {
              ...prev,
              isDistracted: true
            };
          }
          
          return prev;
        }
      });
    } else {
      // URL is relevant - clear URL-related distraction
      setUrlState(prev => {
        if (prev.isDistracted || prev.startTime) {
          debugLog('URL', '✅ URL distraction cleared - relevant content', { currentUrl });
        }
        return {
          ...prev,
          isDistracted: false,
          startTime: null,
          distractionType: null
        };
      });
    }
  }, [isUrlBlacklisted, isUrlWhitelisted, isUrlRelevantToTask, recordDistraction, debugLog]);

  /**
   * Handle user response to distraction alert
   */
  const handleDistractionResponse = useCallback(async (response: 'return_to_course' | 'exploring') => {
    debugLog('RESPONSE', 'Handling distraction response', { response });
    
    if (response === 'return_to_course') {
      // Clear all distraction states
      setCameraState(prev => ({
        ...prev,
        isDistracted: false,
        startTime: null
      }));
      
      setScreenshotState(prev => ({
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
    const activeStartTime = cameraState.startTime || screenshotState.startTime || urlState.startTime;
    if (activeStartTime) {
      const duration = Date.now() - activeStartTime;
      await recordDistraction({
        type: distractionType as any,
        timestamp: activeStartTime,
        duration,
      });
    }
  }, [recordDistraction, debugLog, cameraState.startTime, screenshotState.startTime, urlState.startTime, distractionType]);

  // Main monitoring effect - sets up independent intervals
  useEffect(() => {
    const shouldMonitor = isVoyageActive && !isExploringRef.current;
    setIsMonitoring(shouldMonitor);

    if (!shouldMonitor) {
      // Clear all intervals and reset states
      if (cameraCheckInterval.current) clearInterval(cameraCheckInterval.current);
      if (screenshotCheckInterval.current) clearInterval(screenshotCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);

      setCameraState({
        isDistracted: false,
        startTime: null,
        lastCheck: Date.now(),
        confidenceLevel: 0,
        error: null
      });

      setScreenshotState({
        isDistracted: false,
        startTime: null,
        lastCheck: Date.now(),
        confidenceLevel: 0,
        error: null
      });

      setUrlState({
        isDistracted: false,
        startTime: null,
        currentUrl: window.location.href,
        distractionType: null
      });

      debugLog('SYSTEM', 'Monitoring stopped - all detection systems cleared');
      return;
    }

    debugLog('SYSTEM', 'Starting independent monitoring systems', {
      hasCamera: !!cameraStreamRef.current,
      geminiConfigured: GeminiService.isConfigured(),
      screenshotSupported: ScreenshotService.isSupported()
    });

    // Set up INDEPENDENT camera monitoring
    if (cameraStreamRef.current && GeminiService.isConfigured()) {
      debugLog('CAMERA', 'Setting up camera monitoring');
      cameraCheckInterval.current = setInterval(() => {
        checkCameraForDistraction().catch(error => {
          debugLog('CAMERA', '❌ Camera check error', { error });
        });
      }, DISTRACTION_THRESHOLDS.CAMERA_CHECK_INTERVAL);
      
      // Initial camera check
      setTimeout(() => {
        checkCameraForDistraction().catch(error => {
          debugLog('CAMERA', '❌ Initial camera check error', { error });
        });
      }, 1000);
    } else {
      debugLog('CAMERA', 'Camera monitoring not available');
    }

    // Set up INDEPENDENT screenshot monitoring
    if (GeminiService.isConfigured() && ScreenshotService.isSupported()) {
      debugLog('SCREENSHOT', 'Setting up screenshot monitoring');
      screenshotCheckInterval.current = setInterval(() => {
        checkScreenshotForDistraction().catch(error => {
          debugLog('SCREENSHOT', '❌ Screenshot check error', { error });
        });
      }, DISTRACTION_THRESHOLDS.SCREENSHOT_INTERVAL);
      
      // Initial screenshot check (after a delay to let things settle)
      setTimeout(() => {
        checkScreenshotForDistraction().catch(error => {
          debugLog('SCREENSHOT', '❌ Initial screenshot check error', { error });
        });
      }, 5000);
    } else {
      debugLog('SCREENSHOT', 'Screenshot monitoring not available');
    }

    // Set up INDEPENDENT URL monitoring
    debugLog('URL', 'Setting up URL monitoring');
    urlCheckInterval.current = setInterval(checkUrlForDistraction, 5000); // Check every 5 seconds
    
    // Initial URL check
    setTimeout(checkUrlForDistraction, 100);

    // Cleanup function
    return () => {
      if (cameraCheckInterval.current) clearInterval(cameraCheckInterval.current);
      if (screenshotCheckInterval.current) clearInterval(screenshotCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);
      
      debugLog('SYSTEM', 'Monitoring cleanup completed');
    };
  }, [isVoyageActive, checkCameraForDistraction, checkScreenshotForDistraction, checkUrlForDistraction, debugLog]);

  return {
    isDistracted,
    distractionType,
    confidenceLevel,
    isMonitoring,
    lastAnalysisResults,
    currentUrl: urlState.currentUrl,
    handleDistractionResponse,
    
    // Diagnostic information for each detection method
    diagnostics: {
      cameraAvailable: !!cameraStream,
      geminiConfigured: GeminiService.isConfigured(),
      screenshotSupported: ScreenshotService.isSupported(),
      
      // Independent status for each detection method
      camera: {
        isActive: !!cameraCheckInterval.current,
        isDistracted: cameraState.isDistracted,
        lastCheck: cameraState.lastCheck,
        error: cameraState.error,
        confidenceLevel: cameraState.confidenceLevel
      },
      
      screenshot: {
        isActive: !!screenshotCheckInterval.current,
        isDistracted: screenshotState.isDistracted,
        lastCheck: screenshotState.lastCheck,
        error: screenshotState.error,
        confidenceLevel: screenshotState.confidenceLevel
      },
      
      url: {
        isActive: !!urlCheckInterval.current,
        isDistracted: urlState.isDistracted,
        currentUrl: urlState.currentUrl,
        distractionType: urlState.distractionType
      }
    }
  };
};
</Action>