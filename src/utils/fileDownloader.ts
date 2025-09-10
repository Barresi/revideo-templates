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
  // Create directory if it doesn't exist
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true })
  }

  const results: DownloadResult[] = []

  for (let index = 0; index < urls.length; index++) {
    const url = urls[index]
    let extension = getFileExtension(url)
    let filename = `file_${index}${extension}`
    let destinationPath = path.join(destinationDir, filename)

    try {
      const result = await downloadFile(url, destinationPath)

      // If we got a MIME type, try to determine correct extension
      if (result.mimeType) {
        const correctExtension = getExtensionFromMimeType(result.mimeType)
        if (correctExtension !== extension) {
          // Rename file with correct extension
          const newFilename = `file_${index}${correctExtension}`
          const newPath = path.join(destinationDir, newFilename)
          fs.renameSync(destinationPath, newPath)
          result.filePath = newPath
        }
      }

      results.push(result)
    } catch (error) {
      // Cleanup any successfully downloaded files on error
      results.forEach((result) => {
        if (fs.existsSync(result.filePath)) {
          fs.unlinkSync(result.filePath)
        }
      })
      throw error
    }
  }

  return results
}

function isValidGoogleDriveUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return (
      parsedUrl.hostname === 'drive.usercontent.google.com' ||
      parsedUrl.hostname === 'drive.google.com' ||
      parsedUrl.hostname === 'docs.google.com'
    )
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
      const ext = pathname.substring(lastDot)
      // Return extension if it looks like a valid file extension
      if (ext.length <= 5 && ext.match(/^\.[a-zA-Z0-9]+$/)) {
        return ext
      }
    }

    // For Google Drive URLs, try to determine type from content-type later
    // For now, assume common formats
    if (url.includes('export=download') || url.includes('drive.usercontent.google.com')) {
      return '.mp4' // Default for video files
    }

    return '.mp4' // Default assumption for video content
  } catch {
    return '.mp4'
  }
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/avi': '.avi',
    'video/mov': '.mov',
    'video/quicktime': '.mov',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  }

  return mimeToExt[mimeType.toLowerCase()] || '.mp4'
}
