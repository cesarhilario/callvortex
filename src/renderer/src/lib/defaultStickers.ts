export interface DefaultSticker {
  name: string
  url: string
}

export interface StickerCategory {
  id: string
  label: string
  stickers: DefaultSticker[]
}

const CATEGORY_LABELS: Record<string, string> = {
  reacoes: 'Reações',
  animais: 'Animais',
  comida: 'Comida',
  natureza: 'Natureza',
  objetos: 'Objetos',
  simbolos: 'Símbolos',
  brasil: 'Brasil',
  natal: 'Natal',
  capivara: 'Capivara',
  selvagens: 'Selvagens',
  planeta: 'Planeta',
  frutas: 'Frutas',
  fantasia: 'Fantasia'
}

const svgFiles = import.meta.glob('../assets/stickers/*/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const pngFiles = import.meta.glob('../assets/stickers/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const files: Record<string, string> = { ...svgFiles, ...pngFiles }

/** Extrai o nome da figurinha do caminho do arquivo (sem extensão). */
function stickerName(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.(svg|png)$/, '')
}

/** Figurinhas padrão embutidas no app (não dependem do banco), separadas por categoria. */
export const STICKER_CATEGORIES: StickerCategory[] = Object.entries(CATEGORY_LABELS).map(
  ([id, label]) => ({
    id,
    label,
    stickers: Object.entries(files)
      .filter(([path]) => path.includes(`/stickers/${id}/`))
      .map(([path, url]) => ({ name: stickerName(path), url }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
)

/** Lista achatada de todas as figurinhas padrão. */
export const DEFAULT_STICKERS: DefaultSticker[] = STICKER_CATEGORIES.flatMap((c) => c.stickers)
