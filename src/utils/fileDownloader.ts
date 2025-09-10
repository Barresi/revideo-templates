import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'

const streamPipeline = promisify(pipeline)

export interface DownloadResult {
  filePath: string
  originalUrl: string
  fileSize: number
  mimeType?: string
}

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const TIMEOUT = 5 * 60 * 1000 // 5 minutes

export async function downloadFile(url: string, destinationPath: string): Promise<DownloadResult> {
  if (!isValidGoogleDriveUrl(url)) {
    throw new Error(`Invalid Google Drive URL: ${url}`)
  }

  // Convert Google Drive view URL to download URL
  const downloadUrl = convertGoogleDriveUrl(url)
  console.log(`Converting URL: ${url} -> ${downloadUrl}`)

  // Create directory if it doesn't exist
  const dir = path.dirname(destinationPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  try {
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: TIMEOUT,
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    const contentLength = response.headers['content-length']
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${contentLength} bytes`)
    }

    const writeStream = fs.createWriteStream(destinationPath)
    await streamPipeline(response.data, writeStream)

    const stats = fs.statSync(destinationPath)
    
    return {
      filePath: destinationPath,
      originalUrl: url,
      fileSize: stats.size,
      mimeType: response.headers['content-type']
    }
  } catch (error) {
    // Cleanup partial file on error
    if (fs.existsSync(destinationPath)) {
      fs.unlinkSync(destinationPath)
    }
    throw new Error(`Failed to download file from ${url}: ${error.message}`)
  }
}

export async function downloadFiles(urls: string[], destinationDir: string): Promise<DownloadResult[]> {
  const downloadPromises = urls.map((url, index) => {
    const extension = getFileExtension(url)
    const filename = `file_${index}${extension}`
    const destinationPath = path.join(destinationDir, filename)
    
    return downloadFile(url, destinationPath)
  })

  try {
    return await Promise.all(downloadPromises)
  } catch (error) {
    // Cleanup any successfully downloaded files on error
    const existingFiles = fs.readdirSync(destinationDir).map(file => path.join(destinationDir, file))
    existingFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    })
    throw error
  }
}

function isValidGoogleDriveUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.hostname === 'drive.usercontent.google.com' ||
           parsedUrl.hostname === 'drive.google.com' ||
           parsedUrl.hostname === 'docs.google.com'
  } catch {
    return false
  }
}

function convertGoogleDriveUrl(url: string): string {
  // Convert Google Drive view URL to direct download URL
  if (url.includes('drive.google.com/file/d/')) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileIdMatch) {
      const fileId = fileIdMatch[1]
      return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`
    }
  }
  
  // Return original URL if it's already in download format
  return url
}

function getFileExtension(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname
    const lastDot = pathname.lastIndexOf('.')
    
    if (lastDot !== -1) {
      return pathname.substring(lastDot)
    }
    
    // Default extensions for common Google Drive scenarios
    if (url.includes('export=download')) {
      return '.mp4' // assume video for UGC content
    }
    
    return '.file'
  } catch {
    return '.file'
  }
}