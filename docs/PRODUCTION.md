# Production runbook: `gym.innu.ru`

Этот документ описывает целевое развёртывание форка «Мой зал» на VPS
`155.212.190.173`. Публичный трафик принимает host nginx, Docker-порт web
доступен только на `127.0.0.1`, а API доступен только через web-контейнер.

## 1. Обязательные gates

До публичного запуска должны одновременно выполняться условия:

- репозиторий `https://github.com/arvids-unavailable/my-gym` доступен вместе с
  исходным кодом AGPL-форка;
- DNS `A gym.innu.ru` указывает на `155.212.190.173`; `AAAA` не создаётся, пока
  на VPS нет проверенного IPv6;
- сертификат выпущен именно для `gym.innu.ru`;
- `RP_ID=gym.innu.ru`, `ORIGIN=https://gym.innu.ru`, guest mode выключен;
- секреты находятся только в server-side `.env` с правами `0600`;
- создана и проверена первая резервная копия `data/`;
- браузерная регистрация/login passkey, реальный AI-вызов и реальная Android
  синхронизация проверены на production URL.

Локальные тесты не заменяют эти проверки.

## 2. DNS и базовая подготовка VPS

В панели Beget создать запись:

| Тип | Имя | Значение |
| --- | --- | --- |
| `A` | `gym` | `155.212.190.173` |

Проверить распространение с независимого резолвера:

```bash
dig +short A gym.innu.ru @1.1.1.1
dig +short AAAA gym.innu.ru @1.1.1.1
```

Первая команда должна вернуть `155.212.190.173`, вторая — пустой результат,
если IPv6 не настраивался. На firewall оставить публичными только SSH, `80/tcp`
и `443/tcp`; порт `8080` наружу не открывать.

Рекомендуемый каталог:

```bash
sudo install -d -m 0750 -o "$USER" -g "$USER" /opt/my-gym
git clone https://github.com/arvids-unavailable/my-gym /opt/my-gym
cd /opt/my-gym
cp .env.example .env
chmod 600 .env
```

## 3. Production `.env` и секреты

Минимальная конфигурация:

```dotenv
RP_ID=gym.innu.ru
ORIGIN=https://gym.innu.ru
RP_NAME=Мой зал
WEB_PORT=8080
NGINX_PORT=80
BACKEND=api
PORT=3000

ADMIN_UIDS=
INVITE_ONLY=1
ALLOW_GUEST=0
SESSION_DAYS=90

OPENAI_BASE_URL=https://147.45.248.214/v1
OPENAI_API_KEY=
OPENAI_NUTRITION_MODEL_PRIMARY=gpt-5.6-luna
OPENAI_NUTRITION_MODEL_FALLBACK=gpt-5.6-terra
FDC_API_KEY=
OPEN_FOOD_FACTS_USER_AGENT=MyGym/1.0 (mailto:operator@example.com)
NUTRITION_PHOTO_DAILY_LIMIT=20
NUTRITION_REVIEW_DAILY_LIMIT=1

AUDIT_LOG=1
AUDIT_MAX=5000
AUDIT_DAYS=90
AUDIT_IP=off
VAPID_SUBJECT=mailto:operator@example.com
```

`OPENAI_BASE_URL` и имена моделей — несекретные server-side настройки.
`OPENAI_API_KEY` — server-side secret: записывать его только в принадлежащий
`root` production-файл `.env` с режимом `0600`; не помещать в Git,
frontend-переменные, аргументы команд, логи, issue, чат или CI. Перед релизом
выполнить аутентифицированный `GET /v1/models`. Использовать `gpt-5.6-terra`
как fallback только если endpoint вернул эту модель; иначе установить
`OPENAI_NUTRITION_MODEL_FALLBACK=gpt-5.6-luna`.

Совместимый proxy может публиковать в `/v1/models` только transcription-модели,
хотя `gpt-5.6-luna` доступна в `/v1/responses`. В этом случае перед релизом
выполнить минимальный запрос с `input` в форме массива и подтвердить `HTTP 200`,
SSE-событие `response.completed`, `status=completed` и
`model=gpt-5.6-luna`. Не считать Terra доступной без отдельного успешного
probe. Provider поддерживает как обычный JSON, так и полный объект ответа из
SSE `response.completed`; текстовые delta-события отдельно не исполняются.

Заполнить `OPENAI_API_KEY` и `FDC_API_KEY` непосредственно на VPS. API
ограничивает фото до `1..100`, review до `1..10` на пользователя за UTC-сутки;
внешний OpenAI project budget остаётся обязательным вторым пределом.

Файлы `data/secret` и `data/vapid.json` генерируются приложением. Их нельзя
пересоздавать при обычном релизе: потеря `secret` завершит все сессии, потеря
VAPID private key сломает существующие push-подписки. Весь `data/` считается
чувствительным, потому что содержит passkey public credentials, тренировки,
питание и health summaries.

## 4. Сборка и локальный Docker preflight

На проверенном commit:

```bash
node --test test/release-contracts.test.mjs

(cd api && npm ci && npm test)
(cd frontend && npm ci && npm test && npm run build)
(cd frontend && node scripts/check-locales.mjs)
(cd frontend && node scripts/check-source-strings.mjs --strict)
(cd android-sync && sh ./gradlew --no-daemon testDebugUnitTest assembleDebug)

docker compose config --quiet
docker compose build --pull
```

Затем на VPS:

```bash
cd /opt/my-gym
docker compose up -d
docker compose ps
curl --fail --silent --show-error http://127.0.0.1:8080/api/health
```

`docker-compose.yml` публикует web как `127.0.0.1:8080`; результат обязательно
проверить через `ss -ltnp`. API-порт `3000` на host не публикуется.

## 5. Host nginx и TLS

Для ACME webroot сначала создать каталог и HTTP server:

```bash
sudo install -d -m 0755 /var/www/letsencrypt
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name gym.innu.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

После `sudo nginx -t && sudo systemctl reload nginx` выпустить сертификат:

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt -d gym.innu.ru
```

Добавить TLS server (пути сертификата сверить с выводом certbot):

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name gym.innu.ru;

    ssl_certificate /etc/letsencrypt/live/gym.innu.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gym.innu.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 65s;
    }
}
```

Не добавлять HSTS до подтверждения DNS, TLS renewal и полного отсутствия других
HTTP-only сервисов в зоне. После каждого изменения: `nginx -t`, reload, затем
проверка реального ответа и security headers с внешнего клиента.

## 6. Первый администратор без открытого окна регистрации

Перед первой регистрацией временно ограничить TLS `location /` своим точным
публичным IP:

```nginx
allow 203.0.113.10;
deny all;
```

Заменить пример на фактический IP, проверить ограничение извне, затем временно
поставить `INVITE_ONLY=0`, пересоздать только API и зарегистрировать первый
passkey-профиль через `https://gym.innu.ru`:

```bash
docker compose up -d --force-recreate api
jq -r '.users[] | [.name, .id] | @tsv' data/db.json
```

Записать нужный id в `ADMIN_UIDS`, вернуть `INVITE_ONLY=1`, убедиться, что
`ALLOW_GUEST=0`, снова пересоздать API. Проверить создание invite в admin UI и
только после этого удалить временные `allow/deny` из nginx. Сам invite и pairing
codes не записывать в командную историю или документацию.

## 7. Проверка production

```bash
curl --fail --silent --show-error https://gym.innu.ru/api/health
curl --fail --silent --show-error -I https://gym.innu.ru/
```

В реальном браузере проверить:

1. регистрацию по invite, logout и повторный passkey login;
2. отсутствие guest-входа и недоступность чужих данных;
3. создание ручного meal и подтверждение AI-оценки реального фото;
4. один daily review и корректный `429` после достижения настроенной квоты;
5. заголовки CSP, `nosniff`, frame protection и отсутствие API-ответов в Cache Storage;
6. перезапуск контейнеров без потери workout JSON, `mygym.sqlite`, session и push keys.

Функции питания и здоровья предназначены только для взрослых и не являются
медицинской диагностикой или назначением лечения.

## 8. Android companion и Samsung Health

Samsung Health должен передавать разрешённые пользователем данные в Health
Connect. Companion читает только заявленные summary-типы, не читает GPS и не
работает в фоне. Первый sync запрашивает до 30 дней истории, последующие —
короткое перекрывающееся окно.

Проверочная сборка:

```bash
cd /opt/my-gym/android-sync
sh ./gradlew --no-daemon testDebugUnitTest assembleDebug
sha256sum app/build/outputs/apk/debug/app-debug.apk
```

Debug APK пригоден только для контролируемого sideload-теста. Публичный release
APK нужно подписывать отдельным release keystore, который хранится вне Git,
backup-архивов приложения и CI logs.

Привязка пользователя:

1. пользователь входит на `gym.innu.ru` и в Settings создаёт одноразовый code;
2. вводит code в companion `ru.innu.mygym.sync` в течение срока действия;
3. подтверждает только нужные разрешения Health Connect;
4. нажимает Sync и проверяет время синхронизации и показатели в web;
5. при потере телефона отзывает устройство из web Settings.

## 9. Backup, retention и проверка восстановления

[backup-data.sh](../ops/backup-data.sh) кратко останавливает только API, снимает
единый tar snapshot всего `data/`, сразу возвращает API и только затем сжимает
архив. Создаётся SHA-256 sidecar; удаляются исключительно архивы этого скрипта
старше 30 дней. Rootful API создаёт `secret`, `vapid.json` и другие файлы от
`root` с правами `0600`, поэтому production backup и restore всегда запускаются
через `sudo`; скрипты намеренно отклоняют непривилегированный запуск.

```bash
sudo install -d -m 0700 -o root -g root /var/backups/my-gym
sudo env MY_GYM_BACKUP_DIR=/var/backups/my-gym \
  BACKUP_RETENTION_DAYS=30 \
  MY_GYM_PROJECT_DIR=/opt/my-gym \
  sh /opt/my-gym/ops/backup-data.sh

sudo sh -c 'cd /var/backups/my-gym && sha256sum -c my-gym-data-YYYYMMDDTHHMMSSZ.tar.gz.sha256'
```

Для root cron сначала создать закрытый log, затем открыть именно root crontab:

```bash
sudo install -m 0600 -o root -g root /dev/null /var/log/my-gym-backup.log
sudo crontab -e
```

Запись, например ежедневно в 03:20 UTC:

```cron
20 3 * * * MY_GYM_PROJECT_DIR=/opt/my-gym MY_GYM_BACKUP_DIR=/var/backups/my-gym BACKUP_RETENTION_DAYS=30 /bin/sh /opt/my-gym/ops/backup-data.sh >>/var/log/my-gym-backup.log 2>&1
```

Хранить хотя бы одну зашифрованную копию вне VPS. Перед production restore
положить выбранный архив и его `.sha256` непосредственно в закрытый backup-каталог.
[restore-data.sh](../ops/restore-data.sh) сверяет точный checksum/filename,
отклоняет ссылки, специальные файлы, дубликаты и выход из ожидаемого data root,
распаковывает snapshot в staging на том же filesystem и проверяет обязательные
`db.json`, `secret`, `vapid.json`, `mygym.sqlite`. До остановки API validator
проверяет `db.json` JSON/schema, 256-bit session secret, matching URL-safe VAPID keys,
SQLite `integrity_check`, foreign keys and application schema. Он запускается
одноразово из уже собранного API Docker image с read-only mount staging-каталога;
host Node и `sqlite3` не требуются.

Production restore намеренно принимает только established snapshot: в `db.json`
должны быть хотя бы один пользователь и соответствующий passkey credential.
Пустая новая инсталляция не содержит пользовательских данных, которые нужно
восстанавливать, и создаётся обычным запуском приложения. После валидации скрипт
останавливает API, заменяет весь `data/`, выставляет root ownership и закрытые
права. Запущенный API должен вернуть expected non-zero user count в
`/api/health`; простого статуса `200` недостаточно. Каталог `previous-data`
сохраняется до этого data-aware smoke. При несовпадении данных или неуспешном
старте прежний каталог автоматически возвращается и также проверяется
health-check.

Для восстановления выбрать один точный архив (не glob) и выполнить:

```bash
sudo env MY_GYM_PROJECT_DIR=/opt/my-gym \
  MY_GYM_DATA_DIR=/opt/my-gym/data \
  MY_GYM_EXPECTED_DATA_DIR=/opt/my-gym/data \
  MY_GYM_BACKUP_DIR=/var/backups/my-gym \
  sh /opt/my-gym/ops/restore-data.sh \
  /var/backups/my-gym/my-gym-data-YYYYMMDDTHHMMSSZ.tar.gz
```

После сообщения `restore complete and API data verified` повторить проверки раздела 7.
Автоматический rollback покрывает неуспешный запуск и data-aware health-check; поэтому
до восстановления сохранить отдельную копию текущего `data/`, если он ещё читаем.

## 10. Релиз и rollback

Перед релизом записать текущий commit и создать backup:

```bash
cd /opt/my-gym
git rev-parse HEAD
sudo env MY_GYM_BACKUP_DIR=/var/backups/my-gym MY_GYM_PROJECT_DIR=/opt/my-gym sh /opt/my-gym/ops/backup-data.sh
git fetch --tags origin
git checkout <verified-release-tag-or-commit>
docker compose build
docker compose up -d
```

После обновления повторить production-проверки из раздела 7. Если приложение не
проходит smoke-check, вернуться на записанный проверенный commit обычным
`git checkout`, пересобрать оба scoped image и снова выполнить smoke-check. При
несовместимой миграции сначала остановить API и восстановить проверенный backup;
не смешивать новый SQLite snapshot со старыми JSON/secret файлами.

Старый репозиторий или deployment архивировать только после подтверждения DNS,
HTTPS, passkey, реального AI-вызова, Android sync, backup и rollback на новом
production.
