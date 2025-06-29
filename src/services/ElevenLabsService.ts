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
    model: 'eleven_multilingual_v2', // Supports Chinese
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
      tab_switch: "船长，你似乎偏航了，需要返回主航道吗？",
      idle: "船长，你似乎在休息。是否需要继续航行？",
      camera_distraction: "船长，我注意到你离开了工作区域。要返回航道吗？",
      social_media: "船长，我们似乎驶入了社交媒体的海域。是否返回目标航道？",
      entertainment: "船长，娱乐的海湾很诱人，但我们的目标在远方。要继续前进吗？"
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
    const message = "收到，船长！勘探模式已开启。请随时记录你的发现，或呼叫我返回主航道。";
    
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
    const message = "很好，船长！让我们重新设定航向，专注前进。";
    
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
      text: "灵感已记录在航海日志中，船长。继续你的探索吧！",
      voice: "语音笔记已保存，船长。你的想法很有价值！"
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
    const message = `恭喜船长！你已成功到达${destinationName}，航行时间${duration}。这是一次出色的专注之旅！`;
    
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