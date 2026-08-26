# Мой зал — Android Health Connect companion

Отдельное Android-приложение `ru.innu.mygym.sync`. Оно не заменяет PWA и не меняет
`frontend/android`: Samsung Health синхронизирует часы с Health Connect, а companion
передаёт на `gym.innu.ru` только нормализованные дневные итоги и тренировки.

## Сборка

Требования: Android Studio Quail 2/3 или новее, JDK 17, Android SDK 37 и Gradle 9.5+.
В текущем checkout wrapper не дублируется: его можно создать один раз командой
`gradle wrapper --gradle-version 9.5.0`, затем запускать:

```powershell
./gradlew.bat :app:testDebugUnitTest :app:assembleDebug
./gradlew.bat :app:connectedDebugAndroidTest
```

Production URL по умолчанию — `https://gym.innu.ru`. Для отдельного HTTPS-стенда:

```powershell
./gradlew.bat :app:assembleDebug -PMY_GYM_BASE_URL=https://gym-stage.example.ru
```

HTTP намеренно запрещён manifest-настройкой и runtime-проверкой. Release APK нужно
подписать семейным signing key, который хранится и резервируется вне репозитория.

## Пользовательский поток

1. В PWA пользователь создаёт одноразовый код из 8 символов (срок 10 минут).
2. Companion обменивает код на scoped device token и шифрует credentials ключом из
   Android Keystore (AES-GCM); backup приложения отключён.
3. Пользователь явно выбирает read-only разрешения Health Connect.
4. При первом запуске импортируются доступные 30 дней, затем при открытии и по кнопке
   пересчитываются сегодня и два предыдущих дня.
5. «Отвязать» сначала отзывает device token на сервере, затем удаляет локальный токен,
   состояние синхронизации и разрешения Health Connect.

Фоновой задачи и background permission нет. Не запрашиваются GPS/маршруты, ЭКГ,
давление, медицинские записи или write-разрешения. Сырые samples пульса/SpO2 не
передаются: Health Connect агрегирует пульс, а отдельные SpO2 измерения усредняются
локально и удаляются из памяти после формирования batch.

## Wire contract

- `POST /api/health/devices/pair` без авторизации:
  `{code, deviceName, platform:"android", appVersion}` → `{deviceId, token}`.
- `POST /api/health/sync` с `Authorization: Bearer <device-token>`,
  `Idempotency-Key: <batchId>` и `X-Content-SHA256: <digest>`:
  `{batchId,digest,timezone,daily,workouts,tombstones}`. `batchId` детерминированно
  выводится из SHA-256 канонического нормализованного payload, поэтому retry идемпотентен.
- `GET /api/health/devices/{deviceId}` → `{active,lastSyncAt}`.
- `DELETE /api/health/devices/{deviceId}` отзывает scoped token.

Ответы ошибок и tokens не логируются. Сервер обязан получать `user_id` только из
pairing context/device token и проверять совпадение заголовков идемпотентности с body.

## Проверки

JVM-тесты фиксируют нормализацию pairing code, маппинг агрегатов, 30/3-дневные окна и
стабильный digest/batch ID. Instrumented tests проверяют отсутствие write/background/
location permissions и удаление Keystore credentials при revoke.

Интеграция использует стабильный `androidx.health.connect:connect-client:1.1.0` и
официальную модель разрешений Health Connect:

- https://developer.android.com/health-and-fitness/health-connect/get-started
- https://developer.android.com/health-and-fitness/health-connect/ui/permissions
