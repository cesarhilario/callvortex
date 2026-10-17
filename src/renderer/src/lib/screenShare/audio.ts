/**
 * Mixagem do áudio do compartilhamento de tela.
 *
 * Quando a captura traz áudio do sistema (getDisplayMedia com áudio no
 * Windows via loopback), é preciso mandar DUAS fontes pelo mesmo canal de
 * voz: a voz do usuário e o que está tocando na máquina. A malha WebRTC
 * envia um único track de áudio por par, então as duas fontes são mixadas
 * aqui num AudioContext e a trilha resultante é a que vai para os pares.
 *
 * Por que mixar em vez de enviar uma segunda trilha?
 *  - o lado remoto NÃO muda: ele continua recebendo/interpretando exatamente
 *    um track de áudio por participante (zero risco de regredir a recepção);
 *  - ligar/desligar cada fonte vira ajuste de ganho em tempo real: nenhuma
 *    renegociação SDP, nenhum replaceTrack, nenhuma queda de conexão;
 *  - o microfone continua passando pela cadeia de voz (supressão de ruído,
 *    volume do mic) ANTES de entrar na mixagem.
 */

/** Uma entrada (fonte) da mixagem: stream + nó de ganho que a controla. */
interface MixerInput {
  gain: GainNode
  source: MediaStreamAudioSourceNode | null
}

export class ScreenAudioMixer {
  private ctx: AudioContext
  private dest: MediaStreamAudioDestinationNode
  private mic: MixerInput
  private desktop: MixerInput
  /** estado desejado — reaplicado ao trocar a fonte */
  private micActive = true
  private desktopActive = true

  /** Saída pronta para substituir a trilha enviada aos pares. */
  readonly stream: MediaStream

  constructor(micStream: MediaStream | null, desktopTrack: MediaStreamTrack | null) {
    const ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    this.ctx = ctx
    this.dest = ctx.createMediaStreamDestination()

    const makeInput = (): MixerInput => {
      const gain = ctx.createGain()
      gain.connect(this.dest)
      return { gain, source: null }
    }
    this.mic = makeInput()
    this.desktop = makeInput()

    this.stream = this.dest.stream
    this.setMicStream(micStream)
    this.setDesktopTrack(desktopTrack)
  }

  /** Trilha de saída (sempre uma; o dest nunca é vazio). */
  get outputTrack(): MediaStreamTrack | null {
    return this.stream.getAudioTracks()[0] ?? null
  }

  /** Troca a fonte de microfone sem mexer na mixagem em si (ganho mantido). */
  setMicStream(stream: MediaStream | null): void {
    this.mic.source = this.replaceSource(this.mic.source, this.mic.gain, stream)
  }

  /** Troca a fonte de áudio do sistema (ou desliga com null). */
  setDesktopTrack(track: MediaStreamTrack | null): void {
    const stream = track && track.readyState !== 'ended' ? new MediaStream([track]) : null
    this.desktop.source = this.replaceSource(this.desktop.source, this.desktop.gain, stream)
  }

  /** Liga/desliga o microfone NA MIXAGEM (independente do áudio do sistema). */
  setMicActive(active: boolean): void {
    this.micActive = active
    this.mic.gain.gain.value = active ? 1 : 0
  }

  /** Liga/desliga o áudio do sistema NA MIXAGEM (independente do microfone). */
  setDesktopActive(active: boolean): void {
    this.desktopActive = active
    this.desktop.gain.gain.value = active ? 1 : 0
  }

  /** Desconecta tudo e encerra o AudioContext. */
  destroy(): void {
    for (const input of [this.mic, this.desktop]) {
      if (input.source) {
        try {
          input.source.disconnect()
        } catch {
          // nó já desconectado
        }
        input.source = null
      }
      try {
        input.gain.disconnect()
      } catch {
        // nó já desconectado
      }
    }
    try {
      this.dest.disconnect()
    } catch {
      // nó já desconectado
    }
    this.stream.getTracks().forEach((t) => t.stop())
    void this.ctx.close().catch(() => undefined)
  }

  private replaceSource(
    previous: MediaStreamAudioSourceNode | null,
    destination: AudioNode,
    stream: MediaStream | null
  ): MediaStreamAudioSourceNode | null {
    if (previous) {
      try {
        previous.disconnect()
      } catch {
        // nó já desconectado
      }
    }
    if (!stream || stream.getAudioTracks().length === 0) return null
    try {
      const source = this.ctx.createMediaStreamSource(stream)
      source.connect(destination)
      return source
    } catch {
      // stream sem trilha viva — segue sem esta fonte
      return null
    }
  }
}
