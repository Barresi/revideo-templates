import { authenticate } from '@google-cloud/local-auth'
import { config } from 'dotenv'
import * as fs from 'fs'
import { google } from 'googleapis'

config()
const SCOPES = ['https://www.googleapis.com/auth/drive']
const CREDENTIALS_PATH = process.env.GOOGLE_DRIVE_KEY_PATH

let driveInstance: any = null

async function getDriveInstance() {
  if (!driveInstance) {
    const auth = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH
    })
    driveInstance = google.drive({ version: 'v3', auth })
  }
  return driveInstance
}

/**
 * Lists the names and IDs of up to 10 files.
 */
export async function listFiles() {
  const drive = await getDriveInstance()
  const result = await drive.files.list({
    pageSize: 100,
    fields: 'nextPageToken, files(id, name, mimeType, createdTime)'
  })
  const files = result.data.files
  if (!files) {
    console.log('No files found.')
    return
  }

  console.log(`Found ${files.length} files:`)
  files.forEach((file: any) => {
    console.log(`- ${file.name} (ID: ${file.id}) [${file.mimeType}]`)
  })
}

/**
 * Uploads a file to Google Drive
 */
export async function uploadFile(filePath: string, fileName?: string) {
  const drive = await getDriveInstance()

  const fileMetadata = {
    name: fileName || filePath.split(/[/\\]/).pop() || 'uploaded-file'
  }

  const media = {
    body: fs.createReadStream(filePath)
  }

  try {
    const result = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id,name'
    })

    console.log(`File uploaded successfully: ${result.data.name} (ID: ${result.data.id})`)
    return result.data
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

/**
 * Downloads a file from Google Drive
 */
export async function downloadFile(fileId: string, outputPath: string) {
  const drive = await getDriveInstance()

  try {
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media'
      },
      { responseType: 'stream' }
    )

    const writeStream = fs.createWriteStream(outputPath)

    return new Promise((resolve, reject) => {
      response.data
        .pipe(writeStream)
        .on('error', (error: Error) => {
          console.error('Error downloading file:', error)
          reject(error)
        })
        .on('finish', () => {
          console.log(`File downloaded successfully to: ${outputPath}`)
          resolve(outputPath)
        })
    })
  } catch (error) {
    console.error('Error downloading file:', error)
    throw error
  }
}

/**
 * Extracts file ID from Google Drive URL
 */
export function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

/**
 * Downloads multiple files from Google Drive in parallel
 */
export async function downloadMultipleFiles(fileUrls: string[], outputDir: string) {
  const drive = await getDriveInstance()

  const downloadPromises = fileUrls.map(async (url, index) => {
    const fileId = extractFileIdFromUrl(url)
    if (!fileId) {
      throw new Error(`Invalid Google Drive URL: ${url}`)
    }

    // Get file metadata first to get the original filename
    const metadata = await drive.files.get({ fileId, fields: 'name' })
    const originalName = metadata.data.name || `file_${index + 1}`
    const outputPath = `${outputDir}/${originalName}`

    // Download the file
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media'
      },
      { responseType: 'stream' }
    )

    const writeStream = fs.createWriteStream(outputPath)

    return new Promise<{ filePath: string; fileName: string }>((resolve, reject) => {
      response.data
        .pipe(writeStream)
        .on('error', reject)
        .on('finish', () => {
          console.log(`Downloaded: ${originalName}`)
          resolve({ filePath: outputPath, fileName: originalName })
        })
    })
  })

  return Promise.all(downloadPromises)
}
