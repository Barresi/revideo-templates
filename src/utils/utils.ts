import { createClient } from '@deepgram/sdk'
import axios from 'axios'
import * as fs from 'fs'

const deepgram = createClient(process.env['DEEPGRAM_API_KEY'] || '')

export async function getWordTimestamps(audioFilePath: string) {
  const { result } = await deepgram.listen.prerecorded.transcribeFile(fs.readFileSync(audioFilePath), {
    model: 'nova-2',
    smart_format: true
  })

  if (result) {
    return result.results.channels[0].alternatives[0].words
  } else {
    throw Error('transcription result is null')
  }
}

export async function generateAudio(text: string, voiceName: string, savePath: string) {
  const data = {
    model_id: 'eleven_multilingual_v2',
    text: text
  }

  const voiceId = await getVoiceByName(voiceName)

  const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, data, {
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVEN_API_KEY || ''
    },
    responseType: 'arraybuffer'
  })

  fs.writeFileSync(savePath, response.data)
}

async function getVoiceByName(name: string) {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    method: 'GET',
    headers: {
      'xi-api-key': process.env.ELEVEN_API_KEY || ''
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data: any = await response.json()
  const voice = data.voices.find((voice: { name: string; voice_id: string }) => voice.name === name)
  return voice ? voice.voice_id : null
}
