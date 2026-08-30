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
  '0009': Object.freeze({
    'Grasp the handles with your palms facing down and your arms fully extended.': 'Grasp the parallel handles with a neutral grip, palms facing each other, and begin with your elbows nearly extended.',
  }),
  '0594': Object.freeze({
    'Adjust the seat height so that your knees are slightly bent and your feet are flat on the footplate.': 'Adjust the machine so your knees are bent about 90 degrees, the balls of your feet rest on the platform, and your heels remain free to move.',
  }),
  '0770': Object.freeze({
    'Engage your core and unrack the barbell, stepping back to clear the rack.': 'Engage your core and rotate the bar to release the Smith machine hooks, keeping your feet planted and the bar inside the guide rails.',
    'Activa el core y suelta la barra del soporte, dando un paso atrás para alejarte del soporte.': 'Activa el core y gira la barra para soltarla de los ganchos de la máquina Smith, manteniendo los pies firmemente apoyados y la barra dentro de los rieles guía.',
    "Gaine ta sangle abdominale et sors la barre du rack, en reculant pour dégager le support.": "Gaine ta sangle abdominale et fais pivoter la barre pour la dégager des crochets de la machine Smith, en gardant les pieds bien ancrés au sol et la barre à l'intérieur des rails de guidage.",
    'अपने कोर को संलग्न करें और रैक को साफ़ करने के लिए पीछे हटते हुए बारबेल को खोलें।': 'अपने कोर को सक्रिय करें और स्मिथ मशीन के हुक खोलने के लिए बारबेल को घुमाएँ, अपने पैरों को ज़मीन पर टिकाए रखें और बारबेल को गाइड रेल के भीतर रखें।',
    "Coinvolgi il core e sblocca il bilanciere, facendo un passo indietro per liberare il rack.": "Coinvolgi il core e ruota il bilanciere per sganciarlo dai ganci della Smith Machine, mantenendo i piedi ben piantati e il bilanciere all'interno delle guide.",
    '복부에 힘을 주고 바벨을 언래크하여 뒤로 물러 랙을 치웁니다.': '코어에 힘을 주고 바를 돌려 스미스 머신의 훅을 해제하며, 발은 바닥에 고정하고 바는 가이드 레일 안에 유지합니다.',
    'Napnij mięśnie brzucha i zdejmij sztangę ze stojaka, robiąc krok w tył, aby ją uwolnić.': 'Napnij mięśnie brzucha i obróć sztangę, aby zwolnić ją z haków suwnicy Smitha, nie odrywając stóp od podłoża i utrzymując sztangę wewnątrz prowadnic.',
    'Напрягите корпус и снимите штангу со стойки, отступив назад, чтобы освободить стойку.': 'Напрягите корпус и поверните гриф, чтобы снять его с крюков машины Смита, удерживая стопы на полу, а гриф — внутри направляющих.',
    'Merkez bölgenizi devreye sokun ve halteri serbest bırakın, rafı temizlemek için geri adım atın.': 'Merkez bölgenizi devreye sokun ve halteri döndürerek Smith makinesinin kancalarından çıkarın; ayaklarınızı yere sabit basın ve halteri kılavuz rayların içinde tutun.',
    '启动你的核心并打开杠铃，后退以清理架子。': '收紧核心并转动杠铃，以解除史密斯机挂钩的锁定，同时保持双脚踩稳，并确保杠铃始终位于导轨内。',
  }),
})

export function correctExerciseInstructions(exerciseId, steps) {
  if (!Array.isArray(steps)) return []
  const corrections = EXACT_CORRECTIONS[exerciseId]
  return corrections ? steps.map(step => corrections[step] || step) : [...steps]
}
