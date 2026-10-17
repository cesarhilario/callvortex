/**
 * Captura de tela (somente captura — sem Supabase, sem React).
 *
 * A lista de fontes vem do processo principal via IPC específico
 * (`window.api.screenShare.getSources`); a captura em si é feita aqui no
 * renderer com getUserMedia usando a fonte escolhida explicitamente
 * pelo usuário. Nada é gravado nem enviado a servidor algum.
 */
import type { ScreenSourceInfo } from './types'

/**
 * Fonte sentinela usada no Wayland: não há lista de fontes (o portal do
 * sistema escolhe) — o handler do processo principal entrega uma fonte
 * sintética e o Chromium abre o portal uma única vez.
 */
export const WAYLAND_PORTAL_SENTINEL = '__wayland-portal__'

/** Erro neutro (não é falha): o usuário fechou o seletor de tela do sistema. */
export const SCREEN_SHARE_CANCELLED = 'Compartilhamento cancelado.'

/**
 * Uma captura por vez. O processo principal guarda a fonte escolhida num
 * único slot; se duas capturas corressem juntas, uma sobrescreveria a fonte
 * da outra e o getDisplayMedia de ambas poderia falhar (NotAllowedError).
 */
let capturing = false

/**
 * No Wayland, cada chamada a `desktopCapturer.getSources()` abre o diálogo
 * nativo do portal (PipeWire). O React StrictMode (dev) monta os efeitos duas
 * vezes e o picker poderia pedir a lista em duplicidade — o usuário via a
 * janela de escolha aparecer mais de uma vez. Compartilha uma única requisição
 * em andamento e reaproveita o resultado por um curto período.
 */
const SOURCES_TTL_MS = 10_000
let sourcesPromise: Promise<ScreenSourceInfo[]> | null = null
let sourcesCache: { at: number; data: ScreenSourceInfo[] } | null = null

/** Lista telas e janelas capturáveis (metadados + miniatura). */
export async function listScreenSources(): Promise<ScreenSourceInfo[]> {
  if (sourcesCache && Date.now() - sourcesCache.at < SOURCES_TTL_MS) {
    return sourcesCache.data
  }
  if (sourcesPromise) return sourcesPromise
  sourcesPromise = (async () => {
    try {
      const sources = await window.api.screenShare.getSources()
      const list = Array.isArray(sources) ? sources : []
      if (import.meta.env.DEV) console.debug('[screen-share] fontes recebidas:', list.length)
      sourcesCache = { at: Date.now(), data: list }
      return list
    } catch (e) {
      console.error('[screen-share] falha ao listar fontes:', e)
      return []
    } finally {
      sourcesPromise = null
    }
  })()
  return sourcesPromise
}

/**
 * Captura a fonte escolhida. O fluxo é:
 *   1. registra a fonte no processo principal (IPC);
 *   2. chama getDisplayMedia() — o handler do main entrega exatamente essa
 *      fonte. Esse é o único caminho que funciona em Wayland (portal/PipeWire)
 *      e também cobre X11 e Windows.
 * Restringe resolução/frame rate e otimiza a codificação: 1080p com até
 * ~24-30 fps + `contentHint = 'detail'` mantém o texto nítido sem estourar
 * a banda na malha P2P (o teto real de bitrate é aplicado no sender).
 */
export async function captureScreenSource(sourceId: string): Promise<MediaStream> {
  if (!sourceId || typeof sourceId !== 'string') {
    throw new Error('Fonte de tela inválida.')
  }
  if (capturing) throw new Error('Já existe uma captura de tela em andamento.')
  capturing = true
  try {
    // No Wayland não há fonte escolhida no app: o portal decide na captura.
    if (sourceId !== WAYLAND_PORTAL_SENTINEL) {
      const registered = await window.api.screenShare.selectSource(sourceId)
      if (!registered) throw new Error('Não foi possível registrar a fonte escolhida.')
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          frameRate: { max: 30, ideal: 24 },
          width: { max: 1920 },
          height: { max: 1080 }
        }
      })
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (name === 'NotAllowedError') {
        // No Wayland o seletor é o do sistema: NotAllowedError normalmente
        // significa que o usuário fechou o diálogo do portal (não é falha).
        if (sourceId === WAYLAND_PORTAL_SENTINEL) throw new Error(SCREEN_SHARE_CANCELLED)
        throw new Error('Permissão de captura negada pelo sistema.')
      }
      if (name === 'NotSupportedError')
        throw new Error('Captura de tela não suportada neste ambiente (sessão/portal de vídeo).')
      throw new Error('Não foi possível capturar a tela.')
    }
    if (stream.getVideoTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('A captura não retornou nenhuma imagem.')
    }
    // conteúdo de tela: pede ao codificador que priorize nitidez (texto,
    // bordas, áreas estáticas) em vez de suavizar como câmera comum
    const track = stream.getVideoTracks()[0]
    try {
      track.contentHint = 'detail'
    } catch {
      // navegador sem suporte — segue com o padrão
    }
    return stream
  } finally {
    capturing = false
  }
}
