import { describe, expect, it } from 'vitest'
import { correctExerciseInstructions } from './exercise-instructions.js'

describe('exercise instruction corrections', () => {
  it.each([
    ['0979', 'Attach the band to a sturdy anchor point at waist height.', 'Attach the band to a sturdy anchor point at chest height.'],
    ['0979', 'Sujeta la banda a un punto de anclaje resistente a la altura de la cintura.', 'Sujeta la banda a un punto de anclaje resistente a la altura del pecho.'],
    ['0979', "Fixe l'élastique à un point d'ancrage solide à hauteur de la taille.", "Fixe l'élastique à un point d'ancrage solide à hauteur de poitrine."],
    ['0979', 'बैंड को कमर की ऊंचाई पर एक मजबूत एंकर पॉइंट से जोड़ें।', 'बैंड को छाती की ऊंचाई पर एक मजबूत एंकर पॉइंट से जोड़ें।'],
    ['0979', "Attacca la fascia a un punto di ancoraggio robusto all'altezza della vita.", "Attacca la fascia a un punto di ancoraggio robusto all'altezza del petto."],
    ['0979', '밴드를 허리 높이의 견고한 고정점에 부착합니다.', '밴드를 가슴 높이의 견고한 고정점에 부착합니다.'],
    ['0979', 'Przymocuj taśmę do stabilnego punktu zaczepienia na wysokości talii.', 'Przymocuj taśmę do stabilnego punktu zaczepienia na wysokości klatki piersiowej.'],
    ['0979', 'Прикрепите ремешок к прочной точке крепления на высоте талии.', 'Прикрепите ленту к прочной точке крепления на уровне груди.'],
    ['0979', 'Bandı bel yüksekliğinde sağlam bir bağlantı noktasına takın.', 'Bandı göğüs yüksekliğinde sağlam bir bağlantı noktasına takın.'],
    ['0979', '将带子固定在腰部高度的坚固锚点上。', '将带子固定在胸部高度的坚固锚点上。'],
    ['0979', 'напрягите мышцы кора ​​и сохраняйте устойчивую позицию.', 'Напрягите мышцы кора и сохраняйте устойчивое положение.'],
    ['3666', 'Постепенно уменьшайте наклон и скорость беговой дорожки, чтобы она остыла перед остановкой.', 'Постепенно уменьшайте наклон и скорость дорожки, чтобы спокойно завершить тренировку и выполнить заминку.'],
    ['2138', 'Задействуйте основные мышцы, чтобы поддерживать устойчивость и правильную осанку.', 'Задействуйте мышцы кора, чтобы поддерживать устойчивость и правильную осанку.'],
    ['0009', 'Grasp the handles with your palms facing down and your arms fully extended.', 'Grasp the parallel handles with a neutral grip, palms facing each other, and begin with your elbows nearly extended.'],
    ['0594', 'Adjust the seat height so that your knees are slightly bent and your feet are flat on the footplate.', 'Adjust the machine so your knees are bent about 90 degrees, the balls of your feet rest on the platform, and your heels remain free to move.'],
  ])('corrects %s instruction copy', (id, source, expected) => {
    expect(correctExerciseInstructions(id, [source])).toEqual([expected])
  })

  it('leaves unrelated and custom instructions unchanged', () => {
    const steps = ['Keep this instruction verbatim.']
    expect(correctExerciseInstructions('custom-1', steps)).toEqual(steps)
  })
})
