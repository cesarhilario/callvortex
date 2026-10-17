#!/usr/bin/env node
// ============================================================
// TESTE DE INSTABILIDADE CONEXÃO/REALTIME — CallVortex
//
// Conecta DOIS clientes ao Realtime do Supabase do projeto
// (simulando dois participantes) e mede, em N rodadas:
//
//   1. subscribe      → tempo até os DOIS canais ficarem SUBSCRIBED
//   2. presença       → join de A visível em B (round-trip)
//   3. broadcast      → latência ida-e-volta (simula offer/answer)
//   4. queda + volta  → desconecta B à força (socket down), mede tempo
//                       de re-subscribe e de re-sincronização da presença
//                       — o cenário exato que derrubava participantes
//
// Uso:
//   node scripts/test-connectivity.mjs [rodadas=3]
//
// Requisitos do .env (NENHUM valor é impresso na saída):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//
// Saída: relatório com mediana/min/max e veredicto PASS/FAIL (exit 0/1).
//
// Técnicas importantes (eram bugs nos primeiros rascunhos):
//   - callbacks `.on()` registrados ANTES de `subscribe()` — o Realtime
//     lança "cannot add presence callbacks after subscribe()" se depois;
//   - cada rodada usa clientes NOVOS (socket limpo, sem estado velho);
//   - NUNCA imprime credenciais.
// ============================================================
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ROUNDS = Math.max(1, Number(process.argv[2] || 3))
const fail = (msg) => { console.error('✗', msg); process.exit(1) }

// --- carrega .env do projeto (só existência; nunca ecoa valores) ---
let url, key
try {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const env = Object.fromEntries(
    raw.split('\n').filter((l) => /=/.test(l) && !l.trim().startsWith('#')).map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
  )
  url = env.VITE_SUPABASE_URL
  key = env.VITE_SUPABASE_ANON_KEY
} catch { /* .env ausente */ }
url ||= process.env.VITE_SUPABASE_URL
key ||= process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  fail('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY não definidos no .env — configure antes de rodar.')
}

const mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// --- helpers ---
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const fmt = (arr) =>
  arr.length
    ? `mediana ${median(arr)}ms | min ${Math.min(...arr)}ms | max ${Math.max(...arr)}ms (${arr.length} amostras)`
    : 'nenhuma amostra'
// espera uma Promise com teto de ms; null em timeout (não lança)
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))])

const subs = []   // tempo para os dois canais ficarem SUBSCRIBED
const joins = []  // presença: join de A visível em B
const rtt = []    // broadcast round-trip
const reco = []   // re-subscribe de B após queda
const rsync = []  // presença de B de volta no roster de A após queda
let outageOk = 0, outageBad = 0

const topic = `stability-test:${Date.now()}_${Math.round(Math.random() * 1e6)}`
console.log('→ Servidor alvo:', String(url).replace(/^[a-z]+:\/\//, '').split('/')[0])
console.log(`→ ${ROUNDS} rodada(s) no canal efêmero "${topic}"`)

for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n======== Rodada ${round}/${ROUNDS} ========`)
  const A = mk(), B = mk()

  // --------------------------------------------------------------
  // 1) subscribe simultâneo — os DOIS clientes entram no MESMO tópico
  //    (sala), senão presença/broadcast nunca se cruzam
  // --------------------------------------------------------------
  const ROOM = `${topic}:room`
  const chanA = A.channel(ROOM, { config: { presence: { key: 'stabil-a' } } })
  const chanB = B.channel(ROOM, { config: { presence: { key: 'stabil-b' } } })

  // TODOS os handlers ANTES do subscribe
  let doneSubs, joinResolve, pongResolve, rejoinResolve
  const subscribed = new Promise((r) => (doneSubs = r))
  const joinSeen = new Promise((r) => (joinResolve = r))
  const pong = new Promise((r) => (pongResolve = r))
  const rejoinSeen = new Promise((r) => (rejoinResolve = r))

  chanB.on('presence', { event: 'join' }, joinResolve)
  chanB.on('broadcast', { event: 'ping' }, () => {
    void chanB.send({ type: 'broadcast', event: 'pong', payload: { nonce: 1 } })
  })
  chanA.on('broadcast', { event: 'pong' }, pongResolve)
  chanA.on('presence', { event: 'join' }, rejoinResolve)

  let pendingA = true, pendingB = true
  const t0 = Date.now()
  chanA.subscribe((st) => {
    if (st === 'SUBSCRIBED' && pendingA) { pendingA = false; if (!pendingB) doneSubs(Date.now() - t0) }
  })
  chanB.subscribe((st) => {
    if (st === 'SUBSCRIBED' && pendingB) { pendingB = false; if (!pendingA) doneSubs(Date.now() - t0) }
  })
  const subMs = await within(subscribed, 15_000)
  if (subMs === null) fail('canais não ficaram SUBSCRIBED — confira URL/anon key/status do projeto Supabase')
  subs.push(subMs)
  console.log(`  subscribe (A+B): ${subMs}ms`)

  // ------------------------------------------------------------
  // 2) presença: track de A deve disparar join em B
  // ------------------------------------------------------------
  const tJoin = Date.now()
  await chanA.track({ info: { userId: 'stabil-a' } })
  const joinMs = await within(joinSeen.then(() => Date.now() - tJoin), 8_000)
  if (joinMs !== null) { joins.push(joinMs); console.log(`  presença join A→B: ${joinMs}ms`) }
  else console.log('  presença join A→B: FALHOU (>8s) — inconsistência de presença')

  // ------------------------------------------------------------
  // 3) broadcast round-trip A→B→A
  // ------------------------------------------------------------
  const tRtt = Date.now()
  await chanA.send({ type: 'broadcast', event: 'ping', payload: { nonce: 0 } })
  const got = await within(pong.then(() => true), 8_000)
  if (got) { const d = Date.now() - tRtt; rtt.push(d); console.log(`  broadcast round trip: ${d}ms`) }
  else console.log('  broadcast round-trip: FALHOU (>8s) — sinalização degradada')

  // ------------------------------------------------------------
  // 4) queda forçada de B → re-subscribe + presença de volta
  //    (última rodada só encurta: mantém tudo limpo no fim)
  // ------------------------------------------------------------
  if (round < ROUNDS) {
    const tFall = Date.now()
    B.realtime.disconnect() // queda bruta (rede caiu)
    const B2 = mk()
    const chanB2 = B2.channel(ROOM, { config: { presence: { key: 'stabil-b' } } })

    let resubResolve
    const resub = new Promise((r) => (resubResolve = r))
    chanB2.subscribe((st) => { if (st === 'SUBSCRIBED') resubResolve(Date.now() - tFall) })
    const resubMs = await within(resub, 10_000)
    if (resubMs !== null) {
      reco.push(resubMs)
      outageOk++
      console.log(`  reconexão após queda: ${resubMs}ms`)
    } else {
      outageBad++
      console.log('  reconexão após queda: FALHOU (>10s)')
    }

    // presença de B2 de volta ao roster de A?
    const rejoinT0 = Date.now()
    await chanB2.track({ info: { userId: 'stabil-b' } })
    const rejoinMs = await within(rejoinSeen.then(() => Date.now() - rejoinT0), 8_000)
    if (rejoinMs !== null) { rsync.push(rejoinMs); console.log(`  presença de B voltou: ${rejoinMs}ms`) }
    else { outageBad++; console.log('  presença de B: NÃO voltou ao roster de A (>8s)') }

    await A.removeChannel(chanA).catch(() => undefined)
  } else {
    await A.removeChannel(chanA).catch(() => undefined)
  }

  // fecha TODOS os sockets da rodada — sem isso o Node fica pendurado,
  // esperando handles de socket abertos do Realtime
  A.realtime.disconnect()
  B.realtime.disconnect()
}

console.log('\n==================== RELATÓRIO ====================')
console.log(`subscribe (2 canais):        ${fmt(subs)}`)
console.log(`presença join (A→B):         ${fmt(joins)}`)
console.log(`broadcast round-trip:        ${fmt(rtt)}`)
console.log(`re-subscribe após queda:     ${fmt(reco)}`)
console.log(`presença re-sync após queda: ${fmt(rsync)}`)
console.log(`quedas recuperadas:          ${outageOk} ok / ${outageBad} falhas`)

// --- veredicto ---
const failReasons = []
if (median(joins.length ? joins : [99999]) > 3000) failReasons.push('presença lenta (>3s)')
if (median(rtt.length ? rtt : [99999]) > 1500) failReasons.push('broadcast lento (>1,5s)')
if (outageBad > 0) failReasons.push('queda não recuperou reconexão/presença')
if (!subs.length) failReasons.push('nenhum subscribe medido')
if (failReasons.length) {
  console.log(`\n→ VEREDICTO: FAIL — ${failReasons.join('; ')}`)
  process.exit(1)
}
console.log('\n→ VEREDICTO: PASS — Realtime íntegro e resiliente nas condições testadas.')
process.exit(0) // garante saída: sockets/pooling do Realtime seguram o backlog do Node
