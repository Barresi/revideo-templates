import { renderVideo } from '@revideo/renderer'
import { config } from 'dotenv'
import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { extractAudioFromVideo, validateVideoFile } from './utils/audioExtractor'

import { forceCleanup, scheduleCleanup } from './utils/cleanupService'
import { downloadFiles } from './utils/fileDownloader'
import { createJobDirectory, getJobDirectory } from './utils/jobDirectoryService'
import { ITopBottomTemplateVariables, RenderRequest } from './utils/types'
import { getWordTimestamps } from './utils/utils'

config()

const PORT = parseInt(process.env.PORT) || 5000
const app = express()
app.use(express.json({ limit: '10mb' }))

app.get('/', (req, res) => {
  res.status(200).send(`Hello World!`)
})

app.post('/render/top-bottom-template', async (req, res) => {
  const jobId = uuidv4()
  let jobDir: string | null = null

  try {
    console.log(`Starting job ${jobId}`)
    const { variables }: RenderRequest = req.body

    if (!variables.imageUrls || !Array.isArray(variables.imageUrls) || variables.imageUrls.length === 0) {
      return res.status(400).json({ error: 'imageUrls array is required and cannot be empty' })
    }

    if (!variables.ugcVideoUrl || typeof variables.ugcVideoUrl !== 'string') {
      return res.status(400).json({ error: 'ugcVideoUrl string is required' })
    }

    // Create job directory structure
    console.log(`[${jobId}] Creating job directories...`)
    jobDir = createJobDirectory(jobId)
    const dir = getJobDirectory(jobId)

    // Step 1: Download images and video
    console.log(`[${jobId}] Downloading images...`)
    const imageResults = await downloadFiles(variables.imageUrls, dir.images)

    console.log(`[${jobId}] Downloading UGC video...`)
    const videoResults = await downloadFiles([variables.ugcVideoUrl], dir.videos)
    const ugcVideoResult = videoResults[0]

    console.log(`[${jobId}] Downloaded ${imageResults.length} images and 1 UGC video`)

    // Step 2: Validate UGC video
    console.log(`[${jobId}] Validating UGC video...`)
    const isValidVideo = await validateVideoFile(ugcVideoResult.filePath)
    if (!isValidVideo) {
      throw new Error('Invalid UGC video file')
    }

    // Step 3: Extract audio from UGC video
    console.log(`[${jobId}] Extracting audio from UGC video...`)
    const audioResult = await extractAudioFromVideo(ugcVideoResult.filePath, dir.audio)

    // Step 4: Generate captions using Deepgram
    console.log(`[${jobId}] Generating captions...`)
    const words = await getWordTimestamps(audioResult.audioPath)
    console.log(`[${jobId}] Captions is `)

    // Step 5: Render final video
    console.log(`[${jobId}] Rendering final video...`)
    const renderVariables: ITopBottomTemplateVariables = {
      ugcVideoUrl: `/${jobId}/videos/${path.basename(ugcVideoResult.filePath)}`,
      imageUrls: imageResults.map((result) => `/${jobId}/images/${path.basename(result.filePath)}`),
      words: words
    }

    const outputFilePath = path.join(dir.output, `${jobId}.mp4`)
    await renderVideo({
      projectFile: './src/templates/TopBottomTemplate.ts',
      variables: renderVariables,
      settings: {
        outFile: `${jobId}.mp4` as `${string}.mp4`,
        logProgress: true,
        puppeteer: {
          executablePath: '/usr/bin/google-chrome-stable',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--headless'
          ]
        }
      }
    })

    console.log(`[${jobId}] Video rendered successfully`)

    // Step 6: Schedule cleanup (10 minutes from now)
    scheduleCleanup(jobId, jobDir, 10)

    // Step 7: Send response
    if (fs.existsSync(outputFilePath)) {
      res.sendFile(path.resolve(outputFilePath))
    } else {
      throw new Error('Rendered video file not found')
    }
  } catch (error) {
    console.error(`[${jobId}] Error:`, error.message)

    // Force immediate cleanup on error
    if (jobDir) {
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
