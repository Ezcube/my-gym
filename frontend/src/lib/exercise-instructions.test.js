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
    ['0770', 'Engage your core and unrack the barbell, stepping back to clear the rack.', 'Engage your core and rotate the bar to release the Smith machine hooks, keeping your feet planted and the bar inside the guide rails.'],
    ['0770', 'Activa el core y suelta la barra del soporte, dando un paso atrás para alejarte del soporte.', 'Activa el core y gira la barra para soltarla de los ganchos de la máquina Smith, manteniendo los pies firmemente apoyados y la barra dentro de los rieles guía.'],
    ['0770', 'Gaine ta sangle abdominale et sors la barre du rack, en reculant pour dégager le support.', "Gaine ta sangle abdominale et fais pivoter la barre pour la dégager des crochets de la machine Smith, en gardant les pieds bien ancrés au sol et la barre à l'intérieur des rails de guidage."],
    ['0770', 'अपने कोर को संलग्न करें और रैक को साफ़ करने के लिए पीछे हटते हुए बारबेल को खोलें।', 'अपने कोर को सक्रिय करें और स्मिथ मशीन के हुक खोलने के लिए बारबेल को घुमाएँ, अपने पैरों को ज़मीन पर टिकाए रखें और बारबेल को गाइड रेल के भीतर रखें।'],
    ['0770', "Coinvolgi il core e sblocca il bilanciere, facendo un passo indietro per liberare il rack.", "Coinvolgi il core e ruota il bilanciere per sganciarlo dai ganci della Smith Machine, mantenendo i piedi ben piantati e il bilanciere all'interno delle guide."],
    ['0770', '복부에 힘을 주고 바벨을 언래크하여 뒤로 물러 랙을 치웁니다.', '코어에 힘을 주고 바를 돌려 스미스 머신의 훅을 해제하며, 발은 바닥에 고정하고 바는 가이드 레일 안에 유지합니다.'],
    ['0770', 'Napnij mięśnie brzucha i zdejmij sztangę ze stojaka, robiąc krok w tył, aby ją uwolnić.', 'Napnij mięśnie brzucha i obróć sztangę, aby zwolnić ją z haków suwnicy Smitha, nie odrywając stóp od podłoża i utrzymując sztangę wewnątrz prowadnic.'],
    ['0770', 'Напрягите корпус и снимите штангу со стойки, отступив назад, чтобы освободить стойку.', 'Напрягите корпус и поверните гриф, чтобы снять его с крюков машины Смита, удерживая стопы на полу, а гриф — внутри направляющих.'],
    ['0770', 'Merkez bölgenizi devreye sokun ve halteri serbest bırakın, rafı temizlemek için geri adım atın.', 'Merkez bölgenizi devreye sokun ve halteri döndürerek Smith makinesinin kancalarından çıkarın; ayaklarınızı yere sabit basın ve halteri kılavuz rayların içinde tutun.'],
    ['0770', '启动你的核心并打开杠铃，后退以清理架子。', '收紧核心并转动杠铃，以解除史密斯机挂钩的锁定，同时保持双脚踩稳，并确保杠铃始终位于导轨内。'],
    ['0213', 'Grasp the v-bar attachment with an overhand grip, palms facing each other, and your hands shoulder-width apart.', 'Grasp the V-bar attachment with a neutral grip, palms facing each other.'],
    ['0213', 'Sujeta el accesorio en V con un agarre prono, con las palmas una frente a la otra y las manos separadas a la altura de los hombros.', 'Sujeta el accesorio en V con un agarre neutro, con las palmas una frente a la otra.'],
    ['0213', "Saisis la poignée en V avec une prise en pronation, les paumes tournées l'une vers l'autre, et les mains écartées à la largeur des épaules.", "Saisis la poignée en V avec une prise neutre, les paumes tournées l'une vers l'autre."],
    ['0213', 'वी-बार अटैचमेंट को ओवरहैंड ग्रिप से पकड़ें, हथेलियाँ एक-दूसरे के सामने हों और आपके हाथ कंधे की चौड़ाई से अलग हों।', 'वी-बार अटैचमेंट को न्यूट्रल ग्रिप से पकड़ें, हथेलियाँ एक-दूसरे की ओर रहें।'],
    ['0213', "Afferra l'attacco V-bar con una presa sopra la mano, palmi rivolti uno verso l'altro e mani alla larghezza delle spalle.", "Afferra l'attacco V-bar con una presa neutra, con i palmi rivolti uno verso l'altro."],
    ['0213', 'V바 어태치먼트를 오버그립으로 잡고 손가락이 서로를 향하며 손은 어깨너비만큼 벌립니다.', 'V바 어태치먼트를 뉴트럴 그립으로 잡고 손바닥이 서로 마주 보게 합니다.'],
    ['0213', 'Chwyć uchwyt w kształcie litery V nachwytem, dłonie zwrócone do siebie, rozstawione na szerokość barków.', 'Chwyć uchwyt w kształcie litery V chwytem neutralnym, z dłońmi zwróconymi do siebie.'],
    ['0213', 'Возьмитесь за насадку V-образной перекладины хватом сверху, ладони обращены друг к другу, руки на ширине плеч.', 'Возьмитесь за V-образную рукоять нейтральным хватом, ладонями друг к другу.'],
    ['0213', "V-bar aparatını üstten kavrayarak, avuçlarınız birbirine bakacak şekilde ve elleriniz omuz genişliğinde açık olacak şekilde kavrayın.", "V-bar aparatını nötr tutuşla, avuç içleriniz birbirine bakacak şekilde kavrayın."],
    ['0213', '正手握住 V 形杆附件，手掌相对，双手与肩同宽。', '以中立握法握住 V 形手柄，双掌相对。'],
    ['0238', 'Grasp the bar with an overhand grip, keeping your arms straight and your palms facing down.', 'Grasp the bar with an overhand grip, keeping a soft bend in your elbows and your palms facing down.'],
    ['0238', 'Engage your lats and pull the bar down towards your thighs, keeping your arms straight throughout the movement.', 'Engage your lats and pull the bar down towards your thighs, keeping the same slight elbow bend throughout the movement.'],
    ['0238', 'Sujeta la barra con un agarre prono, manteniendo los brazos rectos y las palmas hacia abajo.', 'Sujeta la barra con un agarre prono, manteniendo una ligera flexión en los codos y las palmas hacia abajo.'],
    ['0238', 'Activa los dorsales y tira de la barra hacia abajo, hacia los muslos, manteniendo los brazos rectos durante todo el movimiento.', 'Activa los dorsales y tira de la barra hacia los muslos, manteniendo la misma ligera flexión de los codos durante todo el movimiento.'],
    ['0238', 'Saisis la barre avec une prise en pronation, en gardant tes bras tendus et tes paumes tournées vers le bas.', 'Saisis la barre avec une prise en pronation, en gardant les coudes légèrement fléchis et les paumes vers le bas.'],
    ['0238', "Contracte tes grands dorsaux et tire la barre vers le bas jusqu'à tes cuisses, en gardant les bras tendus pendant tout le mouvement.", 'Contracte tes grands dorsaux et tire la barre vers tes cuisses, en conservant la même légère flexion des coudes pendant tout le mouvement.'],
    ['0238', 'अपनी बाहों को सीधा रखते हुए और अपनी हथेलियों को नीचे की ओर रखते हुए, बार को ओवरहैंड ग्रिप से पकड़ें।', 'बार को ओवरहैंड ग्रिप से पकड़ें, कोहनियों में हल्का मोड़ रखें और हथेलियाँ नीचे की ओर रखें।'],
    ['0238', 'अपनी लेट्स को संलग्न करें और बार को अपनी जांघों की ओर नीचे खींचें, अपनी भुजाओं को पूरे आंदोलन के दौरान सीधा रखें।', 'अपने लैट्स को सक्रिय करें और कोहनियों का वही हल्का मोड़ बनाए रखते हुए बार को अपनी जांघों की ओर नीचे खींचें।'],
    ['0238', 'Afferra la barra con una presa sopra la mano, tenendo le braccia dritte e i palmi rivolti verso il basso.', 'Afferra la barra con una presa prona, mantenendo i gomiti leggermente piegati e i palmi rivolti verso il basso.'],
    ['0238', 'Attiva i dorsali e tira la barra verso le cosce, mantenendo le braccia dritte durante tutto il movimento.', 'Attiva i dorsali e tira la barra verso le cosce, mantenendo la stessa leggera flessione dei gomiti per tutto il movimento.'],
    ['0238', '오버그립으로 바를 잡고 팔을 곧게 펴서 손바닥이 아래를 향하게 합니다.', '오버그립으로 바를 잡고 팔꿈치는 살짝 굽힌 채 손바닥이 아래를 향하게 합니다.'],
    ['0238', '광배근을 단련하여 팔을 곧게 유지하면서 바를 천천히 허벅지 쪽으로 당깁니다.', '광배근에 힘을 주고 팔꿈치의 같은 미세한 굽힘을 유지하면서 바를 허벅지 쪽으로 내립니다.'],
    ['0238', 'Chwyć drążek chwytem nachwytem, trzymając ramiona proste, dłonie skierowane w dół.', 'Chwyć drążek nachwytem, utrzymując lekko ugięte łokcie i dłonie skierowane w dół.'],
    ['0238', 'Napnij mięśnie najszersze i przyciągnij drążek w dół w kierunku ud, utrzymując ramiona wyprostowane przez cały czas ruchu.', 'Napnij mięśnie najszersze i przyciągnij drążek w dół w kierunku ud, zachowując przez cały ruch to samo lekkie ugięcie łokci.'],
    ['0238', 'Возьмите перекладину хватом сверху, держа руки прямыми и ладонями вниз.', 'Возьмитесь за перекладину хватом сверху, слегка согнув локти и направив ладони вниз.'],
    ['0238', 'Напрягите широчайшие и потяните штангу вниз к бедрам, сохраняя руки прямыми на протяжении всего движения.', 'Напрягите широчайшие и потяните перекладину к бёдрам, сохраняя одинаковый небольшой сгиб в локтях на протяжении всего движения.'],
    ['0238', 'Barı üstten kavrayarak, kollarınızı düz ve avuç içleriniz aşağıya bakacak şekilde tutun.', 'Barı üstten kavrayın; dirseklerinizi hafifçe bükülü, avuç içlerinizi aşağı dönük tutun.'],
    ['0238', 'Kollarınızı hareket boyunca düz tutarak barı uyluklarınıza doğru çekin.', 'Kanatlarınızı devreye sokup barı uyluklarınıza doğru çekerken dirseklerinizdeki hafif bükülmeyi hareket boyunca koruyun.'],
    ['0238', '正手握住杠铃，保持手臂伸直，手掌朝下。', '正手握住直杆，肘部保持轻微弯曲，掌心向下。'],
    ['0238', '收紧背阔肌并将杠铃向下拉向大腿，在整个运动过程中保持手臂伸直。', '收紧背阔肌，将直杆向下拉至大腿，同时在整个动作中保持肘部同样的轻微弯曲。'],
  ])('corrects %s instruction copy', (id, source, expected) => {
    expect(correctExerciseInstructions(id, [source])).toEqual([expected])
  })

  it('leaves unrelated and custom instructions unchanged', () => {
    const steps = ['Keep this instruction verbatim.']
    expect(correctExerciseInstructions('custom-1', steps)).toEqual(steps)
  })
})
