/**
 * Validation utilities for MindBoat
 * Provides consistent validation patterns for user inputs
 */

import { ValidationError } from './errorHandler';

/**
 * Validate lighthouse goal input
 */
export function validateLighthouseGoal(goal: string): void {
  if (!goal || typeof goal !== 'string') {
    throw new ValidationError('Lighthouse goal is required', 'lighthouse_goal');
  }

  const trimmed = goal.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Lighthouse goal cannot be empty', 'lighthouse_goal');
  }

  if (trimmed.length < 10) {
    throw new ValidationError('Lighthouse goal must be at least 10 characters', 'lighthouse_goal');
  }

  if (trimmed.length > 500) {
    throw new ValidationError('Lighthouse goal must be less than 500 characters', 'lighthouse_goal');
  }
}

/**
 * Validate task input for destination creation
 */
export function validateTask(task: string): void {
  if (!task || typeof task !== 'string') {
    throw new ValidationError('Task description is required', 'task');
  }

  const trimmed = task.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Task description cannot be empty', 'task');
  }

  if (trimmed.length < 3) {
    throw new ValidationError('Task description must be at least 3 characters', 'task');
  }

  if (trimmed.length > 200) {
    throw new ValidationError('Task description must be less than 200 characters', 'task');
  }

  // Check for obvious spam or invalid inputs
  if (/^\s*(.)\1{10,}\s*$/.test(trimmed)) {
    throw new ValidationError('Please enter a meaningful task description', 'task');
  }
}

/**
 * Validate planned duration for voyages
 */
export function validatePlannedDuration(duration: number): void {
  if (typeof duration !== 'number' || isNaN(duration)) {
    throw new ValidationError('Planned duration must be a valid number', 'planned_duration');
  }

  if (duration < 5) {
    throw new ValidationError('Planned duration must be at least 5 minutes', 'planned_duration');
  }

  if (duration > 480) { // 8 hours
    throw new ValidationError('Planned duration cannot exceed 8 hours', 'planned_duration');
  }

  if (duration % 1 !== 0) {
    throw new ValidationError('Planned duration must be a whole number of minutes', 'planned_duration');
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }

  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new ValidationError('Email cannot be empty', 'email');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new ValidationError('Please enter a valid email address', 'email');
  }

  if (trimmed.length > 254) {
    throw new ValidationError('Email address is too long', 'email');
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): void {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long', 'password');
  }

  if (password.length > 128) {
    throw new ValidationError('Password is too long (max 128 characters)', 'password');
  }

  // Check for common weak passwords
  const weakPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    throw new ValidationError('Please choose a stronger password', 'password');
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string, fieldName = 'id'): void {
  if (!uuid || typeof uuid !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName);
  }
}

/**
 * Validate color theme (hex color)
 */
export function validateColorTheme(color: string): void {
  if (!color || typeof color !== 'string') {
    throw new ValidationError('Color theme is required', 'color_theme');
  }

  const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
  if (!hexRegex.test(color)) {
    throw new ValidationError('Color theme must be a valid hex color', 'color_theme');
  }
}

/**
 * Sanitize text input to prevent XSS
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML characters
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .slice(0, 1000); // Limit length
}

/**
 * Validate and sanitize user input for destinations
 */
export function validateAndSanitizeDestinationInput(input: any): {
  originalTask: string;
  userId: string;
} {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Invalid input format');
  }

  const { originalTask, userId } = input;

  validateTask(originalTask);
  validateUUID(userId, 'user_id');

  return {
    originalTask: sanitizeText(originalTask),
    userId: userId.trim(),
  };
}

/**
 * Validate and sanitize voyage input
 */
export function validateAndSanitizeVoyageInput(input: any): {
  userId: string;
  destinationId: string;
  plannedDuration?: number;
} {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Invalid input format');
  }

  const { userId, destinationId, plannedDuration } = input;

  validateUUID(userId, 'user_id');
  validateUUID(destinationId, 'destination_id');

  if (plannedDuration !== undefined) {
    validatePlannedDuration(plannedDuration);
  }

  return {
    userId: userId.trim(),
    destinationId: destinationId.trim(),
    plannedDuration,
  };
}