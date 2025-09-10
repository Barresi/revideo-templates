import { createClient } from '@deepgram/sdk'
import axios from 'axios'
import { config } from 'dotenv'
import * as fs from 'fs'
import { DeepgramResponse, ElevenLabsVoice, ElevenLabsVoicesResponse, Word } from './types'

config()

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '')

export async function getWordTimestamps(audioFilePath: string): Promise<Word[]> {
  console.log(`[getWordTimestamps] Starting transcription for file: ${audioFilePath}`)

  try {
    const audioBuffer = fs.readFileSync(audioFilePath)
    console.log(`[getWordTimestamps] Audio file size: ${audioBuffer.length} bytes`)

    const { result } = (await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
      model: 'nova-2',
      smart_format: true,
      punctuate: true,
      diarize: false,
      language: 'ru',
      mimetype: 'audio/wav'
    })) as { result: DeepgramResponse }

    console.log(`[getWordTimestamps] Full Deepgram result:`, JSON.stringify(result, null, 2))

    if (!result) {
      throw new Error('Deepgram returned null result')
    }

    if (!result.results) {
      throw new Error('Deepgram result.results is null')
    }

    console.log(`[getWordTimestamps] Channels count: ${result.results.channels?.length}`)

    if (!result.results.channels || result.results.channels.length === 0) {
      throw new Error('No channels found in Deepgram result')
    }

    const channel = result.results.channels[0]
    console.log(`[getWordTimestamps] Channel alternatives count: ${channel.alternatives?.length}`)

    if (!channel.alternatives || channel.alternatives.length === 0) {
      throw new Error('No alternatives found in first channel')
    }

    const alternative = channel.alternatives[0]
    console.log(`[getWordTimestamps] Alternative transcript: "${alternative.transcript}"`)
    console.log(`[getWordTimestamps] Words array length: ${alternative.words?.length || 0}`)

    if (alternative.words && alternative.words.length > 0) {
      console.log(`[getWordTimestamps] First few words:`, alternative.words.slice(0, 3))
      return alternative.words
    } else {
      throw new Error('Words array is empty or null')
    }
  } catch (error) {
    console.error(`[getWordTimestamps] Error during transcription:`, error)
    throw error
  }
}

export async function generateAudio(text: string, voiceName: string, savePath: string): Promise<void> {
  const data = {
    model_id: 'eleven_multilingual_v2',
    text: text
  }

  const voiceId = await getVoiceByName(voiceName)
  if (!voiceId) {
    throw new Error(`Voice "${voiceName}" not found`)
  }

  const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, data, {
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVEN_API_KEY || ''
    },
    responseType: 'arraybuffer'
  })

  fs.writeFileSync(savePath, response.data)
}

async function getVoiceByName(name: string): Promise<string | null> {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: {
      'xi-api-key': process.env.ELEVEN_API_KEY || ''
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data: ElevenLabsVoicesResponse = await response.json()
  const voice = data.voices.find((voice: ElevenLabsVoice) => voice.name === name)
  return voice ? voice.voice_id : null
}
