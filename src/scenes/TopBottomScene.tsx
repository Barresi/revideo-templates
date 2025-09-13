import { Img, Layout, makeScene2D, Rect, Txt, Video } from '@revideo/2d'
import { all, createRef, createSignal, Reference, useScene, waitFor } from '@revideo/core'
import '../utils/global.css'
import { Word } from '../utils/types'

interface captionSettings {
  fontSize: number
  textColor: string
  fontWeight: number
  fontFamily: string
  numSimultaneousWords: number
  stream: boolean
  textAlign: 'center' | 'left'
  textBoxWidthInPercent: number
  borderColor?: string
  borderWidth?: number
  currentWordColor?: string
  currentWordBackgroundColor?: string
  shadowColor?: string
  shadowBlur?: number
  fadeInAnimation?: boolean
}

const textSettings: captionSettings = {
  fontSize: 60,
  numSimultaneousWords: 4,
  textColor: 'white',
  fontWeight: 800,
  fontFamily: 'Mulish',
  stream: false,
  textAlign: 'center',
  textBoxWidthInPercent: 80,
  fadeInAnimation: true,
  currentWordColor: 'yellow',
  currentWordBackgroundColor: 'rgba(0,0,0,0.7)',
  shadowColor: 'black',
  shadowBlur: 20
}

/**
 * TopBottomTemplate scene with UGC video at bottom, images at top, captions in middle
 */
const scene = makeScene2D('topBottomScene', function* (view) {
  const images = useScene().variables.get('imageUrls', [])()
  const ugcVideoUrl = useScene().variables.get('ugcVideoUrl', '')()
  const words = useScene().variables.get('words', [])()

  console.log('Images count:', images.length)
  console.log('Words count:', words.length)
  console.log('UGC Video URL:', ugcVideoUrl)

  const topImagesContainer = createRef<Layout>()
  const middleCaptionsContainer = createRef<Layout>()
  const bottomVideoContainer = createRef<Layout>()

  yield view.add(
    <>
      {/* Top section - Images */}
      <Layout position={[0, -480]} width={1080} height={960} ref={topImagesContainer} clip={true} />

      {/* Middle section - Captions */}
      <Layout size={['100%', '100%']} position={[0, 0]} zIndex={2} ref={middleCaptionsContainer} />

      {/* Bottom section - UGC Video */}
      <Layout position={[0, 480]} width={1080} height={960} ref={bottomVideoContainer} clip={true} />
    </>
  )

  // Get video duration first to determine scene duration
  const videoRef = createRef<Video>()
  yield bottomVideoContainer().add(<Video src={ugcVideoUrl} play={false} ref={videoRef} />)
  yield
  const videoDuration = videoRef().getDuration()
  console.log('Video duration:', videoDuration)

  // Use video duration as scene duration
  const duration = videoDuration

  yield* all(
    displayUgcVideo(bottomVideoContainer, ugcVideoUrl, videoRef),
    displayTopImages(topImagesContainer, images, duration),
    displayWords(middleCaptionsContainer, words, textSettings, duration)
  )
})

function* displayUgcVideo(container: Reference<Layout>, url: string, videoRef: Reference<Video>) {
  // Start playing the video
  videoRef().play()

  // Try to scale video to fill container width while maintaining aspect ratio
  videoRef().width(1080)
  // Let height adjust automatically to maintain aspect ratio
  const videoHeight = videoRef().height()

  // If video is too short, scale it up to fill height
  if (videoHeight < 960) {
    const scaleNeeded = 960 / videoHeight
    videoRef().scale(scaleNeeded)
  }

  // Play video for its full duration
  yield* waitFor(videoRef().getDuration())
}

function* displayTopImages(
  container: Reference<Layout>,
  images: string[],
  totalDuration: number
): Generator<any, void, any> {
  if (images.length === 0) {
    console.log('No images to display')
    return
  }

  const imageDisplayTime = 3 // 3 seconds per image
  const totalImages = images.length
  const containerWidth = 1080
  const containerHeight = 960
  console.log(`Displaying ${totalImages} images for ${totalDuration} seconds`)

  for (let i = 0; i < totalImages; i++) {
    const img = images[i]
    const ref = createRef<Img>()

    // Create image with cover-like behavior
    const imageElement = <Img src={img} ref={ref} />

    container().add(imageElement)

    // Wait for image to load and then apply cover scaling
    yield

    // Get natural image dimensions
    const imageWidth = ref().naturalSize().width
    const imageHeight = ref().naturalSize().height

    // Calculate scale to cover container (like object-fit: cover)
    const scaleX = containerWidth / imageWidth
    const scaleY = containerHeight / imageHeight
    const scale = Math.max(scaleX, scaleY) // Use larger scale to cover

    // Apply calculated size
    ref().size([imageWidth * scale, imageHeight * scale])

    // Wait 3 seconds or remaining duration, whichever is shorter
    const waitTime = Math.min(imageDisplayTime, totalDuration - i * imageDisplayTime)
    yield* waitFor(waitTime)

    // Remove current image before adding next one
    ref().remove()

    // Break if we've exceeded total duration
    if ((i + 1) * imageDisplayTime >= totalDuration) {
      break
    }
  }

  // If we still have time left, repeat images
  const remainingTime = totalDuration - totalImages * imageDisplayTime
  if (remainingTime > 0) {
    yield* displayTopImages(container, images, remainingTime)
  }
}

function* displayWords(
  container: Reference<Layout>,
  words: Word[],
  settings: captionSettings,
  duration?: number
): Generator<any, void, any> {
  if (words.length === 0) {
    console.log('No words to display')
    // Add placeholder text for testing
    const testTextRef = createRef<Txt>()
    yield container().add(
      <Txt
        fontSize={settings.fontSize}
        fontWeight={settings.fontWeight}
        fontFamily={settings.fontFamily}
        fill={settings.textColor}
        textAlign={settings.textAlign}
        ref={testTextRef}
        shadowBlur={settings.shadowBlur}
        shadowColor={settings.shadowColor}
      >
        Test Caption Text
      </Txt>
    )
    yield* waitFor(duration || 5) // Show test text for video duration or 5 seconds
    return
  }

  let waitBefore = words[0].start

  for (let i = 0; i < words.length; i += settings.numSimultaneousWords) {
    const currentBatch = words.slice(i, i + settings.numSimultaneousWords)
    const nextClipStart =
      i < words.length - 1 ? words[i + settings.numSimultaneousWords]?.start || null : null
    const isLastClip = i + settings.numSimultaneousWords >= words.length
    const waitAfter = isLastClip ? 1 : 0
    const textRef = createRef<Txt>()
    yield* waitFor(waitBefore)

    if (settings.stream) {
      let nextWordStart = 0
      yield container().add(
        <Txt
          width={`${settings.textBoxWidthInPercent}%`}
          textWrap={true}
          zIndex={2}
          textAlign={settings.textAlign}
          ref={textRef}
        />
      )

      for (let j = 0; j < currentBatch.length; j++) {
        const word = currentBatch[j]
        yield* waitFor(nextWordStart)
        const optionalSpace = j === currentBatch.length - 1 ? '' : ' '
        const backgroundRef = createRef<Rect>()
        const wordRef = createRef<Txt>()
        const opacitySignal = createSignal(settings.fadeInAnimation ? 0.5 : 1)
        textRef().add(
          <Txt
            fontSize={settings.fontSize}
            fontWeight={settings.fontWeight}
            fontFamily={settings.fontFamily}
            textWrap={true}
            textAlign={settings.textAlign}
            fill={settings.currentWordColor}
            ref={wordRef}
            lineWidth={settings.borderWidth}
            shadowBlur={settings.shadowBlur}
            shadowColor={settings.shadowColor}
            zIndex={2}
            stroke={settings.borderColor}
            opacity={opacitySignal}
          >
            {word.punctuated_word}
          </Txt>
        )
        textRef().add(<Txt fontSize={settings.fontSize}>{optionalSpace}</Txt>)
        container().add(
          <Rect
            fill={settings.currentWordBackgroundColor}
            zIndex={1}
            size={wordRef().size}
            position={wordRef().position}
            radius={10}
            padding={10}
            ref={backgroundRef}
          />
        )
        yield* all(
          waitFor(word.end - word.start),
          opacitySignal(1, Math.min((word.end - word.start) * 0.5, 0.1))
        )
        wordRef().fill(settings.textColor)
        backgroundRef().remove()
        nextWordStart = currentBatch[j + 1]?.start - word.end || 0
      }
      textRef().remove()
    } else {
      yield container().add(
        <Txt
          width={`${settings.textBoxWidthInPercent}%`}
          textAlign={settings.textAlign}
          ref={textRef}
          textWrap={true}
          zIndex={2}
        />
      )

      const wordRefs = []
      const opacitySignal = createSignal(settings.fadeInAnimation ? 0.5 : 1)
      for (let j = 0; j < currentBatch.length; j++) {
        const word = currentBatch[j]
        const optionalSpace = j === currentBatch.length - 1 ? '' : ' '
        const wordRef = createRef<Txt>()
        textRef().add(
          <Txt
            fontSize={settings.fontSize}
            fontWeight={settings.fontWeight}
            ref={wordRef}
            fontFamily={settings.fontFamily}
            textWrap={true}
            textAlign={settings.textAlign}
            fill={settings.textColor}
            zIndex={2}
            stroke={settings.borderColor}
            lineWidth={settings.borderWidth}
            shadowBlur={settings.shadowBlur}
            shadowColor={settings.shadowColor}
            opacity={opacitySignal}
          >
            {word.punctuated_word}
          </Txt>
        )
        textRef().add(<Txt fontSize={settings.fontSize}>{optionalSpace}</Txt>)

        if (j === 0 && i === 0) {
          yield
        }
        wordRefs.push(wordRef)
      }

      yield* all(
        opacitySignal(1, Math.min(0.1, (currentBatch[0].end - currentBatch[0].start) * 0.5)),
        highlightCurrentWord(
          container,
          currentBatch,
          wordRefs,
          settings.currentWordColor,
          settings.currentWordBackgroundColor
        ),
        waitFor(currentBatch[currentBatch.length - 1].end - currentBatch[0].start + waitAfter)
      )
      textRef().remove()
    }
    waitBefore = nextClipStart !== null ? nextClipStart - currentBatch[currentBatch.length - 1].end : 0
  }
}

function* highlightCurrentWord(
  container: Reference<Layout>,
  currentBatch: Word[],
  wordRefs: Reference<Txt>[],
  wordColor: string,
  backgroundColor: string
): Generator<any, void, any> {
  let nextWordStart = 0

  for (let i = 0; i < currentBatch.length; i++) {
    yield* waitFor(nextWordStart)
    const word = currentBatch[i]
    const originalColor = wordRefs[i]().fill()
    nextWordStart = currentBatch[i + 1]?.start - word.end || 0
    wordRefs[i]().text(wordRefs[i]().text())
    wordRefs[i]().fill(wordColor)

    const backgroundRef = createRef<Rect>()
    if (backgroundColor) {
      container().add(
        <Rect
          fill={backgroundColor}
          zIndex={1}
          size={wordRefs[i]().size}
          position={wordRefs[i]().position}
          radius={10}
          padding={10}
          ref={backgroundRef}
        />
      )
    }

    yield* waitFor(word.end - word.start)
    wordRefs[i]().text(wordRefs[i]().text())
    wordRefs[i]().fill(originalColor)

    if (backgroundColor) {
      backgroundRef().remove()
    }
  }
}

export default scene
