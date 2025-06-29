/**
 * Advanced Distraction Detection Hook
 * 
 * This hook implements the sophisticated distraction detection system using:
 * 1. Camera monitoring for user presence and focus
 * 2. Screenshot analysis for content relevance  
 * 3. URL blacklist checking
 * 4. High-precision timing
 * 
 * Distraction is triggered only when:
 * - Person disappears from camera > 5 minutes, OR
 * - Blacklisted content appears > 5 minutes, OR  
 * - Content is irrelevant to goal > 5 minutes
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

interface DistractionState {
  isDistracted: boolean;
  distractionType: 'camera_absence' | 'blacklisted_content' | 'irrelevant_content' | null;
  distractionStartTime: number | null;
  lastCameraCheck: number;
  lastScreenshotCheck: number;
  confidenceLevel: number;
  currentUrl: string;
}

export const useAdvancedDistraction = ({ 
  isExploring = false, 
  currentDestination,
  cameraStream 
}: UseAdvancedDistractionProps = {}) => {
  
  const [state, setState] = useState<DistractionState>({
    isDistracted: false,
    distractionType: null,
    distractionStartTime: null,
    lastCameraCheck: Date.now(),
    lastScreenshotCheck: Date.now(),
    confidenceLevel: 0,
    currentUrl: window.location.href
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastAnalysisResults, setLastAnalysisResults] = useState<{
    camera?: any;
    screenshot?: any;
  }>({});

  // Refs for intervals and timeouts
  const cameraCheckInterval = useRef<NodeJS.Timeout>();
  const screenshotCheckInterval = useRef<NodeJS.Timeout>();
  const urlCheckInterval = useRef<NodeJS.Timeout>();
  const distractionTimeoutRef = useRef<NodeJS.Timeout>();

  // Store refs for current values to avoid stale closures
  const stateRef = useRef(state);
  const isExploringRef = useRef(isExploring);
  const cameraStreamRef = useRef(cameraStream);
  const currentDestinationRef = useRef(currentDestination);

  // Update refs when state changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  // Debug logging
  const debugLog = useCallback((message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`🤖 [ADVANCED DISTRACTION] ${message}`, data || '');
    }
  }, []);

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
   * Analyze camera feed for user presence and focus
   */
  const checkCameraForDistraction = useCallback(async () => {
    if (!cameraStreamRef.current || !GeminiService.isConfigured()) {
      return;
    }

    try {
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

      // Check for distraction
      const currentTime = Date.now();
      const personAbsent = !analysis.personPresent || !analysis.appearsFocused;

      if (personAbsent) {
        if (!stateRef.current.distractionStartTime) {
          // Start tracking potential distraction
          setState(prev => ({
            ...prev,
            distractionStartTime: currentTime,
            distractionType: 'camera_absence',
            lastCameraCheck: currentTime
          }));
          
          debugLog('📹 Started tracking camera absence', { analysis });
        } else if (stateRef.current.distractionType === 'camera_absence') {
          // Check if absence duration exceeds threshold
          const absenceDuration = currentTime - stateRef.current.distractionStartTime;
          
          if (absenceDuration > DISTRACTION_THRESHOLDS.CAMERA_ABSENCE_THRESHOLD && !stateRef.current.isDistracted) {
            // Trigger distraction
            setState(prev => ({
              ...prev,
              isDistracted: true,
              confidenceLevel: analysis.confidenceLevel
            }));

            recordDistraction({
              type: 'camera_distraction',
              timestamp: stateRef.current.distractionStartTime,
            });

            debugLog('🚨 Camera distraction triggered', { 
              absenceDuration, 
              threshold: DISTRACTION_THRESHOLDS.CAMERA_ABSENCE_THRESHOLD 
            });
          }
        }
      } else {
        // Person is present and focused - clear any camera-related distraction tracking
        if (stateRef.current.distractionType === 'camera_absence') {
          setState(prev => ({
            ...prev,
            distractionStartTime: null,
            distractionType: null,
            isDistracted: false,
            lastCameraCheck: currentTime,
            confidenceLevel: analysis.confidenceLevel
          }));
          
          debugLog('✅ Camera distraction cleared - person returned', { analysis });
        } else {
          setState(prev => ({
            ...prev,
            lastCameraCheck: currentTime,
            confidenceLevel: analysis.confidenceLevel
          }));
        }
      }

    } catch (error) {
      console.error('Camera distraction check failed:', error);
    }
  }, [recordDistraction, debugLog]);

  /**
   * Analyze screenshot for content relevance
   */
  const checkScreenshotForDistraction = useCallback(async () => {
    if (!GeminiService.isConfigured() || !ScreenshotService.isSupported()) {
      return;
    }

    try {
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

      const currentTime = Date.now();
      const contentIrrelevant = !analysis.contentRelevant && analysis.distractionLevel !== 'none';

      if (contentIrrelevant) {
        if (!stateRef.current.distractionStartTime || stateRef.current.distractionType !== 'irrelevant_content') {
          // Start tracking potential distraction
          setState(prev => ({
            ...prev,
            distractionStartTime: currentTime,
            distractionType: 'irrelevant_content',
            lastScreenshotCheck: currentTime
          }));
          
          debugLog('Started tracking irrelevant content', { analysis });
        } else {
          // Check if irrelevant content duration exceeds threshold
          const irrelevantDuration = currentTime - stateRef.current.distractionStartTime;
          
          if (irrelevantDuration > DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD && !stateRef.current.isDistracted) {
            // Trigger distraction
            setState(prev => ({
              ...prev,
              isDistracted: true,
              confidenceLevel: analysis.confidenceLevel
            }));

            recordDistraction({
              type: 'tab_switch',
              timestamp: stateRef.current.distractionStartTime,
            });

            debugLog('Content distraction triggered', { 
              irrelevantDuration, 
              threshold: DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD 
            });
          }
        }
      } else {
        // Content is relevant - clear any content-related distraction tracking
        if (stateRef.current.distractionType === 'irrelevant_content') {
          setState(prev => ({
            ...prev,
            distractionStartTime: null,
            distractionType: null,
            isDistracted: false,
            lastScreenshotCheck: currentTime
          }));
          
          debugLog('Content distraction cleared - relevant content detected', { analysis });
        } else {
          setState(prev => ({
            ...prev,
            lastScreenshotCheck: currentTime
          }));
        }
      }

    } catch (error) {
      console.error('Screenshot distraction check failed:', error);
    }
  }, [recordDistraction, debugLog]);

  /**
   * Check URL for blacklisted content
   */
  const checkUrlForDistraction = useCallback(() => {
    const currentUrl = window.location.href;
    
    // Update current URL in state
    setState(prev => ({ ...prev, currentUrl }));

    // Skip check if URL is whitelisted
    if (isUrlWhitelisted(currentUrl)) {
      debugLog('URL is whitelisted, skipping distraction check', { currentUrl });
      return;
    }

    const currentTime = Date.now();
    const isBlacklisted = isUrlBlacklisted(currentUrl);
    const isIrrelevant = !isUrlRelevantToTask(currentUrl) && !isBlacklisted; // Don't double-count blacklisted as irrelevant

    if (isBlacklisted) {
      if (!stateRef.current.distractionStartTime || stateRef.current.distractionType !== 'blacklisted_content') {
        // Start tracking blacklisted content
        setState(prev => ({
          ...prev,
          distractionStartTime: currentTime,
          distractionType: 'blacklisted_content'
        }));
        
        debugLog('Started tracking blacklisted content', { currentUrl });
      } else {
        // Check if blacklisted duration exceeds threshold
        const blacklistedDuration = currentTime - stateRef.current.distractionStartTime;
        
        if (blacklistedDuration > DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD && !stateRef.current.isDistracted) {
          // Trigger distraction
          setState(prev => ({
            ...prev,
            isDistracted: true,
            confidenceLevel: 95 // High confidence for blacklisted content
          }));

          recordDistraction({
            type: 'tab_switch',
            timestamp: stateRef.current.distractionStartTime,
          });

          debugLog('Blacklist distraction triggered', { 
            blacklistedDuration, 
            threshold: DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD 
          });
        }
      }
    } else {
      // URL is not blacklisted - clear blacklist distraction tracking
      if (stateRef.current.distractionType === 'blacklisted_content') {
        setState(prev => ({
          ...prev,
          distractionStartTime: null,
          distractionType: null,
          isDistracted: false
        }));
        
        debugLog('Blacklist distraction cleared', { currentUrl });
      }
    }
  }, [isUrlBlacklisted, isUrlWhitelisted, isUrlRelevantToTask, recordDistraction, debugLog]);

  /**
   * Handle user response to distraction alert
   */
  const handleDistractionResponse = useCallback(async (response: 'return_to_course' | 'exploring') => {
    debugLog('Handling distraction response', { response, state: stateRef.current });
    
    if (response === 'return_to_course') {
      // Clear all distraction state
      setState(prev => ({
        ...prev,
        isDistracted: false,
        distractionType: null,
        distractionStartTime: null,
        confidenceLevel: 0
      }));
    }
    
    // Record the response if there was an active distraction
    if (stateRef.current.distractionStartTime) {
      const duration = Date.now() - stateRef.current.distractionStartTime;
      await recordDistraction({
        type: stateRef.current.distractionType === 'camera_absence' ? 'camera_distraction' : 'tab_switch',
        timestamp: stateRef.current.distractionStartTime,
        duration,
      });
    }
  }, [recordDistraction, debugLog]);

  // Main monitoring effect
  useEffect(() => {
    const shouldMonitor = isVoyageActive && !isExploringRef.current;
    setIsMonitoring(shouldMonitor);

    if (!shouldMonitor) {
      // Clear all intervals and reset state
      if (cameraCheckInterval.current) clearInterval(cameraCheckInterval.current);
      if (screenshotCheckInterval.current) clearInterval(screenshotCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);
      if (distractionTimeoutRef.current) clearTimeout(distractionTimeoutRef.current);

      setState({
        isDistracted: false,
        distractionType: null,
        distractionStartTime: null,
        lastCameraCheck: Date.now(),
        lastScreenshotCheck: Date.now(),
        confidenceLevel: 0,
        currentUrl: window.location.href
      });

      debugLog('Monitoring stopped');
      return;
    }

    debugLog('Starting advanced distraction monitoring', {
      hasCamera: !!cameraStreamRef.current,
      geminiConfigured: GeminiService.isConfigured(),
      screenshotSupported: ScreenshotService.isSupported()
    });

    // Set up camera monitoring
    if (cameraStreamRef.current && GeminiService.isConfigured()) {
      cameraCheckInterval.current = setInterval(() => {
        checkCameraForDistraction();
      }, DISTRACTION_THRESHOLDS.CAMERA_CHECK_INTERVAL);
      
      // Initial camera check
      setTimeout(checkCameraForDistraction, 1000);
    }

    // Set up screenshot monitoring
    if (GeminiService.isConfigured() && ScreenshotService.isSupported()) {
      screenshotCheckInterval.current = setInterval(() => {
        checkScreenshotForDistraction();
      }, DISTRACTION_THRESHOLDS.SCREENSHOT_INTERVAL);
      
      // Initial screenshot check (after a delay to let things settle)
      setTimeout(checkScreenshotForDistraction, 5000);
    }

    // Set up URL monitoring
    urlCheckInterval.current = setInterval(checkUrlForDistraction, 5000); // Check every 5 seconds
    
    // Initial URL check
    setTimeout(checkUrlForDistraction, 100);

    // Cleanup function
    return () => {
      if (cameraCheckInterval.current) clearInterval(cameraCheckInterval.current);
      if (screenshotCheckInterval.current) clearInterval(screenshotCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);
      if (distractionTimeoutRef.current) clearTimeout(distractionTimeoutRef.current);
      
      debugLog('Monitoring cleanup completed');
    };
  }, [isVoyageActive, checkCameraForDistraction, checkScreenshotForDistraction, checkUrlForDistraction, debugLog]);

  return {
    isDistracted: state.isDistracted,
    distractionType: state.distractionType,
    confidenceLevel: state.confidenceLevel,
    isMonitoring,
    lastAnalysisResults,
    currentUrl: state.currentUrl,
    handleDistractionResponse,
    
    // Diagnostic information
    diagnostics: {
      cameraAvailable: !!cameraStream,
      geminiConfigured: GeminiService.isConfigured(),
      screenshotSupported: ScreenshotService.isSupported(),
      lastCameraCheck: state.lastCameraCheck,
      lastScreenshotCheck: state.lastScreenshotCheck,
      distractionStartTime: state.distractionStartTime
    }
  };
};