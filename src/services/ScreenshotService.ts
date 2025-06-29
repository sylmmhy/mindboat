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

  /**
   * Initialize the screenshot service
   */
  static initialize() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
  }

  /**
   * Capture a screenshot of the current page including camera view
   */
  static async captureScreenshot(cameraStream?: MediaStream): Promise<ScreenshotData> {
    try {
      // Get the page screenshot using Screen Capture API
      const pageStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

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

      // Clean up streams
      pageStream.getTracks().forEach(track => track.stop());

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

  /**
   * Capture and analyze screenshot with AI
   */
  static async captureAndAnalyze(
    userGoal: string,
    currentTask: string,
    relatedApps: string[],
    cameraStream?: MediaStream
  ): Promise<{
    screenshot: ScreenshotData;
    analysis: ScreenshotAnalysisResult;
  }> {
    const screenshot = await this.captureScreenshot(cameraStream);
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
   * Request screen capture permission
   */
  static async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      // Stop the stream immediately - we just wanted to check permission
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.warn('Screen capture permission denied:', error);
      return false;
    }
  }
}

// Initialize the service when the module loads
ScreenshotService.initialize();