/**
 * Voice Service for MindBoat
 * 
 * Handles speech recognition, voice interactions, and coordinates with ElevenLabs
 * for comprehensive voice-based sailing experience.
 */

import { ElevenLabsService } from './ElevenLabsService';

export interface VoiceConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface VoiceInteractionResponse {
  type: 'return_to_course' | 'exploring' | 'inspiration' | 'unknown';
  content: string;
  confidence: number;
}

export class VoiceService {
  private static recognition: any = null; // SpeechRecognition
  private static isListening = false;
  private static isInitialized = false;
  
  private static config: VoiceConfig = {
    language: 'zh-CN', // Chinese for authentic experience
    continuous: false,
    interimResults: true,
    maxAlternatives: 1
  };

  /**
   * Initialize the voice service
   */
  static async initialize(): Promise<boolean> {
    try {
      // Initialize ElevenLabs service
      const elevenLabsInitialized = ElevenLabsService.initialize();
      
      // Initialize Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = this.config.continuous;
        this.recognition.interimResults = this.config.interimResults;
        this.recognition.lang = this.config.language;
        this.recognition.maxAlternatives = this.config.maxAlternatives;
      }

      this.isInitialized = !!(this.recognition && elevenLabsInitialized);
      
      if (!this.isInitialized) {
        console.warn('Voice service partially initialized. Some features may not be available.');
      }

      return this.isInitialized;
    } catch (error) {
      console.error('Failed to initialize voice service:', error);
      return false;
    }
  }

  /**
   * Check if voice features are supported
   */
  static isSupported(): { 
    speechRecognition: boolean; 
    elevenLabs: boolean;
    fullFeatures: boolean;
  } {
    const speechRecognition = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const elevenLabs = ElevenLabsService.isConfigured();
    
    return {
      speechRecognition,
      elevenLabs,
      fullFeatures: speechRecognition && elevenLabs
    };
  }

  /**
   * Listen for speech input with timeout
   */
  static async listen(timeoutMs: number = 10000): Promise<SpeechRecognitionResult> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      if (this.isListening) {
        reject(new Error('Already listening'));
        return;
      }

      this.isListening = true;
      let finalResult: SpeechRecognitionResult | null = null;

      const timeout = setTimeout(() => {
        this.recognition.stop();
        this.isListening = false;
        if (!finalResult) {
          reject(new Error('Speech recognition timeout'));
        }
      }, timeoutMs);

      this.recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.5;
        const isFinal = result.isFinal;

        const speechResult: SpeechRecognitionResult = {
          transcript: transcript.trim(),
          confidence,
          isFinal
        };

        if (isFinal) {
          finalResult = speechResult;
          clearTimeout(timeout);
          this.isListening = false;
          resolve(speechResult);
        }
      };

      this.recognition.onerror = (event: any) => {
        clearTimeout(timeout);
        this.isListening = false;
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      this.recognition.onend = () => {
        clearTimeout(timeout);
        this.isListening = false;
        if (!finalResult) {
          reject(new Error('Speech recognition ended without result'));
        }
      };

      try {
        this.recognition.start();
      } catch (error) {
        clearTimeout(timeout);
        this.isListening = false;
        reject(error);
      }
    });
  }

  /**
   * Stop listening
   */
  static stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Analyze voice input for distraction response
   */
  static analyzeDistractionResponse(transcript: string): VoiceInteractionResponse {
    const text = transcript.toLowerCase().trim();
    
    // Chinese phrases for "I'm exploring"
    const exploringPhrases = [
      '我在探索', '我正在探索', '探索', '我在学习', '我在研究',
      '我在看资料', '我在查资料', '我在工作', '这是工作相关的',
      '我在思考', '我在查找', '我需要查一下', '工作需要'
    ];
    
    // Chinese phrases for "return to course"
    const returnPhrases = [
      '返回', '回到', '继续', '专注', '回到主航道', '返回航道',
      '继续工作', '回到工作', '专心', '集中注意力', '好的', '是的'
    ];

    // Check for exploring intent
    for (const phrase of exploringPhrases) {
      if (text.includes(phrase)) {
        return {
          type: 'exploring',
          content: transcript,
          confidence: 0.9
        };
      }
    }

    // Check for return intent
    for (const phrase of returnPhrases) {
      if (text.includes(phrase)) {
        return {
          type: 'return_to_course',
          content: transcript,
          confidence: 0.9
        };
      }
    }

    // Check if it's inspiration content
    const inspirationKeywords = [
      '记录', '灵感', '想法', '笔记', '备注', '想到', '发现',
      '学到', '总结', '心得', '体会', '感想', '收获'
    ];

    for (const keyword of inspirationKeywords) {
      if (text.includes(keyword)) {
        return {
          type: 'inspiration',
          content: transcript,
          confidence: 0.8
        };
      }
    }

    return {
      type: 'unknown',
      content: transcript,
      confidence: 0.5
    };
  }

  /**
   * Handle distraction alert with voice interaction
   */
  static async handleDistractionAlert(
    distractionType: string,
    onResponse: (response: 'return_to_course' | 'exploring') => void
  ): Promise<void> {
    try {
      // Speak the distraction alert
      await ElevenLabsService.speakDistractionAlert(distractionType);
      
      // Wait a moment, then start listening for response
      setTimeout(async () => {
        try {
          const result = await this.listen(15000); // 15 second timeout
          const analysis = this.analyzeDistractionResponse(result.transcript);
          
          if (analysis.type === 'exploring') {
            await ElevenLabsService.speakExplorationConfirmation();
            onResponse('exploring');
          } else if (analysis.type === 'return_to_course') {
            await ElevenLabsService.speakReturnConfirmation();
            onResponse('return_to_course');
          } else {
            // If unclear, default to return to course
            await ElevenLabsService.speakReturnConfirmation();
            onResponse('return_to_course');
          }
        } catch (error) {
          console.warn('Voice response not detected, defaulting to return to course');
          onResponse('return_to_course');
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to handle distraction alert:', error);
      // Fallback to non-voice interaction
      onResponse('return_to_course');
    }
  }

  /**
   * Capture inspiration via voice
   */
  static async captureVoiceInspiration(): Promise<string | null> {
    try {
      const result = await this.listen(30000); // 30 second timeout for inspiration
      
      if (result.transcript && result.transcript.length > 5) {
        await ElevenLabsService.speakInspirationConfirmation('voice');
        return result.transcript;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to capture voice inspiration:', error);
      return null;
    }
  }

  /**
   * Announce voyage completion
   */
  static async announceVoyageCompletion(destinationName: string, duration: string): Promise<void> {
    try {
      await ElevenLabsService.speakVoyageCompletion(destinationName, duration);
    } catch (error) {
      console.error('Failed to announce voyage completion:', error);
    }
  }

  /**
   * Get service status
   */
  static getStatus(): {
    initialized: boolean;
    listening: boolean;
    features: ReturnType<typeof VoiceService.isSupported>;
  } {
    return {
      initialized: this.isInitialized,
      listening: this.isListening,
      features: this.isSupported()
    };
  }
}