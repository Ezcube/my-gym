import { pathToFileURL } from 'node:url'
import { EXERCISE_VISUAL_IDS } from '../frontend/src/lib/exercise-visuals.js'
import { EXIDX } from '../frontend/src/lib/exercises.js'
import { MUSCLE_NAME, musclesOf } from '../frontend/src/lib/muscles.js'
import { correctExerciseInstructions } from '../frontend/src/lib/exercise-instructions.js'

const approved = new Set(EXERCISE_VISUAL_IDS)
const list = values => values.length ? values.join(', ') : 'none'

const TECHNIQUE_ACCURACY = Object.freeze({
  '0025': 'The bar path reaches the middle of the chest before a controlled press.',
  '3666': 'Use an inclined motorized treadmill. Show walking, not running: natural heel contact, mid-stance, then controlled toe-off while the torso stays upright.',
  '2138': 'Use a stationary exercise bike with a correctly adjusted saddle. Keep the athlete seated and show one controlled pedal cycle with the knee never locked out.',
  '2141': 'Use an elliptical cross trainer with both feet planted on its pedals and hands on the moving handles. Show alternating elliptical stride phases without impact or free-standing walking.',
  '2311': 'Use a rotating stepmill with visible moving stairs. Keep the torso upright and show each foot landing fully on a step without hanging from the rails.',
  '0979': 'Use a resistance band anchored at chest height. Stand perpendicular to the anchor, press both hands straight away from the sternum, and resist torso rotation throughout.',
  '0289': 'Use a flat horizontal bench and two separate dumbbells. Keep both feet planted and the shoulder blades stable; each dumbbell descends beside the chest before a controlled press, with no barbell or joined weight.',
  '0293': 'Show a bilateral row with one dumbbell in each hand from a stable hip hinge and neutral spine. Pull both weights toward the lower ribs together; no one-arm stance or torso swing.',
  '1760': 'Use one dumbbell held vertically at the chest. The heels stay planted and the torso remains braced while the hips travel down between the legs; this is not a barbell squat.',
  '0432': 'Use a hip hinge rather than a squat. Two dumbbells travel close to the legs while the spine stays neutral with only a slight knee bend; stop at a controlled hamstring stretch.',
  '0410': 'Show a rear-foot-elevated split squat with the rear foot elevated on a bench. The front foot stays fully planted, the dumbbells hang at the sides, and the torso remains controlled; this is not a standard forward lunge.',
  '0314': 'Use an incline bench set to 45 degrees and two separate dumbbells. Lower both weights beside the upper chest before a controlled press; this is not a flat bench or barbell press.',
  '0308': 'Show a flat bench fly with two separate dumbbells and a fixed slight elbow bend. Lower both arms in a wide arc and return along the same path; this is not a dumbbell press.',
  '0405': 'Keep the athlete seated against an upright back support. Press both dumbbells vertically from shoulder height without leg drive; this is not a standing or Arnold press.',
  '0310': 'Raise both dumbbells forward together with a stable torso and nearly straight elbows. Stop at shoulder height, not overhead or out to the sides, then lower under control.',
  '0406': 'Keep both dumbbells hanging at the sides while the arms remain straight. Elevate both shoulders straight upward, pause, and lower under control; no elbow curl or shoulder rolling.',
  '0333': 'Use a stable hip hinge and neutral spine while both upper arms stay beside the torso. Keep the elbows fixed and extend only the forearms backward until the arms are straight; this is not a row or shoulder swing.',
  '0383': 'From a stable hip hinge and neutral spine, raise both dumbbells out to the sides with a fixed slight elbow bend. Stop with the upper arms near shoulder height; this is not a row or shrug.',
  '0297': 'Sit with one dumbbell and brace the working elbow against the inner thigh. The upper arm remains stationary while the forearm curls through a controlled full range without torso movement.',
  '2188': 'Sit upright and use one dumbbell held with both hands overhead. Keep the upper arms close to the ears while only the elbows move to lower the weight behind the head and extend it again.',
  '0375': 'Lie lengthwise on a flat bench and use one dumbbell held with both hands above the chest. With a slight fixed elbow bend, lower the weight in an arc behind the head and return along the same path; this is not a press.',
  '0413': 'Two dumbbells hang at the sides. The heels stay planted and the torso remains braced while the hips move down and back until the thighs approach parallel, then stand under control; this is not a goblet or barbell squat.',
  '1459': 'Use a hip hinge. Two dumbbells travel close to the legs while a soft fixed knee bend and neutral spine are maintained. The hips move backward until a controlled hamstring stretch, then extend; this is not a squat.',
  '0336': 'Keep two dumbbells hanging at the sides and step forward into an alternating lunge. The front foot stays fully planted while the rear knee lowers under control, then push through the front heel to return; this is not a reverse or static split squat.',
  '0431': 'Use a stable knee-height platform and two dumbbells hanging at the sides. The entire lead foot stays on the platform; drive through the lead leg to stand tall, then descend under control with no jump or push-off from the trailing foot.',
  '0417': 'Two dumbbells hang at the sides while the torso stays upright. Raise both heels together to the highest controlled position while the knees remain straight but not locked, pause, and lower slowly; no bouncing or knee bend.',
  '0003': 'Show a supine bicycle crunch on the floor. Bring the opposite elbow toward the bent knee while the other leg extends and hovers; alternate smoothly without pulling the neck. This is not a stationary exercise bike.',
  '0687': 'Sit with the torso leaned back, knees bent, and feet lifted off the floor. Rotate the ribcage and shoulders together from side to side while the hands stay centered in front of the chest; the movement comes from the torso, not just the hands.',
  '0630': 'Start in a rigid high plank with hands under the shoulders. Alternate one knee toward the chest while the other leg stays extended; the hips stay low and the shoulders remain stacked. This is not a standing run or squat thrust.',
  '0276': 'Use a supine tabletop position with hips and knees at 90 degrees and the lower back pressed into the floor. Lower one opposite arm and leg toward the floor, return to center, then switch sides without arching the lumbar spine.',
  '0464': 'Begin in a stable high plank. Rotate the whole torso into a controlled side-plank position with the top arm toward the ceiling, then return to both hands and alternate sides. Keep the legs and hips controlled; this is not a forearm plank.',
  '2137': 'Stay seated against an upright back support. Begin with elbows forward; the palms face the athlete. Press upward while the forearms rotate until the palms face forward overhead. Reverse the same path under control; this is not a standard shoulder press.',
  '0296': 'Lie on a flat bench with one dumbbell in each hand. The dumbbells stay close together above the chest while the elbows remain tucked beside the torso; lower under control and press with the triceps. This is not a wide chest press or fly.',
  '0351': 'Lie on a flat bench with one dumbbell in each hand. The upper arms remain vertical and stationary while only the elbows move to lower both dumbbells toward the forehead and extend them again; this is not a pullover or press.',
  '0315': 'Sit against an incline bench set to 45 degrees. Both arms hang slightly behind the torso with palms facing forward. The upper arms remain stationary while both forearms curl the dumbbells toward the shoulders; this is not a shoulder press.',
  '0437': 'Stand upright; the two dumbbells begin in front of the thighs. Lead upward with the elbows; the elbows stay above the hands as the weights rise close to the body toward the upper chest, then lower slowly. This is not a shrug or biceps curl.',
  '0372': 'Sit at a preacher bench with the backs of both upper arms fully supported on the pad. Begin with the palms face up and elbows nearly extended; curl only at the elbows while the upper arms stay planted. This is not a standing curl.',
  '0439': 'Stand tall and curl both dumbbells with the palms rotating to face forward. At the top, rotate the forearms until the palms face away from the athlete, then lower under control with a pronated grip before returning to neutral. This is not an ordinary curl.',
  '0381': 'Hold one dumbbell at each side and step backward into an alternating reverse lunge. The front foot stays fully planted while the rear knee lowers under control; push through the front heel to return. This is not a forward lunge.',
  '0407': 'Stand upright holding one dumbbell at one side. Bend only toward the weighted side so the dumbbell slides down the outside of the thigh, then use the trunk to return to neutral. Keep the shoulders square with no torso rotation or hip shift.',
  '0409': 'Place the forefoot of one working leg on the edge of a stable step while the other leg remains off the platform. Hold one dumbbell while the other hand holds a fixed support. Lower the working heel below the step, rise fully onto the toes with a straight knee, and lower slowly; this is not a bilateral calf raise.',
  '0577': 'Use a seated lever chest-press machine. The handles travel forward from chest height and return under control while the back and shoulder blades stay against the pad. Keep the feet planted and wrists neutral; this is not a free-weight press.',
  '0603': 'Use a seated lever shoulder-press machine with the back fully supported. The handles begin at shoulder level; press overhead without locking the elbows, then lower evenly. Keep the feet planted with no leg drive or lower-back arch.',
  '0599': 'Use a seated leg-curl machine adjusted so the knee joints align with the machine pivot. The thigh pad pins the thighs down and the roller sits behind the lower legs just above the heels. Curl the heel roller down and back by bending only the knees; this is not a lying leg curl.',
  '0178': 'Stand centered between two low cable pulleys with one handle in each hand and the cables under continuous tension. With a slight fixed elbow bend, raise both arms out to the sides only to shoulder height, then lower slowly. Keep the torso still and do not shrug or press overhead.',
  '0203': 'Use a rope attached to a low pulley and a stable hip hinge with a neutral spine. Pull the rope toward the upper chest as the elbows travel wide and the shoulder blades draw together, then return slowly. This is a rear-delt row, not a face pull or biceps curl.',
  '0009': 'Use a kneeling assisted dip machine. The knees stay on the moving assistance pad while the hands hold the parallel handles with a neutral grip, palms facing each other. Keep a slight forward torso lean, lower until the upper arms approach parallel, then press smoothly without locking the elbows. This is not a bench dip or unsupported dip.',
  '0017': 'Use a kneeling assisted pull-up machine. The knees stay on the moving assistance pad while the hands take a slightly wider than shoulder-width overhand grip. Begin with controlled shoulder elevation, then drive the elbows down until the chin rises above the handles and lower slowly. Use no kipping or unsupported free hang.',
  '0594': 'Use a seated calf-raise machine with the balls of both feet on the platform and the knees secured under the thigh pads. Let the heels descend below the platform, then raise them as high as possible and lower slowly. The movement comes only from the ankles, with no knee extension or bouncing.',
  '0597': 'Use a seated hip-abduction machine with the pads against the outside of the knees and the back fully supported. Keep both feet on the footrests, press both knees outward through a controlled range, pause, and return slowly. Keep the pelvis level with no torso rocking.',
  '0598': 'Use a seated hip-adduction machine with the pads against the inside of the knees and the back fully supported. Begin with the legs comfortably apart, squeeze both knees inward until the pads nearly meet, then return slowly. Keep the pelvis level and do not lift the feet from the footrests.',
  '0868': 'Stand facing the cable machine and grasp the cable attachment with an underhand grip, palms up. Keep the elbows close to the sides and the upper arms stationary while only the forearms curl the attachment toward the shoulders, then lower under control. Keep the torso still throughout.',
  '0194': 'Use a rope attached to a high pulley and stand facing away from the cable stack with the feet shoulder-width apart, not a split stance. Keep the upper arms beside the ears with the elbows pointing forward while the rope lowers behind the head, then extend the elbows fully under control. This is not a cable pushdown.',
  '0596': 'Use a seated lever fly machine. The back stays against the pad while both hands hold horizontal handles with a pronated grip, palms down and knuckles up, and a slight fixed elbow bend. Use horizontal handles, not vertical handles or a neutral grip. Bring the handles together in front of the chest, pause while squeezing the chest, then return slowly. This is not a chest press.',
  '0602': 'Use a seated reverse-fly machine. The chest stays against the pad while both hands hold horizontal handles with an overhand grip, palms down and knuckles up, and the arms remain slightly bent. Use horizontal handles, not vertical handles or a neutral grip. Pull the handles outward and backward while squeezing the shoulder blades together, then return slowly. This is not a row or shrug.',
  '1350': 'Use a chest-supported lever row with an overhand shoulder-width grip. Pull the handles toward the body while the elbows travel backward and the shoulder blades draw together. The chest remains on the pad throughout with no torso swing. This is not a cable row.',
  '0748': 'Use a flat horizontal bench positioned inside a Smith machine. Keep both feet firmly planted and the back supported. Lower the bar along the fixed path to the middle of the chest with the elbows slightly tucked, pause without bouncing, then press up. The bar remains inside the Smith guide rails throughout. This is not a free-weight bench press.',
  '0757': 'Use a bench set to a 30-45 degree incline inside a Smith machine. Keep the back against the pad and both feet planted. Lower the bar along the fixed guide rails to the upper chest, pause, then press up. The bar remains inside the Smith guide rails. This is not a vertical backrest, and do not lower the bar toward the neck.',
  '0774': 'Show a standing Smith machine press with the feet shoulder-width apart and the knees slightly bent. The bar begins at shoulder level with an overhand grip and travels overhead only inside the fixed vertical guide rails. Lower it back to the shoulders under control. This is not a free barbell press and not a press behind the neck.',
  '1359': 'Set the Smith bar so the bar starts at hip height. Use a stable hip hinge with slightly bent knees and a straight back. Pull the bar toward the lower chest while squeezing the shoulder blades, then lower it under control. The bar remains inside the Smith guide rails. This is not an upright row or shrug.',
  '0770': 'Use a Smith machine. The bar rests on the upper traps. Keep the feet shoulder-width apart with the toes slightly turned out. Rotate the bar to release the Smith hooks while keeping the feet planted; do not step backward. The bar must move only inside the fixed guide rails. Squat with the chest up until the thighs reach parallel or slightly below, then drive through the heels.',
  '0198': 'Use a seated commercial lat-pulldown station with the thighs secured under the knee pad and both feet flat. Take a pronated grip slightly wider than the shoulders. With a neutral spine and only a 10-15 degree torso recline, drive the elbows down and slightly back while pulling the bar to the upper chest, then return under control. This is not a behind-the-neck pull; do not stand, swing backward, or pull the bar below chest level.',
  '0180': 'Use a low cable seated row with both feet braced on footplates and the knees softly bent. Hold a straight horizontal handle with a pronated, palms-down grip. Begin with long arms, unlocked elbows, and a neutral spine; pull the handle to the lower ribs or upper abdomen while the elbows travel behind the torso and the shoulder blades retract. This is not a V-bar row; do not round the lower back or rock the torso.',
  '0238': 'Show a standing straight-arm high-cable pulldown with a straight bar and a pronated shoulder-width grip. Keep soft elbows at a constant angle with a slight bend, the spine neutral, and only a small hip hinge. Move the bar in an arc from upper-chest or head height down to the thighs using shoulder extension. This is not a triceps pushdown: do not flex the elbows, squat, round the back, or move the bar behind the body.',
  '0213': 'Use a seated high cable row with the pulley clearly above chest or face level. Hold a close V-bar with a neutral grip, palms facing each other at the attachment fixed narrow width. Keep a neutral spine and pull diagonally toward the lower sternum or upper abdomen while the elbows travel back and slightly down. This is not a low-pulley horizontal row, vertical lat pulldown, overhand grip, or behind-the-neck movement.',
  '0245': 'Use a seated lat pulldown with the thighs secured under the pad. Hold the bar with a supinated grip, palms facing the athlete and hands slightly wider than shoulder-width apart. Keep the chest lifted, wrists neutral, and torso only slightly reclined while the elbows stay close and drive downward; finish with the bar at the upper chest. This is not a behind-the-neck pull; do not use a pronated grip, stand, overextend the wrists, or swing the torso.',
  '0274': 'Show a controlled floor crunch with the knees bent and both feet flat. Rest only the fingertips lightly behind the head with the elbows open; do not pull on the neck. Brace the abs and lift only the shoulder blades while the lower back stays on the floor, then lower slowly. This is not a full sit-up.',
  '0872': 'Show a reverse crunch with the knees bent in a supine tabletop position and the hips near 90 degrees. Brace the abs and curl the pelvis toward the ribcage so the hips lift only slightly, then lower with control. This is not a straight-leg raise: use no leg swing, momentum, or roll onto the neck.',
  '0620': 'Use a flat horizontal bench that fully supports the head, back, and pelvis. Place both hands under the glutes and keep the legs straight and together. Raise the legs toward vertical, then lower only while the lower back stays pressed into the bench; stop before the feet pass below bench height. This is not a reverse crunch or hanging leg raise, and do not bend the knees.',
  '0705': 'Show a forearm side plank with the supporting elbow directly below the shoulder, the legs straight and stacked, and the body forming a straight line from head to heels. Keep the shoulders and hips vertically stacked during a static hold, then lower under control. Do not use a straight-arm support, lift the top leg, rotate the torso, bend the knees, or let the hips sag.',
  '0507': 'Show a controlled jackknife sit-up beginning fully supine with the arms extended on the floor overhead and both legs straight and together. Lift the upper body and both legs simultaneously into a balanced V position while reaching toward the toes, then lower together without momentum. This is not a tucked crunch, alternating leg raise, or seated starting pose.',
  '1373': 'Show a standing bodyweight calf raise on a flat floor. Keep both feet shoulder-width apart, toes forward, and use a wall or stable support only for balance. Raise both heels together onto the balls of the feet, pause, and lower slowly with knees straight but not locked. No bouncing, jumping, or knee bending.',
  '1387': 'Show a controlled one-leg floor calf raise. Hold a wall or stable support, lift one foot completely off the floor, and keep the pelvis level while the working heel rises onto the ball of the foot and lowers slowly. Show one working leg at a time; switch legs only between repetitions and do not hop or bounce.',
  '1490': 'Show a bilateral calf raise on a stable low step: the balls of both feet stay on the step while both heels hang just below the edge. Keep one hand on a railing or wall for balance, rise onto the toes, pause, then lower the heels below the step under control. Do not jump, drop, or use a deep knee bend.',
  '1397': 'Show a standing bodyweight calf raise on a flat floor with both feet shoulder-width apart and toes forward. Raise both heels together as high as controlled, pause, and lower slowly while the knees remain straight but not locked. Keep the torso still and avoid bouncing or rolling the ankles.',
  '1377': 'Show a standing calf stretch facing a wall. Place both hands on the wall, step one leg back with the rear heel staying grounded and the rear knee straight but not locked, bend the front knee, and lean forward until the rear calf stretches. Hold, switch sides, and do not bounce or lift the rear heel.',
  '1000': 'Show a single-leg calf raise with a resistance band around the ball of the working foot. Hold a stable support for balance, keep the non-working leg off the floor, raise and lower the working heel slowly, and switch legs only after completing the set. Keep the knee straight but not locked and avoid bouncing or twisting.',
  '1253': 'Show a donkey calf raise using a leverage machine. Place the forefeet on the platform with the heels hanging off, keep the torso and hips stable, hold the machine supports, raise the heels together, pause, and lower under control without knee bending or bouncing.',
  '1368': 'Show seated ankle circles on the floor with both legs extended. Lift one foot clear of the floor and make slow full circles from the ankle in one direction, reverse direction, then switch legs. Keep the knee still and do not move the hip or whole leg.',
  '1369': 'Show a bilateral standing calf raise with one resistance band running under both feet. Hold both band ends for light stability, keep the feet shoulder-width and the knees straight but not locked, raise both heels together, pause, and lower slowly without band slipping or bouncing.',
  '1370': 'Show a barbell floor calf raise. Place the balls of both feet on the edge of a barbell lying securely on the floor with the heels hanging off, use a stable support if needed, raise both heels together, pause, and lower below the bar under control without rolling the ankles.',
  '1371': 'Show a seated barbell calf raise on a flat bench. Sit upright with the barbell resting securely across the thighs, place the balls of both feet on a low raised block, lower the heels below the block for a stretch, then raise them together and pause. Keep the knees and torso still; do not bounce or roll the ankles.',
  '1372': 'Show a standing barbell calf raise in a squat rack. Rest the barbell across the upper back, keep the feet shoulder-width and toes forward, raise both heels together onto the balls of the feet, pause at the top, and lower slowly with the knees straight but not locked. Keep the torso vertical and do not bounce.',
  '1374': 'Show a low-box jump followed by single-leg stabilization. Start facing a low plyometric box, jump up, land softly with one foot on the box while the other foot stays clear of the edge, hold the landing steady for a moment, then step down under control and switch legs. Keep the knee aligned over the foot; no uncontrolled drop or twist.',
  '1375': 'Show a standing cable calf raise at a cable machine. Stand on a small stable platform with the balls of both feet supported and the heels free, hold the machine for balance while the cable provides resistance, raise both heels together, pause, and lower below the platform slowly. Keep the knees straight but not locked and avoid bouncing.',
  '1376': 'Show a single-leg cable calf raise facing a cable machine. Hold the machine for support, attach a low cable ankle cuff to the working leg, lift the other foot clear of the floor, then raise and lower the working heel slowly through a full range. Switch legs after the set; keep the pelvis level and do not hop or twist.',
  '1378': 'Show a standing calf stretch with a rope. Face a wall for balance, loop the middle of the rope around the ball of one foot, step the other leg back with the rear heel grounded and knee straight, then gently pull the rope while leaning forward with a straight back. Hold, release, and switch sides; do not bounce or lift the rear heel.',
  '1383': 'Show a hack-machine calf raise on a sled machine. Place the balls of both feet on the platform with the heels hanging off, keep the body supported under the shoulder pads and hold the handles, raise both heels together, pause, then lower slowly below the platform. Keep the knees steady and avoid bouncing.',
  '1384': 'Show a single-leg hack-machine calf raise on a sled machine. Stand on the platform with one foot and the other foot completely off the machine, keep the torso supported under the shoulder pads and hold the handles, raise and lower the working heel slowly, then switch legs. Keep the knee aligned and do not hop or twist.',
  '1385': 'Show a seated calf raise on a leg press machine. Sit with the back against the backrest, place only the balls of both feet on the lower edge of the footplate with heels hanging off, release the safety handles, and move the footplate only through ankle motion after the knees are extended. Raise, pause, and lower the heels slowly without knee bending or bouncing.',
  '1386': 'Show a single-leg donkey calf raise using a wall or bar for support. Lean slightly forward with one foot planted and the other leg lifted, keep the working knee softly bent, raise the working heel high onto the ball of the foot, pause, and lower slowly. Switch legs after the set; keep the pelvis level and do not hop or bounce.',
  '1379': 'Show a seated dumbbell calf raise. Sit upright on a bench with both balls of the feet on a low raised step and both heels hanging off, place one dumbbell securely across the thighs, raise both heels together, pause, and lower below the step slowly. Keep the knees and torso still; do not bounce or roll the ankles.',
  '1380': 'Show a seated single-leg dumbbell calf raise with a hammer grip. Sit upright on a bench, place one ball of the foot on a raised step with the heel hanging off, hold the dumbbell with palms facing each other, raise and lower the working heel slowly, then switch legs. Keep the back straight and do not bounce.',
  '1381': 'Show a seated single-leg dumbbell calf raise with a palm-up grip. Sit upright, hold one dumbbell palm up on top of the thigh, keep the other leg lifted clear, raise the working heel through the ball of the foot, pause, and lower slowly. Switch legs after the set; keep the torso still.',
  '1382': 'Show a wall-supported exercise-ball calf raise with dumbbells. Stand with an exercise ball between the lower back and a wall, feet shoulder-width and toes forward, hold one dumbbell in each hand, raise both heels together onto the balls of the feet, pause, and lower slowly. Keep the knees and torso stable; do not squat or bounce.',
  '1388': 'Show a seated peroneals stretch with a rope. Sit on the floor with both legs extended, loop the rope around the ball of one foot and hold both ends, gently pull the foot toward you to flex the ankle and stretch the calf, hold, release, and switch legs. Keep the knee straight and do not yank or bounce.',
  '0088': 'Show a seated barbell calf raise. Sit upright on a flat bench with the barbell secured across the thighs, place the balls of both feet on a low raised block with the heels free, raise both heels together, pause, and lower slowly. Keep the knees and torso still; do not bounce or roll the ankles.',
  '0108': 'Show a standing barbell calf raise. Rest a barbell across the upper back in a stable stance with feet shoulder-width and toes forward, raise both heels together onto the balls of the feet, pause, and lower slowly. Keep knees straight but not locked and do not bounce.',
  '0111': 'Show a standing barbell rocking leg calf raise. Rest the barbell across the upper back, keep both feet shoulder-width and toes forward, gently rock through the forefoot as both heels rise and lower under control. Keep the torso stable and the knees softly unlocked; no jumping or rolling the ankles.',
  '0257': 'Show a standing circles-knee calf stretch. Stand with feet shoulder-width and hands on the hips, bend both knees slightly, lift both heels onto the balls of the feet, then make slow controlled circles with the knees clockwise and counterclockwise. Keep the torso upright and avoid twisting or bouncing.',
  '0284': 'Show a bodyweight donkey calf raise. Place the balls of both feet on the edge of a raised step with heels hanging off, hinge slightly forward, and hold a wall or rail for support. Raise both heels high, pause, then lower below the step slowly without deep knee bending or bouncing.',
  '0400': 'Show a seated single-leg dumbbell calf raise. Sit upright on a bench, place the dumbbell securely on the right thigh, extend the left leg clear, and place the ball of the right foot on a raised step with the heel hanging off. Raise and lower the right heel slowly, then switch legs; keep the back still and do not bounce.',
  '0727': 'Show a standing single-leg calf raise while holding one dumbbell in one hand. Lift the non-working foot completely off the floor, balance on the other foot, raise the working heel high, pause, and lower slowly. Keep the pelvis level and switch legs between sets without hopping or twisting.',
  '0738': 'Show a 45-degree sled calf press. Sit on a sled machine set at 45 degrees with both toes on the platform, toes forward, heels free, and push the platform away using only ankle extension. Pause at the top and return slowly; keep knees stable and do not lock or bounce.',
  '0742': 'Show a forward-angled sled calf raise. Use a sled machine with the balls of both feet on the platform and heels hanging off, hold the handles or sides for support, raise both heels high against the sled resistance, pause, and lower slowly. Keep the torso and knees steady.',
  '0763': 'Show a Smith-machine reverse calf raise. Set the bar just below shoulder height, face the bar, place the balls of both feet on the edge of a step with heels hanging off, and hold the bar with a straight back. Raise both heels high, pause, then lower below the step without bouncing.',
  '0773': 'Show a standing calf raise inside a Smith machine. Set the bar across the upper back, keep both feet flat and shoulder-width with toes forward, and hold the bar for stability. Raise both heels together onto the balls of the feet, pause, then lower slowly without bouncing or bending the knees.',
  '0833': 'Show a weighted donkey calf raise. Place the balls of both feet on a raised platform with the heels hanging off, hinge the torso slightly forward, and hold a stable support while the weight rests securely on the upper back. Raise both heels high, pause, and lower below the platform under control.',
  '0999': 'Show a single-leg calf raise with a resistance band looped around the ball of the working foot. Hold a stable support, keep the non-working foot clear, raise and lower the working heel through a full range, then switch legs. Keep the pelvis level and avoid hopping or twisting.',
  '1389': 'Show a seated posterior tibialis stretch with a rope. Sit on the floor with both legs extended, loop the rope around the ball of one foot, gently pull the foot toward you to flex the ankle and stretch the calf, hold, release, and switch legs. Keep the knee straight and do not bounce.',
  '1390': 'Show a seated calf stretch. Sit on the edge of a chair or bench with one leg extended and its heel grounded, lean forward slightly until the calf stretches, hold, then switch legs. Keep the spine long and do not bounce or lift the heel.',
  '1391': 'Show a seated calf press on a sled leg-press machine. Keep the knees slightly bent, place both toes and balls of the feet on the sled with heels hanging off, release the safety handles, and press the sled away by extending the ankles. Pause, then flex the ankles to lower the heels under control; do not bounce or lock the knees.',
  '1392': 'Show a single-leg calf press on a sled leg-press machine. Sit with the back supported, place only the toes and ball of one foot on the sled with the heel off, keep the knee softly bent, press forward through ankle extension, pause, and lower slowly. Keep the other leg clear and switch sides after the set.',
  '1393': 'Show a Smith-machine one-leg floor calf raise. Face away from the machine with the bar resting across the lower leg just above the ankle, place the ball of the working foot on a raised block, hold the bar for stability, raise the heel through ankle extension, pause, and lower slowly. Keep the other foot clear and switch legs.',
  '1395': 'Show a seated single-leg calf raise in a Smith machine. Sit with the back against the pad, place one ball of the foot on the footrest and keep the other leg off, raise the working heel high, pause, and lower slowly. Keep the torso still and switch legs between sets.',
  '2289': 'Show a seated lever calf press. Align the shoulders under the lever pad, place both toes and balls of the feet on the pad with heels hanging off, hold the side supports, press the pad down by extending the ankles, pause, then let the heels rise back under control. Keep knees steady and do not bounce.',
  '1398': 'Show a standing calf stretch facing a wall. Place both hands at shoulder height, step one foot back with the rear heel flat and knee straight, bend the front knee slightly, and lean forward until the rear calf stretches. Hold, then switch sides without bouncing or lifting the heel.',
  '1407': 'Show a calf push stretch with hands against a wall. Stand hip-width from the wall, place both hands at shoulder height, step one foot back with the rear heel grounded and leg straight, bend the front knee and lean forward, hold, then switch legs. Keep the back heel down and do not bounce.',
  '1708': 'Show an assisted lying calf stretch. Lie on your back with both legs extended, bend one knee with that foot flat, use your hands or a towel to gently pull the toes of the straight leg toward the body, hold, release, and switch legs. Keep the knee relaxed and do not yank or bounce.',
  '2315': 'Show a seated rotary lever calf raise. Adjust the leverage machine so the knees are slightly bent, place both toes on the footplate with heels hanging off, hold the handles, raise both heels high through the balls of the feet, pause, and lower slowly. Keep knees and torso stable.',
  '2334': 'Show a seated sled-machine calf press. Sit with the back against the pad, place the toes and balls of both feet on the platform edge with heels hanging off, keep knees slightly bent, press the platform away by extending the ankles, pause, and lower under control.',
  '1394': 'Show a Smith-machine reverse calf raise. Set the bar just below shoulder height, face the bar, place the balls of both feet on a stable step with the heels hanging off, hold the bar for support, raise both heels high, pause, and lower below the step under control. Keep the toes forward and the knees steady.',
  '1396': 'Show a Smith-machine toe raise on a raised platform. Position the shoulders under the bar with feet shoulder-width apart, place the balls of both feet on a platform with the heels hanging off, grip the bar overhand, brace the core and keep the back straight, then raise and lower the heels slowly without bouncing.',
  '2335': 'Show a seated lever calf press. Adjust the seat so the shoulders align under the lever pad, place the toes on the lower platform with the knees under the pad, hold the side handles, press the lever down by extending the ankles and lifting the heels, pause, then lower slowly. Keep the knees and torso stable.',
  '3240': 'Show a wall-supported exercise-ball calf raise with a tennis ball between the knees. Place the ball between the lower back and wall, stand with feet slightly forward, hold one dumbbell at each side, gently squeeze a tennis ball between the knees, raise both heels together, pause, and lower under control without letting the knees collapse inward.',
  '3241': 'Show a wall-supported exercise-ball calf raise with a tennis ball between the ankles. Face a wall with the exercise ball behind the lower back, stand shoulder-width, hold one dumbbell at each side, keep a tennis ball lightly between the ankles, raise both heels together, pause, and lower slowly while keeping the ankles aligned.',
  '1582': 'Show a reclining big-toe pose with a rope. Lie on your back with both legs extended, loop the rope around the ball of one foot, keep that knee straight and foot flexed, raise the leg toward the chest, hold the hamstring and calf stretch, lower slowly, then switch legs.',
  '1585': 'Show a runner stretch. Stand hip-width, step one foot forward, bend the front knee while keeping the rear leg straight, place both hands on the front thigh for support, hold the rear calf and hamstring stretch, then switch sides. Keep the back heel grounded and do not bounce.',
  '1599': 'Show a standing hamstring and calf stretch with a strap. Stand upright, loop the strap around the ball of one foot, hold both ends, keep the leg straight, hinge forward from the hips with a straight back, hold, release, and switch legs without bouncing.',
  '1548': 'Show a seated chair leg-extended stretch. Sit on the edge of a chair with a straight back and both feet grounded, extend one leg forward with the heel on the floor, lean forward slightly to stretch the front thigh, hold, then switch legs.',
  '3212': 'Show a basic standing toe touch. Stand shoulder-width with arms at the sides, hinge forward with a straight back and slightly bent knees, reach toward the toes while keeping the legs long, pause, then return slowly without bouncing or rounding aggressively.',
  '1410': 'Show a barbell lateral lunge. Hold the bar across the upper back, step wide to one side while the opposite foot stays planted, bend the stepping knee and keep the other leg straight, push back to center, then switch sides. Keep the chest lifted and do not let the knee collapse inward.',
  '1417': 'Show a one-legged diagonal kick hamstring curl on a stability ball. Lie on your back with both heels on the ball, lift the hips into a bridge, bring one knee toward the chest, kick that leg diagonally across the body while the other heel stays on the ball, return with control, and alternate sides.',
  '1420': 'Show a kneeling barbell jump squat. Begin kneeling with the bar across the upper back, brace the core and glutes, explosively rise into a jump by extending hips, knees, and ankles, land softly with bent knees, and repeat. Keep the bar stable and the landing controlled.',
  '1425': 'Show a 45-degree sled one-leg press. Sit with the back supported, place one foot on the sled footplate, press the sled away by extending that leg, lower by bending the knee under control, then switch legs. Keep the pelvis and back against the pad and do not lock the knee.',
  '1433': 'Show a Smith-machine front squat with a clean grip. Set the bar at shoulder height, face it, use a slightly wider overhand grip, position the bar across the front shoulders and collarbone, keep the chest up and core braced, squat to at least parallel, then drive through the heels to stand.',
  '1434': 'Show a Smith-machine low-bar squat. Place the bar low across the upper back, keep the feet shoulder-width and the chest braced, sit the hips back while bending the knees until the thighs approach parallel, then drive through the heels to stand. Keep the bar moving only along the fixed rails.',
  '1435': 'Show a barbell low-bar squat. Set the bar low across the upper back, brace the core, hinge the hips back with knees tracking over the toes, descend to at least parallel, then drive through the heels to stand. Keep the bar balanced over the mid-foot and the spine neutral.',
  '1436': 'Show a barbell high-bar squat. Rest the bar high on the upper trapezius, keep the torso upright and feet shoulder-width, descend with knees tracking over toes until the thighs approach parallel, then stand by driving through the whole foot. Keep the spine neutral.',
  '1438': 'Show a seated two-arm kettlebell military press. Sit upright with back supported and one kettlebell at each shoulder, press both kettlebells vertically overhead without leaning or using the legs, then lower them under control to shoulder height. Keep wrists neutral and elbows under the bells.',
  '1439': 'Show a gripless shrug on a leverage machine. Stand upright with the shoulder pads resting on the upper shoulders and arms relaxed, elevate both shoulders straight toward the ears without bending the elbows, pause briefly, then lower under control. Do not roll the shoulders or bend the knees.',
  '1441': 'Show a one-arm reverse wrist curl over a bench. Support the pronated forearm on the bench with the wrist just beyond the edge, keep the forearm still, extend the wrist to raise the back of the hand, then lower the dumbbell under control.',
  '1451': 'Show a seated dip on a leverage machine. Keep the back against the pad and hands on the parallel handles, press the handles down by extending the elbows while keeping the shoulders depressed, then return slowly without leaning or swinging.',
  '1452': 'Show a seated crunch on a leverage machine. Keep the hips secured and hands on the upper handles, curl the ribcage toward the pelvis by flexing the trunk, then return slowly to upright without pulling with the arms.',
  '1456': 'Show a standing close-grip barbell military press. Use hands clearly inside shoulder width, start with the bar at the upper chest, press it vertically overhead without leg drive, then lower under control while keeping the core braced.',
  '1457': 'Show a standing wide-grip barbell military press. Use hands clearly wider than shoulder width, start with the bar at the upper chest, press it vertically overhead without leg drive, then lower under control while keeping the core braced.',
  '0001': 'Show a 3/4 sit-up on a mat. Keep the knees bent and feet flat, hands behind the head, curl the torso to roughly 45 degrees without pulling the neck, then lower with control.',
  '0002': 'Show a standing 45-degree side bend. Keep the feet planted and spine long, bend the torso laterally toward one side without rotating, then return upright and alternate sides.',
  '1512': 'Show an all-fours quad stretch. Start on hands and knees, extend one leg back, bend that knee and reach the heel toward the glutes while keeping the hips controlled, then switch sides.',
  '0006': 'Show alternating heel touchers. Lie supine with knees bent and shoulders slightly lifted; reach one hand toward the same-side heel, return to center, then reach to the opposite heel without pulling the neck.',
  '0007': 'Show an alternate lateral pulldown on a cable machine. Sit upright and pull one single handle toward the same-side upper chest while the other arm stays extended, then switch sides without torso swing.',
  '3293': 'Show an archer pull-up on a straight bar. Use a wide overhand grip, pull the chest toward one hand while the opposite arm stays straight, then lower and alternate sides without swinging.',
  '3294': 'Show an archer push-up. Start with hands wider than the shoulders, bend one elbow to lower the chest while the opposite arm stays straight to the side, then press up and alternate.',
  '2355': 'Show a hanging bent-knee leg raise. Hang with straight arms and knees bent at 90 degrees, raise the knees toward the chest without swinging, then lower under control.',
  '2333': 'Show a hanging straight-leg raise. Hang with straight arms and legs together, lift the straight legs until parallel with the floor, pause, then lower without swinging.',
  '3214': 'Show an arms-apart circular toe touch. From a wide arm position, hinge forward and reach one hand toward the toes while the opposite straight leg lifts behind, then return and switch sides.',
  '3204': 'Show an arms-overhead full sit-up on a mat. Keep the knees bent and feet flat, arms straight overhead, curl the torso all the way upright, then lower with control.',
  '0011': 'Show an assisted hanging knee raise on a pull-up station with a light band. Keep the palms facing away and arms straight, lift bent knees toward the chest, pause, then lower without swinging.',
  '0010': 'Show an assisted hanging knee raise with throw-down on a pull-up station and light band. Raise the knees to the chest, then actively throw the legs down straight before regaining control.',
  '1709': 'Show a lying glute stretch. Lie on the back, cross one ankle over the opposite thigh, gently draw the supporting thigh toward the chest, then switch sides.',
  '1710': 'Show a lying gluteus and piriformis stretch. Lie on the back, cross one ankle over the opposite thigh, gently draw the supporting thigh toward the chest, then switch sides.',
  '0012': 'Show an assisted lying leg raise with lateral throw-down. Lie flat with legs together and straight, hands under the glutes, lift both legs, lower them a few inches above the floor toward one side, return to center, and alternate sides without arching the back.',
  '0013': 'Show an assisted lying leg raise with throw-down. Lie flat with legs together and straight, hands under the glutes, raise the legs to near perpendicular, actively throw them down toward the floor without touching, then regain the raised position with control.',
  '0014': 'Show an assisted medicine-ball Russian twist. Sit with knees bent and feet flat, hold the medicine ball in front, lean back with a straight spine, rotate the torso to the right and left, and alternate while keeping the feet grounded.',
  '0015': 'Show an assisted parallel close-grip pull-up on a leverage machine. Use the narrow neutral-grip parallel handles with palms facing each other, stay supported by the assistance pad, pull the chin over the bars with elbows close, then lower to straight arms under control.',
  '0016': 'Show an assisted prone hamstring lift. Lie face down with legs extended and ankles secured by a resistance band or partner, keep the knees straight, lift the legs using the hamstrings, pause briefly, then lower them under control.',
  '1713': 'Show an assisted prone lying quadriceps stretch. Lie face down with both legs extended, bend one knee, reach the same-side hand to the ankle, gently draw the heel toward the glutes while keeping the hips down, hold, release, and repeat on the other side.',
  '1714': 'Show an assisted prone rectus femoris stretch. Lie face down with both legs straight, bend one knee, reach the same-side hand to the ankle, gently draw the foot toward the glutes while keeping the pelvis grounded, hold, release, and repeat on the other side.',
  '1716': 'Show an assisted seated pectoralis major stretch with a stability ball. Sit tall on a large stability ball with feet flat, hold a second stability ball with both arms extended, slowly lower it toward the chest for a gentle stretch, pause, then return it forward with control.',
  '1712': 'Show an assisted side-lying adductor stretch. Lie on one side with the bottom leg slightly bent and the top leg straight with its foot supported on a low bench, slowly lower the top leg toward the floor for an inner-thigh stretch, then switch sides.',
  '1758': 'Show an assisted sit-up. Lie on your back with knees bent and feet flat while a partner secures the feet, place hands behind the head, curl the torso to about 45 degrees without pulling the neck, pause, then lower slowly.',
  '1431': 'Show an assisted standing chin-up on a leverage machine. Stand on the foot platform, use the catalogue overhand grip slightly wider than shoulder width, keep the chest lifted and knees softly bent, drive the elbows down until the chin clears the bar, then lower under control.',
  '1432': 'Show an assisted standing pull-up on a leverage machine. Face the machine with feet shoulder width on the platform, use an overhand grip slightly wider than shoulder width, engage the lats and biceps to pull toward the handles, pause, then lower slowly.',
  '0018': 'Show an assisted standing triceps extension with a towel. Stand with feet shoulder width, hold a towel with both hands behind the head, keep the elbows close to the ears and upper arms still, extend the forearms overhead, pause, then lower the towel behind the head.',
  '0019': 'Show an assisted kneeling triceps dip on a leverage machine. Kneel on the assistance pad facing the machine, grip the parallel handles, keep the back straight and close, bend the elbows to lower, pause at the bottom, then press back up.',
  '2364': 'Show an assisted wide-grip chest dip on a leverage machine. Secure both knees on the assistance pad, grasp the handles with a clearly wide grip, lower until the upper arms are parallel to the floor with a slight forward chest lean, then press back up.',
})

const MUSCLE_GROUP_OVERRIDES = Object.freeze({
  '3666': { primary: ['Quads', 'Calves'], secondary: ['Hamstrings'] },
  '2138': { primary: ['Quads'], secondary: ['Hamstrings', 'Calves'] },
  '2141': { primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Calves'] },
  '2311': { primary: ['Quads', 'Glutes', 'Calves'], secondary: ['Hamstrings'] },
  '0630': { primary: ['Abs', 'Hip flexors'], secondary: ['Shoulders', 'Triceps', 'Quads'] },
  '0017': { primary: ['Lats'], secondary: ['Biceps', 'Forearms'] },
  '0594': { primary: ['Calves (soleus emphasis)'], secondary: [] },
  '0597': { primary: ['Hip abductors (gluteus medius, gluteus minimus, TFL)'], secondary: ['Hamstrings'] },
  '0868': { primary: ['Biceps'], secondary: ['Forearms'] },
  '0194': { primary: ['Triceps'], secondary: ['Shoulders'] },
  '0596': { primary: ['Chest'], secondary: ['Shoulders', 'Traps'] },
  '0602': { primary: ['Shoulders'], secondary: ['Traps', 'Upper back'] },
  '1350': { primary: ['Upper back'], secondary: ['Biceps', 'Forearms'] },
  '0748': { primary: ['Chest'], secondary: ['Triceps', 'Shoulders'] },
  '0757': { primary: ['Chest'], secondary: ['Shoulders', 'Triceps'] },
  '0774': { primary: ['Shoulders'], secondary: ['Triceps', 'Upper back'] },
  '1359': { primary: ['Upper back'], secondary: ['Biceps', 'Forearms'] },
  '0770': { primary: ['Glutes'], secondary: ['Quads', 'Hamstrings', 'Calves'] },
  '0198': { primary: ['Lats'], secondary: ['Biceps', 'Forearms'] },
  '0180': { primary: ['Upper back'], secondary: ['Biceps', 'Forearms'] },
  '0238': { primary: ['Lats'], secondary: ['Shoulders', 'Biceps'] },
  '0213': { primary: ['Lats'], secondary: ['Biceps', 'Rhomboids', 'Rear deltoids'] },
  '0245': { primary: ['Lats'], secondary: ['Biceps', 'Forearms'] },
  '0274': { primary: ['Abs'], secondary: ['Hip flexors'] },
  '0872': { primary: ['Abs'], secondary: ['Hip flexors'] },
  '0620': { primary: ['Abs', 'Hip flexors'], secondary: [] },
  '0705': { primary: ['Obliques', 'Abs'], secondary: ['Glutes'] },
  '0507': { primary: ['Abs', 'Hip flexors'], secondary: [] },
  '1373': { primary: ['Calves'], secondary: [] },
  '1387': { primary: ['Calves'], secondary: [] },
  '1490': { primary: ['Calves'], secondary: [] },
  '1397': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1377': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1000': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1253': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1368': { primary: ['Calves'], secondary: [] },
  '1369': { primary: ['Calves'], secondary: [] },
  '1370': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1371': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1372': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1374': { primary: ['Calves'], secondary: ['Quads', 'Hamstrings', 'Glutes'] },
  '1375': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1376': { primary: ['Calves'], secondary: [] },
  '1378': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1383': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1384': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1385': { primary: ['Calves'], secondary: ['Quads', 'Hamstrings', 'Glutes'] },
  '1386': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1379': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1380': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1381': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1382': { primary: ['Calves'], secondary: ['Hamstrings', 'Quads'] },
  '1388': { primary: ['Calves'], secondary: ['Ankles', 'Feet'] },
  '0088': { primary: ['Calves'], secondary: ['Hamstrings', 'Quads'] },
  '0108': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '0111': { primary: ['Calves'], secondary: ['Hamstrings', 'Quads'] },
  '0257': { primary: ['Calves'], secondary: ['Hamstrings', 'Quads'] },
  '0284': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '0400': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '0727': { primary: ['Calves'], secondary: ['Ankles', 'Feet'] },
  '0738': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '0742': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '0763': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '0773': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '0833': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '0999': { primary: ['Calves'], secondary: ['Ankles', 'Feet'] },
  '1389': { primary: ['Calves'], secondary: ['Hamstrings', 'Quads'] },
  '1390': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1391': { primary: ['Calves'], secondary: ['Hamstrings', 'Quads'] },
  '1392': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1393': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1395': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '2289': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1398': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1407': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1708': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '2315': { primary: ['Calves'], secondary: ['Soleus', 'Ankle stabilizers'] },
  '2334': { primary: ['Calves'], secondary: ['Hamstrings', 'Glutes'] },
  '1394': { primary: ['Calves'], secondary: ['Hamstrings'] },
  '1396': { primary: ['Calves'], secondary: ['Ankles', 'Shins'] },
  '2335': { primary: ['Calves'], secondary: ['Soleus', 'Hamstrings'] },
  '3240': { primary: ['Calves'], secondary: ['Quadriceps', 'Hamstrings'] },
  '3241': { primary: ['Calves'], secondary: ['Hamstrings', 'Quadriceps'] },
  '1582': { primary: ['Hamstrings'], secondary: ['Calves', 'Glutes'] },
  '1585': { primary: ['Hamstrings'], secondary: ['Calves', 'Quadriceps'] },
  '1599': { primary: ['Hamstrings'], secondary: ['Calves'] },
  '1548': { primary: ['Quadriceps'], secondary: ['Hamstrings', 'Calves'] },
  '3212': { primary: ['Glutes'], secondary: ['Hamstrings', 'Calves'] },
  '1410': { primary: ['Glutes'], secondary: ['Quadriceps', 'Hamstrings', 'Calves'] },
  '1417': { primary: ['Glutes'], secondary: ['Hamstrings', 'Calves'] },
  '1420': { primary: ['Glutes'], secondary: ['Quadriceps', 'Hamstrings', 'Calves'] },
  '1425': { primary: ['Glutes'], secondary: ['Quadriceps', 'Hamstrings', 'Calves'] },
  '1433': { primary: ['Glutes'], secondary: ['Quadriceps', 'Hamstrings', 'Calves', 'Core'] },
  '1434': { primary: ['Glutes'], secondary: ['Quadriceps', 'Hamstrings', 'Calves'] },
  '1435': { primary: ['Glutes'], secondary: ['Quadriceps', 'Hamstrings', 'Calves'] },
  '1436': { primary: ['Glutes'], secondary: ['Quadriceps', 'Hamstrings', 'Calves', 'Core'] },
  '1438': { primary: ['Shoulders'], secondary: ['Triceps', 'Upper back'] },
  '1439': { primary: ['Traps'], secondary: ['Shoulders', 'Forearms'] },
  '1441': { primary: ['Forearms'], secondary: ['Biceps'] },
  '1451': { primary: ['Triceps'], secondary: ['Chest', 'Shoulders'] },
  '1452': { primary: ['Abs'], secondary: ['Obliques'] },
  '1456': { primary: ['Shoulders'], secondary: ['Triceps', 'Upper back'] },
  '1457': { primary: ['Shoulders'], secondary: ['Triceps', 'Upper back'] },
  '0001': { primary: ['Abs'], secondary: ['Obliques', 'Hip flexors'] },
  '0002': { primary: ['Obliques'], secondary: [] },
  '1512': { primary: ['Hamstrings'], secondary: ['Glutes', 'Calves'] },
  '0006': { primary: ['Obliques'], secondary: [] },
  '0007': { primary: ['Lats'], secondary: ['Biceps'] },
  '3293': { primary: ['Lats'], secondary: ['Biceps', 'Forearms'] },
  '3294': { primary: ['Chest'], secondary: ['Triceps', 'Shoulders'] },
  '2355': { primary: ['Abs'], secondary: ['Hip flexors', 'Shoulders'] },
  '2333': { primary: ['Abs'], secondary: ['Hip flexors', 'Shoulders'] },
  '3214': { primary: ['Glutes'], secondary: ['Hamstrings', 'Quadriceps', 'Calves'] },
  '3204': { primary: ['Abs'], secondary: ['Hip flexors', 'Obliques'] },
  '0011': { primary: ['Abs'], secondary: ['Hip flexors', 'Shoulders'] },
  '0010': { primary: ['Abs'], secondary: ['Hip flexors', 'Shoulders'] },
  '1709': { primary: ['Glutes'], secondary: ['Hamstrings'] },
  '1710': { primary: ['Glutes'], secondary: ['Hamstrings'] },
  '0012': { primary: ['Abs', 'Hip flexors'], secondary: ['Obliques'] },
  '0013': { primary: ['Abs', 'Hip flexors'], secondary: ['Obliques'] },
  '0014': { primary: ['Obliques'], secondary: ['Abs'] },
  '0015': { primary: ['Lats'], secondary: ['Biceps', 'Forearms'] },
  '0016': { primary: ['Hamstrings'], secondary: ['Glutes'] },
  '1713': { primary: ['Quads'], secondary: ['Hamstrings', 'Glutes'] },
  '1714': { primary: ['Quads'], secondary: ['Hip flexors'] },
  '1716': { primary: ['Chest'], secondary: ['Shoulders', 'Triceps'] },
  '1712': { primary: ['Adductors'], secondary: ['Hamstrings', 'Glutes'] },
  '1758': { primary: ['Abs'], secondary: ['Hip flexors'] },
  '1431': { primary: ['Lats'], secondary: ['Biceps', 'Forearms'] },
  '1432': { primary: ['Lats'], secondary: ['Biceps', 'Forearms'] },
  '0018': { primary: ['Triceps'], secondary: ['Shoulders'] },
  '0019': { primary: ['Triceps'], secondary: ['Chest', 'Shoulders'] },
  '2364': { primary: ['Chest'], secondary: ['Triceps', 'Shoulders'] },
})

function exerciseFor(id) {
  if (!approved.has(id) || !EXIDX[id]) throw new Error(`Unknown exercise id: ${id}`)
  return EXIDX[id]
}

function movementInstructions(ex) {
  return correctExerciseInstructions(ex.id, ex.st || [])
    .map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function muscleGroups(ex) {
  if (MUSCLE_GROUP_OVERRIDES[ex.id]) return MUSCLE_GROUP_OVERRIDES[ex.id]
  const entries = Object.entries(musclesOf(ex))
  const names = rows => rows.map(([slug]) => MUSCLE_NAME[slug] || slug)
  return {
    primary: names(entries.filter(([, weight]) => weight >= 0.75)),
    secondary: names(entries.filter(([, weight]) => weight > 0 && weight < 0.75)),
  }
}

function techniquePrompt(ex) {
  const accuracy = TECHNIQUE_ACCURACY[ex.id] || 'Follow the supplied exercise instructions exactly.'
  return `Use case: scientific-educational
Asset type: landscape technique image for a dark fitness workout app
Primary request: Create a clear three-panel photorealistic demonstration of ${ex.n}.
Equipment: ${ex.eq || 'body weight'}.
Existing exercise instructions:
${movementInstructions(ex)}
Exercise-specific accuracy: ${accuracy}
Subject: the same real adult male athlete in every panel, realistic non-exaggerated physique, neutral charcoal training clothes that do not hide joint position.
Scene/backdrop: the correct gym setup and equipment on a clean matte near-black background (#0b0e0c).
Composition/framing: one 3:2 landscape image divided into three equal panels. Panel 1 shows the stable starting position. Panel 2 shows the most informative loaded, lowered, or peak-contraction position described by the instructions. Panel 3 shows the controlled completed repetition. Keep camera angle, person, equipment, scale, and direction identical across panels.
Style/medium: polished photorealistic sports photography with high anatomical and equipment clarity.
Lighting/mood: soft neutral studio lighting, crisp silhouette, no dramatic shadows.
Constraints: scientifically plausible joint alignment, grip, stance, range of motion, and equipment path; full relevant body and equipment remain visible; no unsafe invented motion.
Avoid: extra limbs or fingers, merged or bent equipment, inconsistent bar plates, different person between panels, extreme bodybuilding proportions, gore, or exposed anatomy; no text, labels, logos, or watermark.`
}

function musclesPrompt(ex) {
  const groups = muscleGroups(ex)
  return `Use case: scientific-educational
Asset type: landscape target-muscle image for a dark fitness workout app
Primary request: Show the muscles trained by ${ex.n} on a realistic adult male athlete.
Primary muscles: ${list(groups.primary)}.
Secondary muscles: ${list(groups.secondary)}.
Subject: the same real adult male athlete twice in a relaxed neutral anatomical pose, front view on the left and back view on the right, framed from head to feet so lower-leg targets remain visible. He is fully clothed in an opaque fitted charcoal short-sleeve athletic top and full-length training tights; no bare torso or underwear-like clothing.
Scene/backdrop: clean matte near-black background (#0b0e0c), no floor or equipment.
Style/medium: photorealistic sports photography with a clean scientific fitness overlay; clearly a real human, not a mannequin.
Composition/framing: two equal figures with generous separation and consistent scale.
Color palette: subdued natural body tones and charcoal clothing. Apply the muscle overlay visibly over the clothing: highlight primary muscles in vivid emerald green with a precise semi-transparent anatomical shape, and secondary muscles in a clearly softer, darker green. Leave every other region neutral.
Constraints: anatomically plausible, symmetric highlights, muscle placement consistent with the named groups, clean edges, no exposed tissue or internal anatomy.
Avoid: highlighted unrelated muscles, extra limbs, different people between views, bodybuilding exaggeration, text, labels, arrows, numbers, logos, borders, checkerboard, or watermark.`
}

export function promptFor(id, kind) {
  const ex = exerciseFor(id)
  if (kind === 'technique') return techniquePrompt(ex)
  if (kind === 'muscles') return musclesPrompt(ex)
  throw new Error(`Unknown visual kind: ${kind}`)
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invoked) {
  const [id, kind] = process.argv.slice(2)
  try {
    process.stdout.write(promptFor(id, kind) + '\n')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
