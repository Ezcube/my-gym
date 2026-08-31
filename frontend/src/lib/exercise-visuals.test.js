import { describe, expect, it } from 'vitest'
import { EXERCISE_VISUAL_IDS, EXERCISE_VISUALS, exerciseVisualFor } from './exercise-visuals.js'

const APPROVED_IDS = [
  '0025', '0047', '0426', '0334', '0241', '0251',
  '2330', '0027', '1323', '0031', '0313',
  '0043', '0085', '0739', '0585', '0586', '0605',
  '0032', '0091', '0292', '0294', '0054', '0348',
  '0060', '1269', '1429', '0662', '0472', '0175', '1409',
  '3666', '2138', '2141', '2311', '0979',
  '0289', '0293', '1760', '0432', '0410',
  '0314', '0308', '0405', '0310', '0406',
  '0333', '0383', '0297', '2188', '0375',
  '0413', '1459', '0336', '0431', '0417',
  '0003', '0687', '0630', '0276', '0464',
  '2137', '0296', '0351', '0315', '0437',
  '0372', '0439', '0381', '0407', '0409',
  '0577', '0603', '0599', '0178', '0203',
  '0009', '0017', '0594', '0597', '0598',
  '0868', '0194', '0596', '0602', '1350',
  '0748', '0757', '0774', '1359', '0770',
  '0198', '0180', '0238', '0213', '0245',
  '0274', '0872', '0620', '0705', '0507',
  '1373', '1387', '1490', '1397', '1377',
  '1000', '1253', '1368', '1369', '1370',
  '1371', '1372', '1374', '1375', '1376',
  '1378', '1383', '1384', '1385', '1386',
  '1379', '1380', '1381', '1382', '1388',
  '0088', '0108', '0111', '0257', '0284',
  '0400', '0727', '0738', '0742', '0763',
  '0773', '0833', '0999', '1389', '1390',
  '1391', '1392', '1393', '1395', '2289',
  '1398', '1407', '1708', '2315', '2334',
  '1394', '1396', '2335', '3240', '3241',
  '1582', '1585', '1599', '1548', '3212',
  '1410', '1417', '1420', '1425', '1433',
  '1434', '1435', '1436', '1438', '1439',
]

describe('generated exercise visual manifest', () => {
  it('contains exactly the approved unique catalogue ids', () => {
    expect(EXERCISE_VISUAL_IDS).toEqual(APPROVED_IDS)
    expect(new Set(EXERCISE_VISUAL_IDS).size).toBe(170)
    expect(Object.keys(EXERCISE_VISUALS).sort()).toEqual([...APPROVED_IDS].sort())
  })

  it('uses fixed local paths and intrinsic dimensions for both images', () => {
    for (const id of APPROVED_IDS) {
      const visual = exerciseVisualFor(id)
      expect(visual).toEqual({
        technique: {
          src: expect.stringMatching(new RegExp(`^(?:\\./|/)exercise-visuals/${id}/technique\\.webp$`)),
          width: 1200,
          height: 800,
        },
        muscles: {
          src: expect.stringMatching(new RegExp(`^(?:\\./|/)exercise-visuals/${id}/muscles\\.webp$`)),
          width: 1200,
          height: 675,
        },
      })
    }
    expect(exerciseVisualFor('custom-1')).toBeNull()
    expect(exerciseVisualFor('__proto__')).toBeNull()
  })
})
