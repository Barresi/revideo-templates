import { renderVideo } from '@revideo/renderer'
import { config } from 'dotenv'
import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { extractAudioFromVideo, validateVideoFile } from './utils/audioExtractor'
import {
  createTempDirectory,
  forceCleanup,
  getTempDirectories,
  scheduleCleanup,
  startCleanupCron
} from './utils/cleanupService'
import { downloadFiles } from './utils/fileDownloader'
import { ITopBottomTemplateVariables, RenderRequest } from './utils/types'
import { getWordTimestamps } from './utils/utils'

config()

const PORT = parseInt(process.env.PORT) || 5000
const app = express()
app.use(express.json({ limit: '10mb' }))

// Start cleanup cron job
startCleanupCron()

app.get('/', (req, res) => {
  res.status(200).send(`Hello World!`)
})

app.post('/render/top-bottom-template', async (req, res) => {
  const jobId = uuidv4()
  let tempDir: string | null = null

  try {
    console.log(`Starting job ${jobId}`)
    const { variables }: RenderRequest = req.body

    if (!variables.imageUrls || !Array.isArray(variables.imageUrls) || variables.imageUrls.length === 0) {
      return res.status(400).json({ error: 'imageUrls array is required and cannot be empty' })
    }

    if (!variables.ugcVideoUrl || typeof variables.ugcVideoUrl !== 'string') {
      return res.status(400).json({ error: 'ugcVideoUrl string is required' })
    }

    // Create temp directory structure
    console.log(`[${jobId}] Creating temporary directories...`)
    tempDir = createTempDirectory(jobId)
    const dirs = getTempDirectories(jobId)

    // Step 1: Download all files (images + UGC video)
    console.log(`[${jobId}] Downloading files...`)
    const allUrls = [...variables.imageUrls, variables.ugcVideoUrl]
    const downloadResults = await downloadFiles(allUrls, dirs.videos)

    // Separate UGC video from images
    const ugcVideoResult = downloadResults[downloadResults.length - 1] // Last downloaded file is UGC video
    const imageResults = downloadResults.slice(0, -1) // All other files are images

    console.log(`[${jobId}] Downloaded ${imageResults.length} images and 1 UGC video`)

    // Step 2: Validate UGC video
    console.log(`[${jobId}] Validating UGC video...`)
    const isValidVideo = await validateVideoFile(ugcVideoResult.filePath)
    if (!isValidVideo) {
      throw new Error('Invalid UGC video file')
    }

    // Step 3: Extract audio from UGC video
    console.log(`[${jobId}] Extracting audio from UGC video...`)
    const audioResult = await extractAudioFromVideo(ugcVideoResult.filePath, dirs.audio)

    // Step 4: Generate captions using Deepgram
    console.log(`[${jobId}] Generating captions...`)
    const words = await getWordTimestamps(audioResult.audioPath)

    // Step 5: Render final video
    console.log(`[${jobId}] Rendering final video...`)
    const renderVariables: ITopBottomTemplateVariables = {
      ugcVideoUrl: ugcVideoResult.filePath,
      imageUrls: imageResults.map((result) => result.filePath),
      words: words
    }

    const outputFilePath = path.join(dirs.output, `${jobId}.mp4`)
    await renderVideo({
      projectFile: './src/templates/TopBottomTemplate.ts',
      variables: renderVariables,
      settings: { outFile: `${jobId}.mp4` as `${string}.mp4`, logProgress: true }
    })

    console.log(`[${jobId}] Video rendered successfully`)

    // Step 6: Schedule cleanup (10 minutes from now)
    scheduleCleanup(jobId, tempDir, 10)

    // Step 7: Send response
    if (fs.existsSync(outputFilePath)) {
      res.sendFile(path.resolve(outputFilePath))
    } else {
      throw new Error('Rendered video file not found')
    }
  } catch (error) {
    console.error(`[${jobId}] Error:`, error.message)

    // Force immediate cleanup on error
    if (tempDir) {
      forceCleanup(jobId)
    }

    res.status(500).json({
      error: 'Video rendering failed',
      details: error.message,
      jobId
    })
  }
})

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`)
})
