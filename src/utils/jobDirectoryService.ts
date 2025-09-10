import * as fs from 'fs'
import * as path from 'path'

export function createJobDirectory(jobId: string): string {
  const pubDir = path.join(process.cwd(), 'public', jobId)

  if (!fs.existsSync(pubDir)) {
    fs.mkdirSync(pubDir, { recursive: true })
  }

  // Create subdirectories
  const videosDir = path.join(pubDir, 'videos')
  const audioDir = path.join(pubDir, 'audio')
  const imagesDir = path.join(pubDir, 'images')
  const outputDir = path.join(pubDir, 'output')

  fs.mkdirSync(videosDir, { recursive: true })
  fs.mkdirSync(audioDir, { recursive: true })
  fs.mkdirSync(imagesDir, { recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })

  return pubDir
}

export function getJobDirectory(jobId: string, isPuppeterPaths: boolean = false) {
  const pubDir = isPuppeterPaths ? '/' : path.join(process.cwd(), 'public', jobId)

  return {
    root: pubDir,
    videos: path.join(pubDir, 'videos'),
    audio: path.join(pubDir, 'audio'),
    images: path.join(pubDir, 'images'),
    output: path.join(pubDir, 'output')
  }
}
