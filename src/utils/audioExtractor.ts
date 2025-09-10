import * as ffmpeg from 'fluent-ffmpeg'
import * as fs from 'fs'
import * as path from 'path'

// Configure ffmpeg to use static binaries
try {
  const ffmpegPath = require('ffmpeg-static')
  const ffprobePath = require('ffprobe-static').path
  
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath)
    console.log('FFmpeg path set to:', ffmpegPath)
  }
  
  if (ffprobePath) {
    ffmpeg.setFfprobePath(ffprobePath)
    console.log('FFprobe path set to:', ffprobePath)
  }
} catch (error) {
  console.warn('Failed to configure static FFmpeg binaries:', error.message)
  console.warn('Make sure FFmpeg is installed on your system')
}

export interface AudioExtractionResult {
  audioPath: string
  originalVideoPath: string
  duration: number
  format: string
}

export async function extractAudioFromVideo(videoPath: string, outputDir: string): Promise<AudioExtractionResult> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`)
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const videoBasename = path.basename(videoPath, path.extname(videoPath))
  const audioPath = path.join(outputDir, `${videoBasename}.wav`)

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .audioCodec('pcm_s16le') // WAV format, widely supported
      .audioBitrate(128)
      .audioChannels(1) // Mono for better transcription
      .audioFrequency(16000) // 16kHz for speech recognition
      .format('wav')
      .noVideo()
      .on('start', (commandLine) => {
        console.log('FFmpeg started with command:', commandLine)
      })
      .on('progress', (progress) => {
        console.log(`Audio extraction progress: ${progress.percent}%`)
      })
      .on('error', (err) => {
        console.error('Error during audio extraction:', err.message)
        // Cleanup partial file on error
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath)
        }
        reject(new Error(`Failed to extract audio from ${videoPath}: ${err.message}`))
      })
      .on('end', () => {
        console.log('Audio extraction completed')
        
        // Get audio file stats
        const stats = fs.statSync(audioPath)
        
        // Get duration using ffprobe
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
          if (err) {
            reject(new Error(`Failed to get audio metadata: ${err.message}`))
            return
          }

          const duration = metadata.format.duration || 0
          
          resolve({
            audioPath,
            originalVideoPath: videoPath,
            duration,
            format: 'wav'
          })
        })
      })
      .save(audioPath)
  })
}

export async function validateVideoFile(videoPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`Validating video file: ${videoPath}`)
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      console.error('Video file does not exist:', videoPath)
      resolve(false)
      return
    }

    // Check file size
    const stats = fs.statSync(videoPath)
    console.log(`File size: ${stats.size} bytes`)
    
    if (stats.size === 0) {
      console.error('Video file is empty')
      resolve(false)
      return
    }

    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('Video validation failed:', err.message)
        console.error('FFprobe error details:', err)
        resolve(false)
        return
      }

      console.log('Video metadata:', JSON.stringify(metadata, null, 2))

      // Check if file has video or audio streams
      const hasVideo = metadata.streams.some(stream => stream.codec_type === 'video')
      const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio')

      console.log(`Has video: ${hasVideo}, Has audio: ${hasAudio}`)

      if (!hasVideo && !hasAudio) {
        console.error('File does not contain video or audio streams')
        resolve(false)
        return
      }

      // For our use case, we need at least audio (for transcription)
      if (!hasAudio) {
        console.warn('Video file has no audio stream - transcription may fail')
      }

      resolve(true)
    })
  })
}

export function getVideoInfo(videoPath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get video info: ${err.message}`))
        return
      }
      resolve(metadata)
    })
  })
}