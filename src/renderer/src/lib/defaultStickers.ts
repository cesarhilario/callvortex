export interface DefaultSticker {
  name: string
  url: string
}

const files = import.meta.glob('../assets/stickers/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

/** Figurinhas padrão embutidas no app (não dependem do banco). */
export const DEFAULT_STICKERS: DefaultSticker[] = Object.entries(files)
  .map(([path, url]) => ({ name: path.split('/').pop()!.replace(/\.svg$/, ''), url }))
  .sort((a, b) => a.name.localeCompare(b.name))
