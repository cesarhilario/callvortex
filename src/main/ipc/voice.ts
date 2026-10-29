import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { IPC, type FirewallFixResult } from '../../shared/ipc'
import { isTrustedSender } from '../security'

const execFileAsync = promisify(execFile)

async function fixWindowsFirewall(): Promise<FirewallFixResult> {
  const exe = process.execPath.replace(/'/g, "''")
  const inner = [
    `netsh advfirewall firewall delete rule name='CallVortex' >$null 2>&1`,
    `netsh advfirewall firewall add rule name='CallVortex' dir=in action=allow program='${exe}' enable=yes profile=any`,
    `netsh advfirewall firewall add rule name='CallVortex' dir=out action=allow program='${exe}' enable=yes profile=any`
  ].join('; ')
  const inner64 = Buffer.from(inner, 'utf16le').toString('base64')
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile', '-WindowStyle', 'Hidden', '-Command',
      `try { Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${inner64}' } catch { exit 1223 }`
    ], { timeout: 120_000 })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? ''
    if (code.includes('1223')) {
      return { ok: false, message: 'Você cancelou a confirmação do Windows. Sem ela, não dá para liberar o áudio.' }
    }
    return { ok: false, message: 'Não foi possível abrir a confirmação do Windows. Libere manualmente pelo painel do Firewall.' }
  }
  try {
    const { stdout } = await execFileAsync('netsh.exe',
      ['advfirewall', 'firewall', 'show', 'rule', 'name=CallVortex'], { timeout: 15_000 })
    if (/CallVortex/i.test(stdout)) {
      return { ok: true, message: 'Firewall liberado! Saia da sala e volte para reconectar com áudio.' }
    }
  } catch { }
  return { ok: true, message: 'Regras aplicadas. Saia da sala e volte para reconectar.' }
}

export function registerVoiceIpc(): void {
  ipcMain.handle(IPC.voiceFixFirewall, async (e): Promise<FirewallFixResult> => {
    if (!isTrustedSender(e)) return { ok: false, message: 'Origem não confiável.' }
    if (process.platform !== 'win32') {
      return { ok: false, message: 'Esta correção é específica do Windows.' }
    }
    return fixWindowsFirewall()
  })
}
