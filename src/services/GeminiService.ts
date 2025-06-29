/**
 * Gemini AI Service for Image Analysis
 * 
 * This service handles all interactions with Google's Gemini 2.5 Flash model
 * for analyzing camera images and screenshots to detect user distraction.
 */

import { 
  CAMERA_ANALYSIS_PROMPT, 
  SCREENSHOT_ANALYSIS_PROMPT 
} from '../config/prompts';

export interface CameraAnalysisResult {
  personPresent: boolean;
  appearsFocused: boolean;
  confidenceLevel: number;
  observations: string;
  distractionIndicators: string[];
}

export interface ScreenshotAnalysisResult {
  contentRelevant: boolean;
  distractionType?: string;
  confidenceLevel: number;
  detectedApps: string[];
  distractionLevel: 'none' | 'mild' | 'moderate' | 'high';
  reasoning: string;
  suggestedAction: 'continue' | 'gentle_reminder' | 'intervention_needed';
  screenAnalysis: {
    contentType: string;
    isProductiveContent: boolean;
    screenObservations: string;
  };
  cameraAnalysis: {
    personPresent: boolean;
    appearsFocused: boolean;
    cameraObservations: string;
    physicalDistraction?: string;
  };
}

export class GeminiService {
  private static apiKey: string | null = null;
  private static baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  /**
   * Initialize the service with API key
   * 
   * IMPORTANT: Add your Gemini API key to your .env file as VITE_GEMINI_API_KEY
   * Get your API key from: https://makersuite.google.com/app/apikey
   */
  static initialize() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!this.apiKey) {
      console.warn('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file.');
      console.warn('Get your API key from: https://makersuite.google.com/app/apikey');
    }
  }

  /**
   * Convert image blob to base64 for Gemini API
   */
  private static async imageToBase64(imageBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });
  }

  /**
   * Make a request to Gemini API with image and text
   */
  private static async makeGeminiRequest(
    prompt: string, 
    imageBase64: string, 
    mimeType: string = 'image/jpeg'
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
    }

    const url = `${this.baseUrl}/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent analysis
        topK: 1,
        topP: 1,
        maxOutputTokens: 1000,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  }

  /**
   * Analyze camera image to detect if user is present and focused
   */
  static async analyzeCameraImage(
    imageBlob: Blob,
    userGoal: string,
    currentTask: string
  ): Promise<CameraAnalysisResult> {
    try {
      const imageBase64 = await this.imageToBase64(imageBlob);
      
      const prompt = CAMERA_ANALYSIS_PROMPT
        .replace('{userGoal}', userGoal)
        .replace('{currentTask}', currentTask);

      const responseText = await this.makeGeminiRequest(prompt, imageBase64);
      
      // Try to parse JSON response
      try {
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            personPresent: result.personPresent || false,
            appearsFocused: result.appearsFocused || false,
            confidenceLevel: result.confidenceLevel || 0,
            observations: result.observations || 'No observations',
            distractionIndicators: result.distractionIndicators || []
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse Gemini camera analysis response as JSON:', parseError);
      }

      // Fallback: analyze text response for key indicators
      const lowerResponse = responseText.toLowerCase();
      const personPresent = lowerResponse.includes('person') && !lowerResponse.includes('no person');
      const appearsFocused = lowerResponse.includes('focused') || lowerResponse.includes('concentrat');

      return {
        personPresent,
        appearsFocused,
        confidenceLevel: 50, // Medium confidence for fallback
        observations: responseText.substring(0, 200),
        distractionIndicators: []
      };

    } catch (error) {
      console.error('Camera analysis failed:', error);
      
      // Return safe fallback - assume person is present and focused to avoid false positives
      return {
        personPresent: true,
        appearsFocused: true,
        confidenceLevel: 0,
        observations: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        distractionIndicators: ['analysis_failed']
      };
    }
  }

  /**
   * Analyze screenshot to detect if content is relevant to user's goal
   * Now includes analysis of both main screen and camera view (if present)
   */
  static async analyzeScreenshot(
    imageBlob: Blob,
    userGoal: string,
    currentTask: string,
    relatedApps: string[]
  ): Promise<ScreenshotAnalysisResult> {
    try {
      const imageBase64 = await this.imageToBase64(imageBlob);
      
      const prompt = SCREENSHOT_ANALYSIS_PROMPT
        .replace('{userGoal}', userGoal)
        .replace('{currentTask}', currentTask)
        .replace('{relatedApps}', JSON.stringify(relatedApps));

      const responseText = await this.makeGeminiRequest(prompt, imageBase64);
      
      // Try to parse JSON response
      try {
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            contentRelevant: result.contentRelevant || false,
            distractionType: result.distractionType || null,
            confidenceLevel: result.confidenceLevel || 0,
            detectedApps: result.detectedApps || [],
            distractionLevel: result.distractionLevel || 'none',
            reasoning: result.reasoning || 'No reasoning provided',
            suggestedAction: result.suggestedAction || 'continue',
            screenAnalysis: result.screenAnalysis || {
              contentType: 'unknown',
              isProductiveContent: true,
              screenObservations: 'Screen analysis not available'
            },
            cameraAnalysis: result.cameraAnalysis || {
              personPresent: true,
              appearsFocused: true,
              cameraObservations: 'Camera analysis not available',
              physicalDistraction: null
            }
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse Gemini screenshot analysis response as JSON:', parseError);
      }

      // Fallback: analyze text response for key indicators
      const lowerResponse = responseText.toLowerCase();
      const contentRelevant = lowerResponse.includes('relevant') || lowerResponse.includes('productive');
      const hasDistraction = lowerResponse.includes('distract') || lowerResponse.includes('social media');

      return {
        contentRelevant: contentRelevant && !hasDistraction,
        distractionType: null,
        confidenceLevel: 50,
        detectedApps: [],
        distractionLevel: hasDistraction ? 'moderate' : 'none',
        reasoning: responseText.substring(0, 200),
        suggestedAction: hasDistraction ? 'gentle_reminder' : 'continue',
        screenAnalysis: {
          contentType: 'web content',
          isProductiveContent: !hasDistraction,
          screenObservations: 'Fallback analysis - screen content parsed from text'
        },
        cameraAnalysis: {
          personPresent: true,
          appearsFocused: true,
          cameraObservations: 'Fallback analysis - camera not analyzed',
          physicalDistraction: null
        }
      };

    } catch (error) {
      console.error('Screenshot analysis failed:', error);
      
      // Return safe fallback - assume content is relevant to avoid false positives
      return {
        contentRelevant: true,
        distractionType: null,
        confidenceLevel: 0,
        detectedApps: [],
        distractionLevel: 'none',
        reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestedAction: 'continue',
        screenAnalysis: {
          contentType: 'unknown',
          isProductiveContent: true,
          screenObservations: 'Analysis failed - no screen data'
        },
        cameraAnalysis: {
          personPresent: true,
          appearsFocused: true,
          cameraObservations: 'Analysis failed - no camera data',
          physicalDistraction: null
        }
      };
    }
  }

  /**
   * Check if the service is properly configured
   */
  static isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get configuration status and instructions
   */
  static getConfigurationStatus(): {
    isConfigured: boolean;
    message: string;
    instructions?: string;
  } {
    if (this.isConfigured()) {
      return {
        isConfigured: true,
        message: 'Gemini AI service is properly configured and ready to use.'
      };
    }

    return {
      isConfigured: false,
      message: 'Gemini AI service is not configured.',
      instructions: 'Please add your Gemini API key to the .env file as VITE_GEMINI_API_KEY. Get your API key from: https://makersuite.google.com/app/apikey'
    };
  }
}

// Initialize the service when the module loads
GeminiService.initialize();