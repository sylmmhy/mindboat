/**
 * ElevenLabs Voice Service for MindBoat
 * 
 * Handles high-quality AI voice generation using ElevenLabs API
 * for distraction alerts, exploration mode responses, and inspiration capture.
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string; // Default voice ID for the AI companion
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export interface VoiceGenerationOptions {
  text: string;
  voiceId?: string;
  model?: string;
  voiceSettings?: {
    stability: number;
    similarityBoost: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

export class ElevenLabsService {
  private static config: ElevenLabsConfig = {
    apiKey: '',
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice - calm and professional
    model: 'eleven_multilingual_v2', // Supports multiple languages
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.3,
    useSpeakerBoost: true
  };

  private static baseUrl = 'https://api.elevenlabs.io/v1';
  private static audioContext: AudioContext | null = null;

  /**
   * Initialize the ElevenLabs service
   */
  static initialize(apiKey?: string): boolean {
    try {
      this.config.apiKey = apiKey || import.meta.env.VITE_ELEVENLABS_API_KEY || '';
      
      if (!this.config.apiKey) {
        console.warn('ElevenLabs API key not found. Please add VITE_ELEVENLABS_API_KEY to your .env file.');
        return false;
      }

      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize ElevenLabs service:', error);
      return false;
    }
  }

  /**
   * Check if the service is properly configured
   */
  static isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Generate and play voice audio from text
   */
  static async generateAndPlayVoice(options: VoiceGenerationOptions): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs service not configured. Please add your API key.');
    }

    try {
      const audioBlob = await this.generateVoice(options);
      await this.playAudio(audioBlob);
    } catch (error) {
      console.error('Failed to generate and play voice:', error);
      throw error;
    }
  }

  /**
   * Generate voice audio from text
   */
  static async generateVoice(options: VoiceGenerationOptions): Promise<Blob> {
    const voiceId = options.voiceId || this.config.voiceId;
    const model = options.model || this.config.model;
    
    const voiceSettings = {
      stability: options.voiceSettings?.stability ?? this.config.stability,
      similarity_boost: options.voiceSettings?.similarityBoost ?? this.config.similarityBoost,
      style: options.voiceSettings?.style ?? this.config.style,
      use_speaker_boost: options.voiceSettings?.useSpeakerBoost ?? this.config.useSpeakerBoost
    };

    const requestBody = {
      text: options.text,
      model_id: model,
      voice_settings: voiceSettings
    };

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.config.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    return await response.blob();
  }

  /**
   * Play audio blob
   */
  static async playAudio(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Failed to play audio'));
        };
        
        audio.play().catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get available voices
   */
  static async getVoices(): Promise<any[]> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs service not configured');
    }

    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.config.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    return data.voices || [];
  }

  /**
   * Set voice configuration
   */
  static setVoiceConfig(config: Partial<ElevenLabsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate distraction alert voice message
   */
  static async speakDistractionAlert(distractionType: string): Promise<void> {
    const messages = {
      tab_switch: "Captain, you seem to have drifted off course. Do you need to return to the main route?",
      idle: "Captain, you appear to be resting. Would you like to continue sailing?",
      camera_distraction: "Captain, I notice you've left your workstation. Shall we return to course?",
      social_media: "Captain, we seem to have sailed into social media waters. Should we return to our target route?",
      entertainment: "Captain, the entertainment bay is tempting, but our destination lies ahead. Shall we continue forward?"
    };

    const message = messages[distractionType as keyof typeof messages] || messages.tab_switch;
    
    await this.generateAndPlayVoice({
      text: message,
      voiceSettings: {
        stability: 0.6,
        similarityBoost: 0.8,
        style: 0.2, // Gentle, non-judgmental tone
        useSpeakerBoost: true
      }
    });
  }

  /**
   * Generate exploration mode confirmation
   */
  static async speakExplorationConfirmation(): Promise<void> {
    const message = "Roger, Captain! Exploration mode is now active. Feel free to record your discoveries, or call me to return to the main course.";
    
    await this.generateAndPlayVoice({
      text: message,
      voiceSettings: {
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0.4, // Supportive and encouraging tone
        useSpeakerBoost: true
      }
    });
  }

  /**
   * Generate return to course confirmation
   */
  static async speakReturnConfirmation(): Promise<void> {
    const message = "Excellent, Captain! Let's reset our heading and focus forward.";
    
    await this.generateAndPlayVoice({
      text: message,
      voiceSettings: {
        stability: 0.6,
        similarityBoost: 0.8,
        style: 0.3, // Motivating tone
        useSpeakerBoost: true
      }
    });
  }

  /**
   * Generate inspiration capture confirmation
   */
  static async speakInspirationConfirmation(noteType: 'text' | 'voice'): Promise<void> {
    const messages = {
      text: "Inspiration has been recorded in your sailing log, Captain. Continue your exploration!",
      voice: "Voice note has been saved, Captain. Your thoughts are valuable!"
    };
    
    await this.generateAndPlayVoice({
      text: messages[noteType],
      voiceSettings: {
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0.5, // Warm and encouraging tone
        useSpeakerBoost: true
      }
    });
  }

  /**
   * Generate voyage completion celebration
   */
  static async speakVoyageCompletion(destinationName: string, duration: string): Promise<void> {
    const message = `Congratulations, Captain! You have successfully reached ${destinationName}, with a sailing time of ${duration}. This was an excellent focused journey!`;
    
    await this.generateAndPlayVoice({
      text: message,
      voiceSettings: {
        stability: 0.8,
        similarityBoost: 0.9,
        style: 0.6, // Celebratory and proud tone
        useSpeakerBoost: true
      }
    });
  }
}