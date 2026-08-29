const EXACT_CORRECTIONS = Object.freeze({
  '0979': Object.freeze({
    'Attach the band to a sturdy anchor point at waist height.': 'Attach the band to a sturdy anchor point at chest height.',
    'Sujeta la banda a un punto de anclaje resistente a la altura de la cintura.': 'Sujeta la banda a un punto de anclaje resistente a la altura del pecho.',
    "Fixe l'élastique à un point d'ancrage solide à hauteur de la taille.": "Fixe l'élastique à un point d'ancrage solide à hauteur de poitrine.",
    'बैंड को कमर की ऊंचाई पर एक मजबूत एंकर पॉइंट से जोड़ें।': 'बैंड को छाती की ऊंचाई पर एक मजबूत एंकर पॉइंट से जोड़ें।',
    "Attacca la fascia a un punto di ancoraggio robusto all'altezza della vita.": "Attacca la fascia a un punto di ancoraggio robusto all'altezza del petto.",
    '밴드를 허리 높이의 견고한 고정점에 부착합니다.': '밴드를 가슴 높이의 견고한 고정점에 부착합니다.',
    'Przymocuj taśmę do stabilnego punktu zaczepienia na wysokości talii.': 'Przymocuj taśmę do stabilnego punktu zaczepienia na wysokości klatki piersiowej.',
    'Прикрепите ремешок к прочной точке крепления на высоте талии.': 'Прикрепите ленту к прочной точке крепления на уровне груди.',
    'Bandı bel yüksekliğinde sağlam bir bağlantı noktasına takın.': 'Bandı göğüs yüksekliğinde sağlam bir bağlantı noktasına takın.',
    '将带子固定在腰部高度的坚固锚点上。': '将带子固定在胸部高度的坚固锚点上。',
    'напрягите мышцы кора ​​и сохраняйте устойчивую позицию.': 'Напрягите мышцы кора и сохраняйте устойчивое положение.',
  }),
  '3666': Object.freeze({
    'Постепенно уменьшайте наклон и скорость беговой дорожки, чтобы она остыла перед остановкой.': 'Постепенно уменьшайте наклон и скорость дорожки, чтобы спокойно завершить тренировку и выполнить заминку.',
  }),
  '2138': Object.freeze({
    'Задействуйте основные мышцы, чтобы поддерживать устойчивость и правильную осанку.': 'Задействуйте мышцы кора, чтобы поддерживать устойчивость и правильную осанку.',
  }),
})

export function correctExerciseInstructions(exerciseId, steps) {
  if (!Array.isArray(steps)) return []
  const corrections = EXACT_CORRECTIONS[exerciseId]
  return corrections ? steps.map(step => corrections[step] || step) : [...steps]
}
