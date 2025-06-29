/**
 * High-Precision Timer Utilities
 * 
 * Provides high-precision timing functions for accurate focus time tracking
 * and distraction duration calculations. Uses performance.now() for sub-millisecond
 * precision when available.
 */

/**
 * Get current high-precision timestamp
 * Returns milliseconds with sub-millisecond precision when available
 */
export function getHighPrecisionTime(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now() + performance.timeOrigin;
  }
  return Date.now();
}

/**
 * Calculate duration between two high-precision timestamps
 * Returns duration in milliseconds with high precision
 */
export function calculatePreciseDuration(startTime: number, endTime?: number): number {
  const end = endTime || getHighPrecisionTime();
  return Math.max(0, end - startTime);
}

/**
 * Convert milliseconds to precise seconds (with decimal places)
 */
export function millisecondsToSeconds(milliseconds: number): number {
  return Math.round((milliseconds / 1000) * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert milliseconds to precise minutes (with decimal places)
 */
export function millisecondsToMinutes(milliseconds: number): number {
  return Math.round((milliseconds / 60000) * 100) / 100; // Round to 2 decimal places
}

/**
 * Format duration as MM:SS.ss (minutes:seconds.centiseconds)
 */
export function formatPreciseDuration(milliseconds: number): string {
  const totalSeconds = milliseconds / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = seconds.toFixed(2).padStart(5, '0'); // XX.XX format
  
  return `${minutesStr}:${secondsStr}`;
}

/**
 * Format duration as human-readable text with high precision
 */
export function formatPreciseDurationText(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const centiseconds = Math.floor((milliseconds % 1000) / 10);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}.${centiseconds.toString().padStart(2, '0')}s`;
  } else {
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}s`;
  }
}

/**
 * Create a high-precision interval timer
 * Calls the callback function at precise intervals
 */
export function createPrecisionInterval(
  callback: (elapsedTime: number) => void,
  intervalMs: number
): {
  start: () => void;
  stop: () => void;
  getElapsedTime: () => number;
} {
  let startTime: number | null = null;
  let intervalId: NodeJS.Timeout | null = null;
  let isRunning = false;

  const start = () => {
    if (isRunning) return;
    
    startTime = getHighPrecisionTime();
    isRunning = true;
    
    intervalId = setInterval(() => {
      if (startTime !== null) {
        const elapsedTime = calculatePreciseDuration(startTime);
        callback(elapsedTime);
      }
    }, intervalMs);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isRunning = false;
  };

  const getElapsedTime = (): number => {
    if (startTime === null) return 0;
    return calculatePreciseDuration(startTime);
  };

  return { start, stop, getElapsedTime };
}

/**
 * Create a high-precision stopwatch
 */
export function createPrecisionStopwatch(): {
  start: () => void;
  stop: () => number;
  pause: () => number;
  resume: () => void;
  reset: () => void;
  getElapsedTime: () => number;
  isRunning: () => boolean;
} {
  let startTime: number | null = null;
  let pausedTime: number = 0;
  let isRunning = false;
  let isPaused = false;

  const start = () => {
    if (isRunning) return;
    
    startTime = getHighPrecisionTime();
    pausedTime = 0;
    isRunning = true;
    isPaused = false;
  };

  const stop = (): number => {
    if (!isRunning || startTime === null) return 0;
    
    const elapsedTime = calculatePreciseDuration(startTime) - pausedTime;
    isRunning = false;
    isPaused = false;
    
    return elapsedTime;
  };

  const pause = (): number => {
    if (!isRunning || isPaused || startTime === null) return getElapsedTime();
    
    isPaused = true;
    const currentElapsed = calculatePreciseDuration(startTime) - pausedTime;
    pausedTime = calculatePreciseDuration(startTime) - currentElapsed;
    
    return currentElapsed;
  };

  const resume = () => {
    if (!isRunning || !isPaused) return;
    
    isPaused = false;
    // Adjust start time to account for paused time
    startTime = getHighPrecisionTime() - (calculatePreciseDuration(startTime!) - pausedTime);
    pausedTime = 0;
  };

  const reset = () => {
    startTime = null;
    pausedTime = 0;
    isRunning = false;
    isPaused = false;
  };

  const getElapsedTime = (): number => {
    if (startTime === null) return 0;
    
    if (isPaused) {
      return calculatePreciseDuration(startTime) - pausedTime;
    }
    
    return calculatePreciseDuration(startTime) - pausedTime;
  };

  return {
    start,
    stop,
    pause,
    resume,
    reset,
    getElapsedTime,
    isRunning: () => isRunning && !isPaused
  };
}

/**
 * Calculate focus quality score based on distraction data
 * Returns a score from 0-100 based on time spent focused vs distracted
 */
export function calculateFocusQuality(
  totalDuration: number,
  distractionEvents: Array<{ duration?: number }>
): number {
  if (totalDuration <= 0) return 0;
  
  const totalDistractionTime = distractionEvents.reduce(
    (sum, event) => sum + (event.duration || 0),
    0
  );
  
  const focusTime = Math.max(0, totalDuration - totalDistractionTime);
  const focusRatio = focusTime / totalDuration;
  
  return Math.round(focusRatio * 100);
}

/**
 * Calculate completion percentage based on planned vs actual duration
 */
export function calculateCompletionPercentage(
  plannedDuration: number,
  actualDuration: number
): number {
  if (plannedDuration <= 0) return 100;
  
  const completionRatio = actualDuration / plannedDuration;
  return Math.round(completionRatio * 100);
}