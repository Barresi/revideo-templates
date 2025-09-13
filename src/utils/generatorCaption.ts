import { createClient } from '@deepgram/sdk'
import { config } from 'dotenv'
import * as fs from 'fs'
import { DeepgramResponse, Word } from './types'

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
