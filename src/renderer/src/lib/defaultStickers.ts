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
  simbolos: 'Símbolos'
}

const files = import.meta.glob('../assets/stickers/*/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

/** Figurinhas padrão embutidas no app (não dependem do banco), separadas por categoria. */
export const STICKER_CATEGORIES: StickerCategory[] = Object.entries(CATEGORY_LABELS).map(
  ([id, label]) => ({
    id,
    label,
    stickers: Object.entries(files)
      .filter(([path]) => path.includes(`/stickers/${id}/`))
      .map(([path, url]) => ({ name: path.split('/').pop()!.replace(/\.svg$/, ''), url }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
)

/** Lista achatada de todas as figurinhas padrão. */
export const DEFAULT_STICKERS: DefaultSticker[] = STICKER_CATEGORIES.flatMap((c) => c.stickers)
