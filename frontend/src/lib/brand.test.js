import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')

describe('My Gym product identity', () => {
  it('uses the Russian product name in install and login surfaces', () => {
    const index = read('../../index.html')
    const manifest = JSON.parse(read('../../public/manifest.json'))
    const capacitor = JSON.parse(read('../../capacitor.config.json'))
    const login = read('../views/Login.jsx')

    expect(index).toContain('<title>Мой зал</title>')
    expect(index).toContain('content="Мой зал"')
    expect(manifest.name).toBe('Мой зал')
    expect(manifest.short_name).toBe('Мой зал')
    expect(capacitor.appName).toBe('Мой зал')
    expect(login).toContain('>Мой зал</h1>')
  })

  it('defaults new profiles to Russian and links the custom source', () => {
    const store = read('../store/useStore.js')
    const settings = read('../views/Settings.jsx')
    const demo = read('./demo.js')
    const russian = read('../locales/ru.js')

    expect(store).toMatch(/lang:\s*'ru'/)
    expect(settings).toContain('Мой зал ·')
    expect(settings).toContain('https://github.com/arvids-unavailable/my-gym')
    expect(demo).toContain("https://github.com/arvids-unavailable/my-gym")
    expect(russian).toContain("'Перезагрузить Мой зал'")
    expect(russian).toContain("'Сделано в приложении «Мой зал»'")
  })

  it('uses My Gym on user-visible web, export, and native-shell surfaces while retaining format ids', () => {
    const home = read('../views/Home.jsx')
    const login = read('../views/Login.jsx')
    const settings = read('../views/Settings.jsx')
    const errorBoundary = read('../components/ErrorBoundary.jsx')
    const sheets = read('../sheets.jsx')
    const planShare = read('./plan-share.js')
    const androidStrings = read('../../android/app/src/main/res/values/strings.xml')
    const iosInfo = read('../../ios/App/App/Info.plist')

    expect(home).toContain("t('My Gym')")
    expect(login).toContain('My Gym server')
    expect(login).toContain('use My Gym locally')
    expect(settings).toContain("t('Self-host My Gym')")
    expect(settings).toContain('install My Gym as a full-screen app')
    expect(settings).toContain('even if My Gym is closed')
    expect(errorBoundary).toContain("t('Reload My Gym')")
    expect(sheets).toContain('their own My Gym')
    expect(planShare).toContain('<div class="kicker">My Gym</div>')
    expect(planShare).toContain("t('Made with My Gym')")
    expect(planShare).toContain('gym.innu.ru</footer>')
    expect(androidStrings).toContain('<string name="app_name">Мой зал</string>')
    expect(iosInfo).toContain('<string>Мой зал</string>')

    expect(settings).toContain("'opengym-backup-'")
    expect(sheets).toContain("'opengym-plan-'")
    expect(planShare).toContain('opengym_plan')
  })
})
