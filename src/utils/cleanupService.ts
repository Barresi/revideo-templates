import * as fs from 'fs'
import * as cron from 'node-cron'
import * as path from 'path'

export interface CleanupJob {
  jobId: string
  scheduledAt: Date
  cleanupAt: Date
  tempDir: string
}

const activeCleanupJobs = new Map<string, CleanupJob>()

export function scheduleCleanup(jobId: string, tempDir: string, delayMinutes: number = 10): void {
  const now = new Date()
  const cleanupAt = new Date(now.getTime() + delayMinutes * 60 * 1000)

  const job: CleanupJob = {
    jobId,
    scheduledAt: now,
    cleanupAt,
    tempDir
  }

  activeCleanupJobs.set(jobId, job)

  console.log(`Scheduled cleanup for job ${jobId} at ${cleanupAt.toISOString()}`)

  // Schedule the cleanup
  setTimeout(() => {
    cleanupTempDirectory(jobId)
  }, delayMinutes * 60 * 1000)
}

export function cleanupTempDirectory(jobId: string): void {
  const job = activeCleanupJobs.get(jobId)

  if (!job) {
    console.warn(`Cleanup job ${jobId} not found`)
    return
  }

  try {
    if (fs.existsSync(job.tempDir)) {
      deleteFolderRecursive(job.tempDir)
      console.log(`Successfully cleaned up temp directory: ${job.tempDir}`)
    } else {
      console.log(`Temp directory already removed: ${job.tempDir}`)
    }
  } catch (error) {
    console.error(`Failed to cleanup temp directory ${job.tempDir}:`, error.message)
  } finally {
    activeCleanupJobs.delete(jobId)
  }
}

export function forceCleanup(jobId: string): void {
  const job = activeCleanupJobs.get(jobId)

  if (job) {
    cleanupTempDirectory(jobId)
  }
}

export function deleteFolderRecursive(folderPath: string): void {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file)
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath)
      } else {
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(folderPath)
  }
}

// Start a cleanup cron job that runs every hour to clean up any missed directories
export function startCleanupCron(): void {
  cron.schedule('0 * * * *', () => {
    console.log('Running hourly cleanup check...')
    cleanupOldTempDirectories()
  })

  console.log('Cleanup cron job started (runs every hour)')
}

function cleanupOldTempDirectories(): void {
  const tempRootDir = path.join(process.cwd(), 'public', 'temp')

  if (!fs.existsSync(tempRootDir)) {
    return
  }

  const now = new Date()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

  try {
    fs.readdirSync(tempRootDir).forEach((jobDir) => {
      const jobDirPath = path.join(tempRootDir, jobDir)
      const stats = fs.statSync(jobDirPath)

      if (stats.isDirectory()) {
        const age = now.getTime() - stats.mtime.getTime()

        if (age > maxAge) {
          console.log(`Cleaning up old temp directory: ${jobDirPath}`)
          deleteFolderRecursive(jobDirPath)
        }
      }
    })
  } catch (error) {
    console.error('Error during cleanup cron:', error.message)
  }
}

export function getActiveCleanupJobs(): CleanupJob[] {
  return Array.from(activeCleanupJobs.values())
}
