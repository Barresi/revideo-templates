import { createClient } from '@deepgram/sdk'
import axios from 'axios'
import { config } from 'dotenv'
import * as fs from 'fs'
import { DeepgramResponse, ElevenLabsVoice, ElevenLabsVoicesResponse, Word } from './types'

config()

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '')

export async function getWordTimestamps(audioFilePath: string): Promise<Word[]> {
  const { result } = (await deepgram.listen.prerecorded.transcribeFile(fs.readFileSync(audioFilePath), {
    model: 'nova-2',
    smart_format: true,
    punctuate: true,
    diarize: false,
    language: 'ru',
    mimetype: 'audio/wav'
  })) as { result: DeepgramResponse }

  if (result.results.channels[0].alternatives[0].words) {
    return result.results.channels[0].alternatives[0].words
  } else {
    throw new Error('transcription result is null')
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
