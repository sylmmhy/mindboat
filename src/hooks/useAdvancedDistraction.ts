/**
 * Advanced Distraction Detection Hook - Combined Screenshot + Camera Analysis
 * 
 * This hook implements sophisticated distraction detection using:
 * 1. Combined screenshot + camera analysis every 60 seconds
 * 2. URL blacklist checking (independent)
 * 3. Tab switching detection (handled by useDistraction hook)
 * 
 * The screenshot analysis now includes camera view analysis in a single request.
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


// Combined screenshot + camera detection state
interface CombinedDetectionState {
  isDistracted: boolean;
  startTime: number | null;
  lastCheck: number;
  confidenceLevel: number;
  error: string | null;
  lastCameraAnalysis: any;
  lastScreenshotAnalysis: any;
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
  

  // Combined detection state (screenshot + camera in one analysis)
  const [combinedState, setCombinedState] = useState<CombinedDetectionState>({
    isDistracted: false,
    startTime: null,
    lastCheck: Date.now(),
    confidenceLevel: 0,
    error: null,
    lastCameraAnalysis: null,
    lastScreenshotAnalysis: null
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
  }>({});

  // Refs for intervals
  const combinedCheckInterval = useRef<NodeJS.Timeout>();
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

  // Debug logging
  const debugLog = useCallback((method: string, message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`🎯 [${method}] ${message}`, data || '');
    }
  }, []);

  // Calculate combined distraction state
  const isDistracted = combinedState.isDistracted || urlState.isDistracted;
  const distractionType = 
    combinedState.isDistracted ? 'camera_distraction' :
    urlState.distractionType || 'tab_switch';
  const confidenceLevel = Math.max(combinedState.confidenceLevel, 50);

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
   * COMBINED: Analyze screenshot + camera for content relevance and user presence
   */
  const checkCombinedForDistraction = useCallback(async () => {
    if (!GeminiService.isConfigured() || !ScreenshotService.isSupported()) {
      debugLog('COMBINED', 'Skipping combined check - Gemini not configured or screenshots not supported');
      return;
    }

    debugLog('COMBINED', 'Starting combined screenshot + camera analysis...');

    try {
      setCombinedState(prev => ({ ...prev, error: null }));

      const userGoal = currentDestinationRef.current?.description || 'Focus on work';
      const currentTask = currentDestinationRef.current?.destination_name || 'Current task';
      const relatedApps = currentDestinationRef.current?.related_apps || [];

      const { analysis } = await ScreenshotService.captureAndAnalyze(
        userGoal,
        currentTask, 
        relatedApps,
        cameraStreamRef.current || undefined
      );

      setLastAnalysisResults(prev => ({ ...prev, combined: analysis }));
      debugLog('COMBINED', 'Analysis completed', { 
        contentRelevant: analysis.contentRelevant,
        cameraAnalysis: analysis.cameraAnalysis,
        distractionLevel: analysis.distractionLevel
      });

      const currentTime = Date.now();
      
      // Check both content relevance AND camera presence/focus
      const contentIrrelevant = !analysis.contentRelevant && analysis.distractionLevel !== 'none';
      const cameraIssues = !analysis.cameraAnalysis.personPresent || !analysis.cameraAnalysis.appearsFocused;
      const hasDistraction = contentIrrelevant || cameraIssues;

      if (hasDistraction) {
        setCombinedState(prev => {
          if (!prev.startTime) {
            debugLog('COMBINED', 'Started tracking distraction', { 
              contentIrrelevant, 
              cameraIssues,
              cameraAnalysis: analysis.cameraAnalysis 
            });
            return {
              ...prev,
              startTime: currentTime,
              lastCheck: currentTime,
              confidenceLevel: analysis.confidenceLevel,
              lastCameraAnalysis: analysis.cameraAnalysis,
              lastScreenshotAnalysis: analysis
            };
          } else {
            // Check if distraction duration exceeds threshold
            const distractionDuration = currentTime - prev.startTime;
            
            if (distractionDuration > DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD && !prev.isDistracted) {
              debugLog('COMBINED', '🚨 Combined distraction triggered!', { 
                distractionDuration, 
                threshold: DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD 
              });

              // Record distraction
              recordDistraction({
                type: cameraIssues ? 'camera_distraction' : 'tab_switch',
                timestamp: prev.startTime,
              });

              return {
                ...prev,
                isDistracted: true,
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
          }
        });
      } else {
        // Both content and camera are good - clear distraction
        setCombinedState(prev => {
          if (prev.isDistracted || prev.startTime) {
            debugLog('COMBINED', '✅ Combined distraction cleared - all good', { 
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

    } catch (error) {
      debugLog('COMBINED', '❌ Combined analysis failed', { error: error instanceof Error ? error.message : error });
      setCombinedState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Combined analysis failed',
        lastCheck: Date.now(),
        lastCameraAnalysis: null,
        lastScreenshotAnalysis: null
      }));
    }
  }, [recordDistraction, debugLog]);

  /**
   * Check URL for blacklisted content
   */
  const checkUrlForDistraction = useCallback(() => {
    const currentUrl = window.location.href;
    
    debugLog('URL', '🔍 Checking URL for distraction', { currentUrl });
    
    // Update current URL in state
    setUrlState(prev => ({ ...prev, currentUrl }));

    // Skip check if URL is whitelisted
    if (isUrlWhitelisted(currentUrl)) {
      debugLog('URL', '✅ URL is whitelisted, clearing any distraction', { currentUrl });
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

    debugLog('URL', '🔍 URL analysis', { 
      currentUrl, 
      isBlacklisted, 
      isIrrelevant,
      isRelevant: isUrlRelevantToTask(currentUrl)
    });

    if (isBlacklisted) {
      debugLog('URL', '🚨 BLACKLISTED content detected!', { currentUrl });
      setUrlState(prev => {
        if (!prev.startTime || prev.distractionType !== 'blacklisted_content') {
          debugLog('URL', '⏱️ Started tracking blacklisted content - 5min timer started', { 
            currentUrl, 
            threshold: DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD / 1000 + 's'
          });
          return {
            ...prev,
            startTime: currentTime,
            distractionType: 'blacklisted_content'
          };
        } else {
          // Check if blacklisted duration exceeds threshold
          const blacklistedDuration = currentTime - prev.startTime;
          const remainingTime = DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD - blacklistedDuration;
          
          debugLog('URL', '⏱️ Still on blacklisted content', { 
            currentUrl,
            duration: Math.round(blacklistedDuration / 1000) + 's',
            remaining: Math.round(remainingTime / 1000) + 's',
            threshold: DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD / 1000 + 's'
          });
          
          if (blacklistedDuration > DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD && !prev.isDistracted) {
            debugLog('URL', '🚨🚨 BLACKLIST DISTRACTION TRIGGERED! User on blacklisted site too long!', { 
              currentUrl,
              blacklistedDuration: Math.round(blacklistedDuration / 1000) + 's', 
              threshold: DISTRACTION_THRESHOLDS.BLACKLIST_THRESHOLD / 1000 + 's'
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
      debugLog('URL', '⚠️ Irrelevant content detected', { currentUrl });
      setUrlState(prev => {
        if (!prev.startTime || prev.distractionType !== 'irrelevant_content') {
          debugLog('URL', '⏱️ Started tracking irrelevant content - 5min timer started', { 
            currentUrl,
            threshold: DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD / 1000 + 's'
          });
          return {
            ...prev,
            startTime: currentTime,
            distractionType: 'irrelevant_content'
          };
        } else {
          // Check if irrelevant duration exceeds threshold
          const irrelevantDuration = currentTime - prev.startTime;
          const remainingTime = DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD - irrelevantDuration;
          
          debugLog('URL', '⏱️ Still on irrelevant content', { 
            currentUrl,
            duration: Math.round(irrelevantDuration / 1000) + 's',
            remaining: Math.round(remainingTime / 1000) + 's'
          });
          
          if (irrelevantDuration > DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD && !prev.isDistracted) {
            debugLog('URL', '🚨🚨 IRRELEVANT CONTENT DISTRACTION TRIGGERED!', { 
              currentUrl,
              irrelevantDuration: Math.round(irrelevantDuration / 1000) + 's', 
              threshold: DISTRACTION_THRESHOLDS.IRRELEVANT_CONTENT_THRESHOLD / 1000 + 's'
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
          debugLog('URL', '✅ URL distraction cleared - back to relevant content', { currentUrl });
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
    const activeStartTime = combinedState.startTime || urlState.startTime;
    if (activeStartTime) {
      const duration = Date.now() - activeStartTime;
      await recordDistraction({
        type: distractionType as any,
        timestamp: activeStartTime,
        duration,
      });
    }
  }, [recordDistraction, debugLog, combinedState.startTime, urlState.startTime, distractionType]);

  // Main monitoring effect - sets up intervals
  useEffect(() => {
    const shouldMonitor = isVoyageActive && !isExploringRef.current;
    setIsMonitoring(shouldMonitor);

    if (!shouldMonitor) {
      // Clear all intervals and reset states
      if (combinedCheckInterval.current) clearInterval(combinedCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);


      setCombinedState({
        isDistracted: false,
        startTime: null,
        lastCheck: Date.now(),
        confidenceLevel: 0,
        error: null,
        lastCameraAnalysis: null,
        lastScreenshotAnalysis: null
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

    debugLog('SYSTEM', 'Starting monitoring systems', {
      hasCamera: !!cameraStreamRef.current,
      geminiConfigured: GeminiService.isConfigured(),
      screenshotSupported: ScreenshotService.isSupported()
    });

    // Set up combined screenshot + camera monitoring
    if (GeminiService.isConfigured() && ScreenshotService.isSupported()) {
      debugLog('COMBINED', 'Setting up combined monitoring (60s interval)');
      combinedCheckInterval.current = setInterval(() => {
        checkCombinedForDistraction().catch(error => {
          debugLog('COMBINED', '❌ Combined check error', { error });
        });
      }, DISTRACTION_THRESHOLDS.SCREENSHOT_INTERVAL);
      
      // Initial combined check (after a delay to let things settle)
      setTimeout(() => {
        checkCombinedForDistraction().catch(error => {
          debugLog('COMBINED', '❌ Initial combined check error', { error });
        });
      }, 5000);
    } else {
      debugLog('COMBINED', 'Combined monitoring not available');
    }

    // Set up URL monitoring
    debugLog('URL', 'Setting up URL monitoring');
    urlCheckInterval.current = setInterval(checkUrlForDistraction, 5000); // Check every 5 seconds
    
    // Initial URL check
    setTimeout(checkUrlForDistraction, 100);

    // Cleanup function
    return () => {
      if (combinedCheckInterval.current) clearInterval(combinedCheckInterval.current);
      if (urlCheckInterval.current) clearInterval(urlCheckInterval.current);
      
      debugLog('SYSTEM', 'Monitoring cleanup completed');
    };
  }, [isVoyageActive, checkCombinedForDistraction, checkUrlForDistraction, debugLog]);

  return {
    isDistracted,
    distractionType,
    confidenceLevel,
    isMonitoring,
    lastAnalysisResults,
    currentUrl: urlState.currentUrl,
    handleDistractionResponse,
    
    // Diagnostic information
    diagnostics: {
      cameraAvailable: !!cameraStream,
      geminiConfigured: GeminiService.isConfigured(),
      screenshotSupported: ScreenshotService.isSupported(),
      
      // Combined status
      combined: {
        isActive: !!combinedCheckInterval.current,
        isDistracted: combinedState.isDistracted,
        lastCheck: combinedState.lastCheck,
        error: combinedState.error,
        confidenceLevel: combinedState.confidenceLevel,
        lastCameraAnalysis: combinedState.lastCameraAnalysis,
        lastScreenshotAnalysis: combinedState.lastScreenshotAnalysis
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