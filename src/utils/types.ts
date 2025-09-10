export interface ITopBottomTemplateVariables extends Record<string, unknown> {
  imageUrls: string[]
  ugcVideoUrl: string
  words?: Word[]
}

export interface RenderRequest {
  variables: {
    imageUrls: string[]
    ugcVideoUrl: string
  }
}

export interface Word {
  punctuated_word: string
  start: number
  end: number
  confidence: number
}

export interface DeepgramResponse {
  metadata: {
    transaction_key: string
    request_id: string
    sha256: string
    created: string
    duration: number
    channels: number
    models: string[]
  }
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string
        confidence: number
        words: Word[]
        paragraphs?: {
          transcript: string
          paragraphs: Array<{
            sentences: Array<{
              text: string
              start: number
              end: number
            }>
            start: number
            end: number
          }>
        }
      }>
    }>
  }
}

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  samples: any[]
  category: string
  fine_tuning: {
    is_allowed_to_fine_tune: boolean
    finetuning_state: string
    verification_failures: string[]
    verification_attempts_count: number
    manual_verification_requested: boolean
  }
  labels: Record<string, string>
  description: string
  preview_url: string
  available_for_tiers: string[]
  settings: any
  sharing: any
  high_quality_base_model_ids: string[]
}

export interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[]
}
