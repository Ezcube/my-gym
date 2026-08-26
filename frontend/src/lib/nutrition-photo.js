const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024

export function foodPhotoDimensions(width, height, maxSide = 1600) {
  if (!(width > 0) || !(height > 0)) throw new Error('Photo dimensions are invalid')
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export function validateFoodPhoto(file) {
  if (!file || !TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo')
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The photo is empty')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('The source photo must be no larger than 20 MB')
  return true
}

function browserCanvas() {
  return document.createElement('canvas')
}

async function base64Of(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const encodeJpeg = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the photo')), 'image/jpeg', quality)
})

export async function prepareFoodPhoto(file, dependencies = {}) {
  validateFoodPhoto(file)
  const createBitmap = dependencies.createBitmap || (source => createImageBitmap(source, { imageOrientation: 'from-image' }))
  const createCanvas = dependencies.createCanvas || browserCanvas
  const blobToBase64 = dependencies.blobToBase64 || base64Of
  const bitmap = await createBitmap(file)
  try {
    const { width, height } = foodPhotoDimensions(bitmap.width, bitmap.height)
    const canvas = createCanvas()
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Photo processing is not available in this browser')
    context.drawImage(bitmap, 0, 0, width, height)

    let encoded = null
    for (const quality of [0.86, 0.72, 0.58]) {
      encoded = await encodeJpeg(canvas, quality)
      if (encoded.size <= MAX_OUTPUT_BYTES) break
    }
    if (!encoded || encoded.size > MAX_OUTPUT_BYTES) throw new Error('The prepared photo is larger than 4 MB')

    return { image: await blobToBase64(encoded), mime: 'image/jpeg', width, height }
  } finally {
    bitmap.close?.()
  }
}
