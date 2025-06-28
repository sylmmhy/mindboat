/**
 * MindBoat Service Layer
 * 
 * This module exports all service classes for easy importing
 * Services handle all business logic and database interactions
 */

export { UserService } from './UserService';
export { DestinationService } from './DestinationService';
export { VoyageService } from './VoyageService';
export { DistractionService } from './DistractionService';
export { ReflectionService } from './ReflectionService';

// Re-export types for convenience
export type { UserProfile } from './UserService';
export type { CreateDestinationInput, DestinationWithStats } from './DestinationService';
export type { StartVoyageInput, VoyageWithDestination } from './VoyageService';
export type { DistractionEvent } from './DistractionService';
export type { DailyReflection } from './ReflectionService';