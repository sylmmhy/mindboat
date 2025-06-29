/**
 * Error handling utilities for MindBoat
 * Provides consistent error handling patterns and user-friendly messages
 */

export class MindBoatError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: 'low' | 'medium' | 'high' = 'medium'
  ) {
    super(message);
    this.name = 'MindBoatError';
  }
}

export class DatabaseError extends MindBoatError {
  constructor(message: string, public originalError?: any) {
    super(message, 'DATABASE_ERROR', 'high');
    this.name = 'DatabaseError';
  }
}

export class AIServiceError extends MindBoatError {
  constructor(message: string, public originalError?: any) {
    super(message, 'AI_SERVICE_ERROR', 'medium');
    this.name = 'AIServiceError';
  }
}

export class ValidationError extends MindBoatError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 'low');
    this.name = 'ValidationError';
  }
}

/**
 * Handle service errors and convert to user-friendly messages
 */
export function handleServiceError(error: any): string {
  if (error instanceof MindBoatError) {
    return error.message;
  }

  if (error?.code === 'PGRST301') {
    return 'Database connection issue. Please try again.';
  }

  if (error?.code === '23505') {
    return 'This item already exists. Please try a different name.';
  }

  if (error?.code === '23503') {
    return 'Cannot complete this action due to related data. Please try again.';
  }

  if (error?.message?.includes('network')) {
    return 'Network connection issue. Please check your internet and try again.';
  }

  if (error?.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  console.error('Unhandled service error:', error);
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Retry wrapper for service operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  backoffMs = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry validation errors or client errors
      if (error instanceof ValidationError || 
          error?.status >= 400 && error?.status < 500) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1))
      );
    }
  }

  throw lastError;
}

/**
 * Log error for monitoring (in production, send to error tracking service)
 */
export function logError(error: any, context?: any) {
  const errorInfo = {
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    code: error?.code,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator?.userAgent,
    url: window?.location?.href,
  };

  console.error('MindBoat Error:', errorInfo);
  
  // In production, send to error tracking service like Sentry
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, { extra: errorInfo });
  // }
}