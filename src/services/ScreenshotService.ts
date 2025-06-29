/**
 * Screenshot Service
 * 
 * Captures screenshots of the current page including the camera view
 * for AI analysis to detect if the user is working on relevant content.
 */

import { GeminiService } from './GeminiService';
import type { ScreenshotAnalysisResult } from './GeminiService';

export interface ScreenshotData {
  blob: Blob;
  timestamp: number;
  includesCamera: boolean;
}

export class ScreenshotService {
  private static canvas: HTMLCanvasElement | null = null;
  private static context: CanvasRenderingContext2D | null = null;
  private static screenStream: MediaStream | null = null;
  private static permissionGranted: boolean = false;

  /**
   * Initialize the screenshot service
   */
  static initialize() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
  }

  /**
   * Check if screen sharing permission is already granted
   */
  static isPermissionGranted(): boolean {
    return this.permissionGranted && !!this.screenStream;
  }

  /**
   * Request screen capture permission once and store the stream
   * This is now called during voyage preparation instead of first screenshot
   */
  static async requestScreenPermission(): Promise<boolean> {
    if (this.permissionGranted && this.screenStream) {
      return true;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      this.permissionGranted = true;
      
      // Listen for stream ending (user stops sharing)
      this.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('[ScreenshotService] Screen sharing ended by user');
        this.screenStream = null;
        this.permissionGranted = false;
      });

      return true;
    } catch (error) {
      console.warn('[ScreenshotService] Screen capture permission denied:', error);
      this.permissionGranted = false;
      return false;
    }
  }

  /**
   * Capture a screenshot of the current page including camera view
   * Now uses pre-granted permission instead of requesting it
   */
  static async captureScreenshot(cameraStream?: MediaStream): Promise<ScreenshotData> {
    try {
      // Check if we have screen permission (should be granted during voyage preparation)
      if (!this.permissionGranted || !this.screenStream) {
        throw new Error('Screen capture permission not granted. Please grant permission during voyage preparation.');
      }

      const pageStream = this.screenStream!;

      // Create video elements for page and camera
      const pageVideo = document.createElement('video');
      const cameraVideo = document.createElement('video');

      // Setup page video
      pageVideo.srcObject = pageStream;
      pageVideo.muted = true;
      await new Promise(resolve => {
        pageVideo.onloadedmetadata = resolve;
      });
      await pageVideo.play();

      // Setup camera video if available
      let hasCameraStream = false;
      if (cameraStream) {
        try {
          cameraVideo.srcObject = cameraStream;
          cameraVideo.muted = true;
          await new Promise(resolve => {
            cameraVideo.onloadedmetadata = resolve;
          });
          await cameraVideo.play();
          hasCameraStream = true;
        } catch (error) {
          console.warn('Failed to setup camera video for screenshot:', error);
        }
      }

      // Setup canvas
      if (!this.canvas || !this.context) {
        this.initialize();
      }

      const canvas = this.canvas!;
      const ctx = this.context!;

      // Set canvas size to match page video
      canvas.width = pageVideo.videoWidth;
      canvas.height = pageVideo.videoHeight;

      // Draw page content
      ctx.drawImage(pageVideo, 0, 0);

      // Draw camera overlay in bottom-left corner if available
      if (hasCameraStream) {
        const cameraWidth = Math.floor(canvas.width / 6); // 1/6 of width
        const cameraHeight = Math.floor(canvas.height / 6); // 1/6 of height
        const cameraX = 20; // 20px from left edge
        const cameraY = canvas.height - cameraHeight - 20; // 20px from bottom

        // Draw camera background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(cameraX - 5, cameraY - 5, cameraWidth + 10, cameraHeight + 10);

        // Draw camera content
        ctx.drawImage(cameraVideo, cameraX, cameraY, cameraWidth, cameraHeight);

        // Add label
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText('Camera', cameraX, cameraY - 10);
      }

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create screenshot blob'));
          }
        }, 'image/jpeg', 0.8);
      });

      // Don't stop the screen stream - reuse it for future screenshots
      // Only clean up temporary video elements (they're garbage collected)

      return {
        blob,
        timestamp: Date.now(),
        includesCamera: hasCameraStream
      };

    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async captureAndAnalyze(userGoal: string, currentTask: string, relatedApps: string[]): Promise<{ screenshot: ScreenshotData, analysis: ScreenshotAnalysisResult }> {
    const screenshot = await this.captureScreenshot();

    const analysis = await GeminiService.analyzeScreenshot(
      screenshot.blob,
      userGoal,
      currentTask,
      relatedApps
    );

    return { screenshot, analysis };
  }

  /**
   * Check if screen capture is supported
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices?.getDisplayMedia);
  }

  /**
   * Request screen capture permission (alias for requestScreenPermission)
   */
  static async requestPermission(): Promise<boolean> {
    return this.requestScreenPermission();
  }

  /**
   * Stop screen sharing and clean up
   */
  static stopScreenSharing(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.permissionGranted = false;
      console.log('[ScreenshotService] Screen sharing stopped');
    }
  }
}

// Initialize the service when the module loads
ScreenshotService.initialize();