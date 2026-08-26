import { useCallback, useEffect, useState } from 'react'
import { dateLocale, t } from '../lib/i18n.js'
import { healthDevicesApi } from '../lib/health-devices-api.js'
import { Button, Row, Section } from './ui.jsx'

export function canShowHealthPairing({ user, demo, mobile }) {
  return !!user && !demo && !mobile
}

function formatDateTime(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return t('Unavailable')
  return date.toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' })
}

function displayCode(value) {
  return String(value || '').replace(/^(....)(....)$/, '$1 $2')
}

export function HealthPairingCard({ client = healthDevicesApi, confirm }) {
  const [devices, setDevices] = useState([])
  const [pairing, setPairing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState(null)
  const [error, setError] = useState('')

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await client.listDevices()
      setDevices(Array.isArray(result?.devices) ? result.devices : [])
    } catch (err) {
      setError(err?.message || t('Could not load paired devices'))
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => { loadDevices() }, [loadDevices])

  const createCode = async () => {
    setBusy(true)
    setError('')
    try {
      setPairing(await client.createPairingCode())
    } catch (err) {
      setError(err?.message || t('Could not create pairing code'))
    } finally {
      setBusy(false)
    }
  }

  const requestRevoke = device => confirm?.({
    title: t('Revoke health device?'),
    message: t('The companion on {0} will stop syncing until it is paired again.', device.deviceName || t('this device')),
    confirmText: t('Revoke'),
    danger: true,
    onConfirm: async () => {
      setRevoking(device.id)
      setError('')
      try {
        await client.revokeDevice(device.id)
        await loadDevices()
      } catch (err) {
        setError(err?.message || t('Could not revoke device'))
      } finally {
        setRevoking(null)
      }
    },
  })

  return (
    <Section
      title={t('Samsung Health sync')}
      footer={t('The companion only reads the health data you approve. It does not write to Samsung Health or Health Connect.')}
    >
      <Row
        icon="heart"
        iconTint="var(--pink)"
        title={t('Samsung Health → Health Connect')}
        subtitle={t('On your Samsung phone, allow sharing in Health Connect, then open the My Gym Sync companion.')}
      />
      <Row
        icon="link"
        iconTint="var(--acc)"
        title={busy ? t('Creating pairing code…') : t('Create pairing code')}
        subtitle={t('Enter the code in the Android companion. Each code works once and expires after 10 minutes.')}
        accessory="chevron"
        onClick={busy ? undefined : createCode}
      />
      {pairing?.code && pairing?.expiresAt && (
        <Row
          icon="key"
          iconTint="var(--indigo)"
          title={<strong style={{ fontSize: 24, letterSpacing: '.12em' }}>{displayCode(pairing.code)}</strong>}
          subtitle={<span>{t('Expires')}: <time dateTime={pairing.expiresAt}>{formatDateTime(pairing.expiresAt)}</time></span>}
          className="health-pairing-code"
        />
      )}
      <Row
        icon="reset"
        iconTint="var(--blue)"
        title={loading ? t('Loading paired devices…') : t('Refresh devices')}
        accessory="chevron"
        onClick={loading ? undefined : loadDevices}
      />
      {!loading && devices.length === 0 && (
        <Row icon="shield" iconTint="var(--grey)" title={t('No paired devices')} />
      )}
      {devices.map(device => (
        <Row
          key={device.id}
          icon={device.active ? 'checkCircle' : 'shield'}
          iconTint={device.active ? 'var(--teal)' : 'var(--grey)'}
          title={device.deviceName || t('Android device')}
          subtitle={device.lastSyncAt
            ? <span>{t('Last synced')}: <time dateTime={device.lastSyncAt}>{formatDateTime(device.lastSyncAt)}</time></span>
            : t('Not synced yet')}
          value={device.active ? t('Active') : t('Revoked')}
        >
          {device.active && (
            <Button variant="danger" size="sm" disabled={revoking === device.id} onClick={() => requestRevoke(device)}>
              {revoking === device.id ? t('Revoking…') : t('Revoke')}
            </Button>
          )}
        </Row>
      ))}
      {error && <div role="alert" className="sect-f" style={{ padding: '11px 14px', color: 'var(--red)' }}>{error}</div>}
    </Section>
  )
}

export default HealthPairingCard
