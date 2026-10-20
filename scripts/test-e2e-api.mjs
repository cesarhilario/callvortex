#!/usr/bin/env node
// ============================================================
// BATERIA DE TESTES E2E (API) — CallVortex
//
// Cria/usa contas de teste no Supabase, exercita o backend como
// o app faria (servidor, canais, mensagens, DM, voz, tela,
// figurinhas, storage, realtime) e limpa os dados no fim.
//
// Uso:
//   node scripts/test-e2e-api.mjs
//   yarn test:e2e
//
// Contas (duas formas):
//   1) Reuso (recomendado, SEM cota de e-mail): exporte
//        E2E_EMAIL_A / E2E_PASSWORD_A
//        E2E_EMAIL_B / E2E_PASSWORD_B
//      As contas precisam existir e estar CONFIRMADAS.
//   2) Criação automática via signup anônimo — exige que a
//      confirmação de e-mail esteja desligada no painel
//      (SEC-009). Com confirmação ligada, o login falha e a
//      bateria reporta isso.
//
// Limites reais do projeto (lidos em config/auth):
//   mailer_autoconfirm=false · rate_limit_email_sent=2/hora
//   (cada signup anônimo consome 1 e-mail do quota).
//
// Requisitos: .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
// Contas criadas por signup ficam em auth.users (só admin apaga).
// ============================================================
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// ------------------------------------------------ env
let url, anonKey
try {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const env = Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => /=/.test(l) && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
      })
  )
  url = env.VITE_SUPABASE_URL
  anonKey = env.VITE_SUPABASE_ANON_KEY
} catch { /* sem .env */ }
url ||= process.env.VITE_SUPABASE_URL
anonKey ||= process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  console.error('✗ VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes no .env')
  process.exit(1)
}

const TAG = `e2e${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const PASS = `${randomBytes(12).toString('base64url')}Aa1!`

// ------------------------------------------------ helpers HTTP
async function rest(path, { method = 'GET', token, body, raw, headers = {} } = {}) {
  const h = { apikey: anonKey, ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (body && !raw) h['Content-Type'] = 'application/json'
  const res = await fetch(url + path, {
    method,
    headers: h,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(20_000)
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, ok: res.ok, data }
}

const signup = (email) =>
  rest('/auth/v1/signup', { method: 'POST', body: { email, password: PASS } })
const login = (email, password) =>
  rest('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
const rpc = (token, fn, args) =>
  rest(`/rest/v1/rpc/${fn}`, { method: 'POST', token, body: args ?? {} })

// ------------------------------------------------ motor de testes
const results = []
async function t(nome, fn, { requires = [] } = {}) {
  const faltando = requires.filter((r) => !ctx[r])
  if (faltando.length) {
    results.push(['SKIP', `${nome} (depende de ${faltando.join(', ')})`])
    console.log(`  - ${nome} — pulado (depende de ${faltando.join(', ')})`)
    return
  }
  try {
    await fn()
    results.push(['PASS', nome])
    console.log(`  ✔ ${nome}`)
  } catch (e) {
    results.push(['FAIL', `${nome} — ${e.message}`])
    console.log(`  ✗ ${nome} — ${e.message}`)
  }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg ?? 'condição falsa') }

const ctx = { A: null, B: null, serverId: null, invite: null, channelText: null, channelVoice: null, threadId: null, stickerId: null }

async function provisionar(letra) {
  const emailEnv = process.env[`E2E_EMAIL_${letra}`]
  const passEnv = process.env[`E2E_PASSWORD_${letra}`]
  if (emailEnv && passEnv) {
    const li = await login(emailEnv, passEnv)
    if (!li.ok) {
      throw new Error(
        `reuso de ${emailEnv} falhou (login ${li.status}): ${li.data?.error_description ?? ''} ` +
        '— confira E2E_EMAIL_A/B e E2E_PASSWORD_A/B'
      )
    }
    return { email: emailEnv, userId: li.data.user?.id, token: li.data.access_token, reuso: true }
  }
  const email = `${TAG}.${letra.toLowerCase()}@callvortex.dev`
  const su = await signup(email)
  if (!su.ok) {
    if (su.status === 429) {
      throw new Error(
        'rate limit de signup: o projeto envia no máximo 2 e-mails/hora (provedor embutido). ' +
        'Aguarde ~1h ou crie contas fixas e use E2E_EMAIL_A/E2E_PASSWORD_A (reuso).'
      )
    }
    throw new Error(`signup ${su.status}: ${JSON.stringify(su.data).slice(0, 140)}`)
  }
  const token = su.data.session?.access_token ?? su.data.access_token ?? null
  if (!token) {
    const li = await login(email)
    if (!li.ok && /not confirmed|confirm/i.test(String(li.data?.error_description ?? li.data?.msg ?? ''))) {
      throw new Error(
        'e-mail NÃO confirmado (SEC-009: mailer_autoconfirm=false no painel). ' +
        'Desligue "Confirm email" no Supabase Auth ou use contas fixas via E2E_EMAIL_A/B.'
      )
    }
    if (!li.ok) throw new Error(`login ${li.status}: ${li.data?.error_description ?? ''}`)
    return { email, userId: li.data.user?.id, token: li.data.access_token, reuso: false }
  }
  return { email, userId: su.data.user.id, token, reuso: false }
}

// ------------------------------------------------ bateria
console.log(`→ Alvo: ${url.replace(/^https?:\/\//, '').split('/')[0]} · tag ${TAG}`)
console.log(`→ Modo: ${process.env.E2E_EMAIL_A ? 'reuso de contas fixas (E2E_EMAIL_*)' : 'criação via signup (2 e-mails/hora)'}\n`)

await t('API do Supabase responde', async () => {
  const r = await rest('/auth/v1/health')
  ok(r.ok, `status ${r.status}`)
})

await t('Conta A pronta (login ou signup)', async () => {
  ctx.A = await provisionar('A')
})

await t('Login A via grant password', async () => {
  const r = await login(ctx.A.email, process.env.E2E_PASSWORD_A ?? PASS)
  ok(r.ok, `login ${r.status}: ${r.data?.error_description ?? ''}`)
  ctx.A.token = r.data.access_token
}, { requires: ['A'] })

await t('Perfil A presente/criado', async () => {
  const leu = await rest(`/rest/v1/profiles?id=eq.${ctx.A.userId}&select=id`, { token: ctx.A.token })
  ok(leu.ok, `select ${leu.status}`)
  if ((leu.data ?? []).length === 0) {
    const ins = await rest('/rest/v1/profiles', {
      method: 'POST', token: ctx.A.token,
      body: { id: ctx.A.userId, username: `${TAG}_a`, avatar_color: '#5865f2' },
      headers: { Prefer: 'return=minimal' }
    })
    ok(ins.ok, `insert profiles ${ins.status}: ${JSON.stringify(ins.data).slice(0, 120)}`)
  }
}, { requires: ['A'] })

await t('Conta B pronta + perfil', async () => {
  ctx.B = await provisionar('B')
  const leu = await rest(`/rest/v1/profiles?id=eq.${ctx.B.userId}&select=id`, { token: ctx.B.token })
  if (leu.ok && (leu.data ?? []).length === 0) {
    const ins = await rest('/rest/v1/profiles', {
      method: 'POST', token: ctx.B.token,
      body: { id: ctx.B.userId, username: `${TAG}_b`, avatar_color: '#23a55a' },
      headers: { Prefer: 'return=minimal' }
    })
    ok(ins.ok, `insert profiles ${ins.status}`)
  } else {
    ok(leu.ok, `select profiles B ${leu.status}`)
  }
})

await t('Servidor criado pelo A com código de convite', async () => {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' // mesmo de genInviteCode()
  const bytes = randomBytes(8)
  const code = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('')
  const r = await rest('/rest/v1/servers', {
    method: 'POST', token: ctx.A.token,
    body: { name: `Servidor E2E ${TAG}`, owner_id: ctx.A.userId, icon_color: '#5865f2', invite_code: code },
    headers: { Prefer: 'return=representation' }
  })
  ok(r.ok && r.data?.[0]?.id, `insert servers ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`)
  ctx.serverId = r.data[0].id
  ctx.invite = code
  const m = await rest('/rest/v1/server_members', {
    method: 'POST', token: ctx.A.token,
    body: { server_id: ctx.serverId, user_id: ctx.A.userId },
    headers: { Prefer: 'return=minimal' }
  })
  ok(m.ok, `membro A ${m.status}`)
}, { requires: ['A'] })

await t('RLS negativo: B (forasteiro) não enxerga o servidor', async () => {
  const r = await rest(`/rest/v1/servers?id=eq.${ctx.serverId}&select=id`, { token: ctx.B.token })
  ok(r.ok && (r.data ?? []).length === 0, `esperava 0 linhas, veio ${JSON.stringify(r.data).slice(0, 80)}`)
}, { requires: ['A', 'B', 'serverId'] })

await t('Convite inválido é rejeitado', async () => {
  const r = await rpc(ctx.B.token, 'join_server', { code: 'convitequebrado' })
  ok(!r.ok, 'rpc aceitou convite inválido')
}, { requires: ['B'] })

await t('B entra no servidor via join_server', async () => {
  const r = await rpc(ctx.B.token, 'join_server', { code: ctx.invite })
  ok(r.ok, `join_server ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`)
}, { requires: ['A', 'B', 'invite'] })

await t('Canal de texto criado', async () => {
  const r = await rest('/rest/v1/channels', {
    method: 'POST', token: ctx.A.token,
    body: { server_id: ctx.serverId, name: `geral-${TAG}`, type: 'text' },
    headers: { Prefer: 'return=representation' }
  })
  ok(r.ok && r.data?.[0]?.id, `insert channels ${r.status}`)
  ctx.channelText = r.data[0].id
}, { requires: ['A', 'serverId'] })

await t('Mensagem enviada pelo A e lida pelo B', async () => {
  const send = await rest('/rest/v1/messages', {
    method: 'POST', token: ctx.A.token,
    body: { channel_id: ctx.channelText, author_id: ctx.A.userId, content: `oi do teste ${TAG}` },
    headers: { Prefer: 'return=minimal' }
  })
  ok(send.ok, `insert messages ${send.status}: ${JSON.stringify(send.data).slice(0, 120)}`)
  const read = await rest(`/rest/v1/messages?channel_id=eq.${ctx.channelText}&select=content`, { token: ctx.B.token })
  ok(read.ok && read.data?.some((m) => m.content.includes(TAG)), 'B não leu a mensagem')
}, { requires: ['A', 'B', 'channelText'] })

await t('RLS negativo: B não edita mensagem do A', async () => {
  const r = await rest(`/rest/v1/messages?channel_id=eq.${ctx.channelText}`, {
    method: 'PATCH', token: ctx.B.token,
    body: { content: 'editado por invasor' },
    headers: { Prefer: 'return=representation' }
  })
  ok(r.ok && (r.data ?? []).length === 0, 'update de forasteiro não foi bloqueado')
}, { requires: ['B', 'channelText'] })

await t('Canal de voz + sessão de voz (ensure_voice_session)', async () => {
  const ch = await rest('/rest/v1/channels', {
    method: 'POST', token: ctx.A.token,
    body: { server_id: ctx.serverId, name: `call-${TAG}`, type: 'voice' },
    headers: { Prefer: 'return=representation' }
  })
  ok(ch.ok && ch.data?.[0]?.id, `canal voz ${ch.status}`)
  ctx.channelVoice = ch.data[0].id
  const sess = await rpc(ctx.A.token, 'ensure_voice_session', { target_channel: ctx.channelVoice })
  ok(sess.ok && sess.data, `ensure_voice_session ${sess.status}: ${JSON.stringify(sess.data)}`)
  const veio = await rest(`/rest/v1/voice_sessions?channel_id=eq.${ctx.channelVoice}&select=channel_id`, { token: ctx.B.token })
  ok(veio.ok && (veio.data ?? []).length === 1, 'B não viu a sessão de voz')
}, { requires: ['A', 'B', 'serverId'] })

await t('Compartilhamento de tela: start + sinal + stop', async () => {
  const start = await rpc(ctx.A.token, 'start_screen_share', { target_channel: ctx.channelVoice })
  ok(start.ok, `start_screen_share ${start.status}: ${JSON.stringify(start.data).slice(0, 100)}`)
  const sig = await rpc(ctx.A.token, 'send_call_signal', {
    p_channel: ctx.channelVoice, p_receiver: ctx.B.userId,
    p_kind: 'screen-offer', p_payload: { sdp: 'oferta-de-teste' }
  })
  ok(sig.ok && Number(sig.data) > 0, `send_call_signal ${sig.status}`)
  const bviu = await rest(`/rest/v1/call_signals?channel_id=eq.${ctx.channelVoice}&select=kind`, { token: ctx.B.token })
  ok(bviu.ok && bviu.data?.some((s) => s.kind === 'screen-offer'), 'B não recebeu o sinal')
  const stop = await rpc(ctx.A.token, 'stop_screen_share', { target_channel: ctx.channelVoice })
  ok(stop.ok, `stop_screen_share ${stop.status}`)
}, { requires: ['A', 'B', 'channelVoice'] })

await t('DM: criar thread, trocar mensagem e atualizar resumo', async () => {
  const r = await rpc(ctx.A.token, 'create_dm_thread', { other_user: ctx.B.userId })
  ok(r.ok && r.data?.id, `create_dm_thread ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`)
  ctx.threadId = r.data.id
  const msg = await rest('/rest/v1/dm_messages', {
    method: 'POST', token: ctx.A.token,
    body: { thread_id: ctx.threadId, author_id: ctx.A.userId, content: `dm de teste ${TAG}` },
    headers: { Prefer: 'return=minimal' }
  })
  ok(msg.ok, `dm_messages ${msg.status}`)
  const veio = await rest(`/rest/v1/dm_messages?thread_id=eq.${ctx.threadId}&select=content`, { token: ctx.B.token })
  ok(veio.ok && veio.data?.some((m) => m.content.includes(TAG)), 'B não leu a DM')
  const upd = await rest(`/rest/v1/dm_threads?id=eq.${ctx.threadId}`, {
    method: 'PATCH', token: ctx.A.token,
    body: { last_message: 'dm de teste', last_message_author: ctx.A.userId, last_message_at: new Date().toISOString() },
    headers: { Prefer: 'return=minimal' }
  })
  ok(upd.ok, `update dm_threads ${upd.status}`)
}, { requires: ['A', 'B'] })

await t('Figurinha pessoal: inserir, ler e apagar', async () => {
  const name = `fig_${TAG}`
  const urlSvg =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI0MCIgZmlsbD0iIzRmN2NmZiIvPjwvc3ZnPg=='
  const ins = await rest('/rest/v1/stickers', {
    method: 'POST', token: ctx.A.token,
    body: { server_id: null, owner_user_id: ctx.A.userId, name, url: urlSvg },
    headers: { Prefer: 'return=representation' }
  })
  ok(ins.ok && ins.data?.[0]?.id, `insert stickers ${ins.status}: ${JSON.stringify(ins.data).slice(0, 120)}`)
  ctx.stickerId = ins.data[0].id
  const leio = await rest(`/rest/v1/stickers?owner_user_id=eq.${ctx.A.userId}&select=name`, { token: ctx.A.token })
  ok(leio.ok && leio.data?.some((s) => s.name === name), 'dono não leu a figurinha')
  const naoVi = await rest(`/rest/v1/stickers?owner_user_id=eq.${ctx.A.userId}&select=id`, { token: ctx.B.token })
  ok(naoVi.ok && (naoVi.data ?? []).length === 0, 'outro usuário viu figurinha pessoal alheia')
  const del = await rest(`/rest/v1/stickers?id=eq.${ctx.stickerId}`, { method: 'DELETE', token: ctx.A.token })
  ok(del.ok, `delete stickers ${del.status}`)
  ctx.stickerId = null
}, { requires: ['A', 'B'] })

await t('Storage: upload + URL pública + delete do avatar', async () => {
  const path = `${ctx.A.userId}/e2e-${TAG}.png`
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  const up = await fetch(`${url}/storage/v1/object/avatars/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${ctx.A.token}`, 'Content-Type': 'image/png' },
    body: png,
    signal: AbortSignal.timeout(20_000)
  })
  ok(up.ok, `upload ${up.status}`)
  const pub = await fetch(`${url}/storage/v1/object/public/avatars/${path}`, { signal: AbortSignal.timeout(20_000) })
  ok(pub.ok, `url pública ${pub.status}`)
  await pub.arrayBuffer()
  const del = await fetch(`${url}/storage/v1/object/avatars/${path}`, {
    method: 'DELETE',
    headers: { apikey: anonKey, Authorization: `Bearer ${ctx.A.token}` },
    signal: AbortSignal.timeout(20_000)
  })
  ok(del.ok, `delete ${del.status}`)
}, { requires: ['A'] })

await t('Realtime: broadcast autenticado de A para B', async () => {
  const mk = (token) =>
    createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
  const A = mk(ctx.A.token)
  const B = mk(ctx.B.token)
  const topic = `realtime-e2e:${TAG}`
  const recebido = new Promise((resolve) => {
    const ch = B.channel(topic)
    ch.on('broadcast', { event: 'ping' }, (payload) => resolve(payload))
    ch.subscribe()
  })
  await new Promise((resolve, reject) => {
    const ch = A.channel(topic)
    ch.subscribe((status) => (status === 'SUBSCRIBED' ? resolve() : undefined))
    setTimeout(() => reject(new Error('subscribe A não confirmado em 10 s')), 10_000)
  })
  const chA = A.channel(topic)
  await chA.send({ type: 'broadcast', event: 'ping', payload: { tag: TAG } })
  const r = await Promise.race([
    recebido,
    new Promise((_, rej) => setTimeout(() => rej(new Error('broadcast não chegou em 10 s')), 10_000))
  ])
  ok(r?.payload?.tag === TAG, `payload inesperado: ${JSON.stringify(r).slice(0, 80)}`)
  await A.removeAllChannels()
  await B.removeAllChannels()
}, { requires: ['A', 'B'] })

// ------------------------------------------------ limpeza
console.log('\n→ Limpando dados de teste…')
async function limpar() {
  const token = ctx.A?.token
  if (!token) return
  const del = async (path) => { try { await rest(path, { method: 'DELETE', token }) } catch { /* best effort */ } }
  if (ctx.serverId) await del(`/rest/v1/servers?id=eq.${ctx.serverId}`) // cascata: canais, msgs, sessões
  if (ctx.threadId) {
    await del(`/rest/v1/dm_messages?thread_id=eq.${ctx.threadId}`)
    await del(`/rest/v1/dm_participants?thread_id=eq.${ctx.threadId}`)
    await del(`/rest/v1/dm_threads?id=eq.${ctx.threadId}`)
  }
  if (ctx.stickerId) await del(`/rest/v1/stickers?id=eq.${ctx.stickerId}`)
}
await limpar()

// ------------------------------------------------ relatório
const pass = results.filter(([s]) => s === 'PASS').length
const fail = results.filter(([s]) => s === 'FAIL').length
const skip = results.filter(([s]) => s === 'SKIP').length
console.log(`\n======== RESULTADO: ${pass} PASS · ${fail} FAIL${skip ? ` · ${skip} SKIP` : ''} ========`)
for (const [s, n] of results) if (s === 'FAIL') console.log(`  ✗ ${n}`)
if (fail === 0) console.log('✔ Bateria E2E completa — backend saudável.')
else console.log('✗ Há falhas — veja acima.')
if (ctx.A && !ctx.A.reuso) console.log(`\nContas criadas por signup (só admin apaga): ${ctx.A.email}${ctx.B && !ctx.B.reuso ? `, ${ctx.B.email}` : ''}`)
process.exit(fail === 0 ? 0 : 1)
