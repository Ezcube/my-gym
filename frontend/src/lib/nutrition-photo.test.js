import { describe, expect, it, vi } from 'vitest'
import { foodPhotoDimensions, prepareFoodPhoto, validateFoodPhoto } from './nutrition-photo.js'

describe('food photo preparation', () => {
  it('fits a landscape photo inside 1600px without upscaling', () => {
    expect(foodPhotoDimensions(3200, 2400)).toEqual({ width: 1600, height: 1200 })
    expect(foodPhotoDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('rejects unsupported and excessively large source files before decoding', () => {
    expect(() => validateFoodPhoto({ type: 'image/heic', size: 10 })).toThrow('JPEG, PNG, or WebP')
    expect(() => validateFoodPhoto({ type: 'image/jpeg', size: 21 * 1024 * 1024 })).toThrow('20 MB')
  })

  it('re-encodes the photo, strips metadata, and returns payload without a data-url prefix', async () => {
    const close = vi.fn()
    const drawImage = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: callback => callback(new Blob(['jpeg'], { type: 'image/jpeg' })),
    }
    const file = { type: 'image/png', size: 1024 }

    const result = await prepareFoodPhoto(file, {
      createBitmap: async () => ({ width: 3200, height: 2400, close }),
      createCanvas: () => canvas,
      blobToBase64: async () => 'anBlZw==',
    })

    expect(canvas).toMatchObject({ width: 1600, height: 1200 })
    expect(drawImage).toHaveBeenCalledWith(expect.any(Object), 0, 0, 1600, 1200)
    expect(result).toEqual({ image: 'anBlZw==', mime: 'image/jpeg', width: 1600, height: 1200 })
    expect(close).toHaveBeenCalled()
  })
})
