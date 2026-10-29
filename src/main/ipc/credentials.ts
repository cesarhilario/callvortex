import { app, ipcMain, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, writeFile, rm } from 'fs/promises'
import { IPC, type SavedCredentials } from '../../shared/ipc'
import { isTrustedSender } from '../security'
import { takePendingDeepLink } from '../deepLink'

// ---------------------------------------------------------------------------
// Credenciais lembradas ("Lembrar de mim")
// Salvas criptografadas com safeStorage (DPAPI no Windows / Keychain no macOS)
// em um arquivo dentro da pasta de dados do app — nunca em texto puro.
// ---------------------------------------------------------------------------
const MAX_FIELD_LEN = 512

const credentialsFile = (): string => join(app.getPath('userData'), 'credentials.json')

/**
 * No Linux sem keyring o safeStorage cai em `basic_text` (chave fixa, na
 * prática texto puro). Nesse caso preferimos NÃO lembrar a sessão.
 */
function canEncryptSecurely(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  if (process.platform === 'linux') {
    return safeStorage.getSelectedStorageBackend() !== 'basic_text'
  }
  return true
}

function parseCredentials(value: unknown): SavedCredentials | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.email !== 'string' || typeof v.refreshToken !== 'string') return null
  const username = typeof v.username === 'string' ? v.username : ''
  if (!v.email || !v.refreshToken) return null
  if (v.email.length > MAX_FIELD_LEN || v.refreshToken.length > MAX_FIELD_LEN || username.length > MAX_FIELD_LEN) {
    return null
  }
  return { email: v.email, refreshToken: v.refreshToken, username }
}

async function saveCredentials(raw: unknown): Promise<boolean> {
  try {
    const creds = parseCredentials(raw)
    if (!creds || !canEncryptSecurely()) return false
    await writeFile(credentialsFile(), safeStorage.encryptString(JSON.stringify(creds)))
    return true
  } catch {
    return false
  }
}

async function loadCredentials(): Promise<SavedCredentials | null> {
  try {
    const file = await readFile(credentialsFile())
    if (!canEncryptSecurely()) return null
    return parseCredentials(JSON.parse(safeStorage.decryptString(file)))
  } catch {
    return null
  }
}

export function registerCredentialsIpc(): void {
  ipcMain.handle(IPC.credentialsSave, (e, creds: unknown) => {
    if (!isTrustedSender(e)) return false
    return saveCredentials(creds)
  })
  ipcMain.handle(IPC.credentialsLoad, (e) => {
    if (!isTrustedSender(e)) return null
    return loadCredentials()
  })
  ipcMain.handle(IPC.credentialsClear, async (e) => {
    if (!isTrustedSender(e)) return false
    try {
      await rm(credentialsFile(), { force: true })
      return true
    } catch {
      return false
    }
  })
  // Entrega (e limpa) uma URL de deep-link pendente do primeiro lançamento.
  // O renderer chama isto ao montar para não perder o link caso o evento
  // 'auth:deep-link' tenha sido enviado antes do listener ser registrado.
  ipcMain.handle(IPC.authTakePendingDeepLink, (e): string | null => {
    if (!isTrustedSender(e)) return null
    return takePendingDeepLink()
  })
}
