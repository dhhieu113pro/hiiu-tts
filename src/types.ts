export interface VoiceConfig {
  audio: { sample_rate: number };
  espeak?: { voice?: string };
  phoneme_type?: string;
  phoneme_id_map: Record<string, number[]>;
  num_speakers?: number;
  speaker_id_map?: Record<string, number>;
}

export interface SpeechRequest {
  model?: string;
  input: string;
  voice?: string | number;
  speed?: number;
  response_format?: "wav" | "pcm";
}
