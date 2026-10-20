#!/usr/bin/env python3
"""
Cria novas figurinhas no mesmo estilo dos pacotes da pasta ./assets
(flat, cartoon fofinho, fundo transparente) e as renderiza como
PNG 512x512 — mesmo formato dos arquivos existentes.

Desenho: SVG vetorial escrito à mão (formas simples + carinha feliz)
-> rsvg-convert -> PNG. Depois rode scripts/import_pack_stickers.py
para levá-las ao pacote embutido do app.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path("assets")
INK = "#5a3d2b"  # traço (marrom escuro suave)

TRAZO = f'stroke="{INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"'


def brilho_olhos() -> str:
    return (
        '<circle cx="0" cy="-4" r="4.5" fill="#ffffff" opacity=".85"/>'
        '<circle cx="14" cy="-2" r="3" fill="#ffffff" opacity=".7"/>'
    )


def carinha(ex, ey, dx, my, blush="#ff8fa3", cor="#ffffff") -> str:
    """Olhos (elipses com brilho), boquinha sorridente e bochechas."""
    e = ""
    for off in (-dx, dx):
        e += (
            f'<g transform="translate({ex + off},{ey})">'
            f'<ellipse rx="13" ry="17" fill="{cor}"/>'
            + brilho_olhos().replace('cx="0"', 'cx="-2"')
            + "</g>"
        )
    boca = f'<path d="M{ex - 14},{my} q14,14 28,0" {TRAZO}/>'
    rubor = (
        f'<ellipse cx="{ex - dx - 22}" cy="{ey + 18}" rx="11" ry="6" fill="{blush}" opacity=".55"/>'
        f'<ellipse cx="{ex + dx + 22}" cy="{ey + 18}" rx="11" ry="6" fill="{blush}" opacity=".55"/>'
    )
    return e + boca + rubor


def fundo(cor: str, *extras: str) -> str:
    return "\n".join(extras)


def svg(*conteudo: str) -> str:
    corpo = "\n".join(conteudo)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">\n'
        f"{corpo}\n"
        "</svg>"
    )


def sombra_ground() -> str:
    return '<ellipse cx="256" cy="462" rx="120" ry="18" fill="#000000" opacity=".08"/>'


# ============================================================
# FANTASIA
# ============================================================

def dragao() -> str:
    corpo = "#8cd47e"
    asa = "#6ab04c"
    barriga = "#d7ecc8"
    espinha = "#5aa346"
    chifre = "#f6f1e3"
    return svg(
        sombra_ground(),
        # asas
        f'<path d="M168,240 q-70,-70 -60,-150 q80,20 108,96" fill="{asa}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        f'<path d="M344,240 q70,-70 60,-150 q-80,20 -108,96" fill="{asa}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        # cauda
        f'<path d="M256,380 q-6,60 -70,64" fill="none" stroke="{INK}" stroke-width="16" stroke-linecap="round"/>',
        f'<path d="M186,444 l-34,10 l14,-30 z" fill="{espinha}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        # corpo
        f'<ellipse cx="256" cy="300" rx="120" ry="118" fill="{corpo}" stroke="{INK}" stroke-width="7"/>',
        f'<ellipse cx="256" cy="332" rx="78" ry="74" fill="{barriga}"/>',
        # espinhas nas costas
        f'<path d="M164,214 l-16,-26 l30,10 z M256,190 l0,-30 l22,22 z M348,214 l16,-26 l-30,10 z" fill="{espinha}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>',
        # cabeça
        f'<ellipse cx="256" cy="196" rx="112" ry="96" fill="{corpo}" stroke="{INK}" stroke-width="7"/>',
        f'<ellipse cx="256" cy="238" rx="64" ry="42" fill="{barriga}"/>',
        # chifrinhos
        f'<path d="M186,116 q-10,-46 24,-58 q8,34 -6,60 z" fill="{chifre}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>',
        f'<path d="M326,116 q10,-46 -24,-58 q-8,34 6,60 z" fill="{chifre}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>',
        # foquinha por cima da barriga
        f'<path d="M244,214 q12,10 24,0" {TRAZO}/>',
        carinha(222, 180, 26, 232),
        '<path d="M256,268 q0,8 0,0" />',
    )


def dinossauro() -> str:
    corpo = "#6ec6e8"
    barriga = "#cdeef8"
    escama = "#3f9dc4"
    punt = "#5fb7dd"
    dents = '<g fill="#ffffff">' + "".join(f'<circle cx="{256 + i * 26}" cy="252" r="4" fill="{INK}" opacity="0"/>' for i in (-2, -1, 0, 1, 2)) + "</g>"
    return svg(
        sombra_ground(),
        # cauda
        f'<path d="M330,360 q86,-8 100,-78" fill="{corpo}" stroke="{INK}" stroke-width="7"/>',
        # patas
        f'<ellipse cx="196" cy="428" rx="46" ry="26" fill="{corpo}" stroke="{INK}" stroke-width="7"/>',
        f'<ellipse cx="322" cy="428" rx="46" ry="26" fill="{corpo}" stroke="{INK}" stroke-width="7"/>',
        # corpo
        f'<ellipse cx="256" cy="340" rx="128" ry="112" fill="{corpo}" stroke="{INK}" stroke-width="7"/>',
        # pequenas pintas
        f'<circle cx="330" cy="330" r="9" fill="{punt}" opacity=".8"/><circle cx="356" cy="358" r="7" fill="{punt}" opacity=".8"/><circle cx="310" cy="366" r="6" fill="{punt}" opacity=".8"/>',
        f'<ellipse cx="256" cy="366" rx="86" ry="74" fill="{barriga}"/>',
        # cabeça
        f'<path d="M188,236 q10,-108 96,-104 q96,4 108,96 q6,74 -78,80 q-118,8 -126,-72 z" fill="{corpo}" stroke="{INK}" stroke-width="7"/>',
        # mandíbula fofa
        f'<path d="M206,258 q50,34 104,4 q-4,34 -52,36 q-46,2 -52,-40 z" fill="{barriga}" stroke="{INK}" stroke-width="7"/>',
        # crista
        f'<path d="M236,134 l22,-34 l10,34 z M286,132 l16,-36 l14,36 z M322,150 l26,-28 l6,36 z" fill="{escama}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>',
        # nompinho
        f'<path d="M256,268 q0,0 0,0" />',
        carinha(224, 196, 30, 232),
        # dentinhos
        "<g fill='#ffffff'><path d='M224,272 l10,14 l10,-12 z M254,284 l10,14 l10,-12 z M286,274 l10,14 l10,-12 z' stroke='{ink}' stroke-width='5' stroke-linejoin='round'/></g>".format(ink=INK).replace("stroke='#ffffff'", 'fill="#ffffff"'),
    )


def yeti() -> str:
    pelo = "#eef3f7"
    sombra_pelo = "#d3dde6"
    azul = "#9fd8ef"
    return svg(
        sombra_ground(),
        # pés
        f'<ellipse cx="196" cy="446" rx="52" ry="24" fill="{sombra_pelo}" stroke="{INK}" stroke-width="7"/>',
        f'<ellipse cx="316" cy="446" rx="52" ry="24" fill="{sombra_pelo}" stroke="{INK}" stroke-width="7"/>',
        # corpo peludo
        f'<circle cx="256" cy="330" r="120" fill="{pelo}" stroke="{INK}" stroke-width="7"/>',
        # tufos da silhueta
        f'<path d="M170,380 q20,24 -18,28 M110,300 q-26,-6 -18,-30 M402,300 q26,-6 18,-30" stroke="{INK}" stroke-width="7" fill="none" stroke-linecap="round"/>',
        # barriga
        f'<ellipse cx="256" cy="360" rx="76" ry="70" fill="#ffffff"/>',
        # braços
        f'<path d="M146,300 q-40,24 -24,64" stroke="{INK}" stroke-width="20" fill="none" stroke-linecap="round"/>',
        f'<path d="M366,300 q40,24 24,64" stroke="{INK}" stroke-width="20" fill="none" stroke-linecap="round"/>',
        # cabeça
        f'<circle cx="256" cy="188" r="104" fill="{pelo}" stroke="{INK}" stroke-width="7"/>',
        # rosto
        f'<ellipse cx="256" cy="206" rx="74" ry="60" fill="#ffffff"/>',
        # chifrinhos azuis
        f'<path d="M188,110 q-16,-40 12,-52 q10,28 4,52 z" fill="{azul}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>',
        f'<path d="M324,110 q16,-40 -12,-52 q-10,28 -4,52 z" fill="{azul}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>',
        # tufinho na cabeça
        f'<path d="M256,86 q-8,-24 14,-30" stroke="{INK}" stroke-width="8" fill="none" stroke-linecap="round"/>',
        f'<path d="M246,236 q10,8 20,0" {TRAZO}/>',
        carinha(228, 190, 28, 226),
    )


def alien() -> str:
    verde = "#8fd86e"
    claro = "#c8f2b4"
    antena = "#ff6b6b"
    return svg(
        sombra_ground(),
        # antenas
        f'<path d="M206,120 q-24,-56 -6,-66" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round"/>',
        f'<path d="M306,120 q24,-56 6,-66" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round"/>',
        f'<circle cx="198" cy="46" r="16" fill="{antena}" stroke="{INK}" stroke-width="6"/>',
        f'<circle cx="314" cy="46" r="16" fill="{antena}" stroke="{INK}" stroke-width="6"/>',
        # cabeça oválada grande
        f'<path d="M256,64 q120,10 122,148 q2,130 -122,148 q-124,-18 -122,-148 q2,-138 122,-148 z" fill="{verde}" stroke="{INK}" stroke-width="7"/>',
        # corpo adulto
        f'<path d="M180,340 q10,36 8,58 q68,26 136,0 q-2,-22 8,-58" fill="{verde}" stroke="{INK}" stroke-width="7"/>',
        f'<ellipse cx="256" cy="428" rx="30" ry="18" fill="#b2e39a"/>',
        # barriga clara
        f'<ellipse cx="256" cy="372" rx="70" ry="52" fill="{claro}"/>',
        # olhos pretos grandes (estilo alienígena)
        f'<ellipse cx="216" cy="170" rx="24" ry="32" fill="#26202b"/>',
        f'<ellipse cx="296" cy="170" rx="24" ry="32" fill="#26202b"/>',
        f'<circle cx="209" cy="158" r="7" fill="#ffffff" opacity=".9"/>',
        f'<circle cx="289" cy="158" r="7" fill="#ffffff" opacity=".9"/>',
        f'<path d="M244,226 q12,10 24,0" {TRAZO}/>',
        '<ellipse cx="180" cy="212" rx="11" ry="6" fill="#ff8fa3" opacity=".55"/>'
        '<ellipse cx="332" cy="212" rx="11" ry="6" fill="#ff8fa3" opacity=".55"/>',
    )


def fantasma() -> str:
    branco = "#fbfcfe"
    sombra_fant = "#e2e8f4"
    return svg(
        sombra_ground(),
        # cauda ondulada
        f'<path d="M150,352 q26,-16 52,0 q26,16 54,0 q28,-16 56,0 q26,16 50,0 l0,64 q-24,20 -50,0 q-28,-16 -56,0 q-26,16 -54,0 q-26,-16 -52,0 z" fill="{branco}" stroke="{INK}" stroke-width="7"/>',
        # corpo
        f'<path d="M256,72 q132,0 130,164 l0,116 l-260,0 l0,-116 q-2,-164 130,-164 z" fill="{branco}" stroke="{INK}" stroke-width="7"/>',
        # mãozinhas
        f'<ellipse cx="112" cy="270" rx="30" ry="34" fill="{branco}" stroke="{INK}" stroke-width="7"/>',
        f'<ellipse cx="400" cy="270" rx="30" ry="34" fill="{branco}" stroke="{INK}" stroke-width="7"/>',
        # bochechas sombreadas
        f'<ellipse cx="168" cy="222" rx="16" ry="10" fill="{sombra_fant}"/>',
        f'<ellipse cx="344" cy="222" rx="16" ry="10" fill="{sombra_fant}"/>',
        f'<path d="M234,250 q22,18 44,0" {TRAZO}/>',
        carinha(228, 190, 30, 240, blush="#ff8fa3"),
        # bochecha rosa
        '<ellipse cx="150" cy="234" rx="12" ry="7" fill="#ff8fa3" opacity=".5"/>'
        '<ellipse cx="362" cy="234" rx="12" ry="7" fill="#ff8fa3" opacity=".5"/>',
    )


def monstro() -> str:
    roxo = "#b39ddb"
    claro = "#e6dcf7"
    chifre = "#f2c94c"
    return svg(
        sombra_ground(),
        # pernas
        f'<path d="M204,392 q-6,34 8,54" stroke="{INK}" stroke-width="22" fill="none" stroke-linecap="round"/>',
        f'<path d="M308,392 q6,34 -8,54" stroke="{INK}" stroke-width="22" fill="none" stroke-linecap="round"/>',
        # chifres
        f'<path d="M150,148 q-30,-30 -12,-64 q26,14 30,58 z" fill="{chifre}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        f'<path d="M362,148 q30,-30 12,-64 q-26,14 -30,58 z" fill="{chifre}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        # corpo blob
        f'<path d="M256,84 q140,0 138,180 q4,164 -138,164 q-142,0 -138,-164 q-2,-180 138,-180 z" fill="{roxo}" stroke="{INK}" stroke-width="7"/>',
        # barriga
        f'<ellipse cx="256" cy="360" rx="84" ry="62" fill="{claro}"/>',
        # um olho gigante
        f'<circle cx="256" cy="220" r="66" fill="#ffffff" stroke="{INK}" stroke-width="7"/>',
        f'<circle cx="256" cy="224" r="26" fill="#26202b"/>',
        f'<circle cx="248" cy="214" r="8" fill="#ffffff" opacity=".9"/>',
        # sorriso de dentes
        f'<path d="M186,320 q70,44 140,0 q-16,44 -70,44 q-54,0 -70,-44 z" fill="#ffffff" stroke="{INK}" stroke-width="7"/>',
        f'<path d="M216,340 l0,14 M256,352 l0,16 M296,340 l0,14" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>',
    )


# ============================================================
# FRUTAS
# ============================================================

def folha(x: float, y: float, escala: float = 1.0, flip: float = 1.0) -> str:
    return (
        f'<g transform="translate({x},{y}) scale({flip * escala},{escala})">'
        f'<path d="M0,0 q34,-6 52,-30 q-40,-4 -52,30 z" fill="#79b851" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
        f'<path d="M8,-4 q22,-8 40,-24" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>'
        "</g>"
    )


def manga() -> str:
    return svg(
        sombra_ground(),
        '<path d="M150,208 q16,-118 128,-120 q118,-2 148,84 q26,86 -46,176 q-84,104 -176,66 q-88,-38 -54,-206 z" fill="#ffb84d" stroke="' + INK + '" stroke-width="7"/>',
        '<circle cx="250" cy="250" r="70" fill="#ffd28a" opacity=".55"/>',
        '<ellipse cx="196" cy="176" rx="18" ry="10" fill="#ffefc9" opacity=".7" transform="rotate(-24 196 176)"/>',
        folha(360, 104),
        '<path d="M354,106 q-8,26 -34,38" stroke="' + INK + '" stroke-width="7" fill="none" stroke-linecap="round"/>',
        carinha(238, 282, 34, 282, blush="#f7838f"),
    )


def laranja() -> str:
    cor = "#ff9f43"
    claro = "#ffc078"
    return svg(
        sombra_ground(),
        f'<circle cx="256" cy="300" r="146" fill="{cor}" stroke="{INK}" stroke-width="7"/>',
        f'<path d="M256,158 a142,142 0 0,1 0,284 l0,-284 z" fill="{claro}" opacity=".35"/>',
        # pintinhas de casca
        '<circle cx="196" cy="252" r="5" fill="#ffd7a1" opacity=".9"/><circle cx="316" cy="276" r="5" fill="#ffd7a1" opacity=".9"/><circle cx="246" cy="398" r="5" fill="#ffd7a1" opacity=".9"/><circle cx="352" cy="352" r="5" fill="#ffd7a1" opacity=".9"/>',
        # talinho
        f'<path d="M256,158 q0,-28 0,-38" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>',
        folha(256, 122),
        carinha(238, 300, 36, 300, blush="#e86a6a"),
    )


def limao() -> str:
    cor = "#ffe36e"
    claro = "#fff3b8"
    return svg(
        sombra_ground(),
        # corpo limão (elipse com "mamas")
        f'<path d="M366,336 a150,140 0 1,1 -228,-10 q-16,-36 20,-62 q10,-32 48,-30 q44,-24 92,-4 q44,-4 54,32 q30,32 14,74 z" fill="{cor}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        f'<ellipse cx="256" cy="304" rx="96" ry="102" fill="{claro}" opacity=".45"/>',
        '<circle cx="188" cy="240" r="5" fill="#fffbe6"/><circle cx="322" cy="258" r="5" fill="#fffbe6"/><circle cx="256" cy="404" r="5" fill="#fffbe6"/>',
        carinha(238, 296, 34, 296, blush="#f0b250"),
    )


def melao() -> str:
    verde = "#9ccc65"
    faixa = "#7fb03f"
    return svg(
        sombra_ground(),
        f'<circle cx="256" cy="296" r="148" fill="{verde}" stroke="{INK}" stroke-width="7"/>',
        f'<path d="M112,296 q144,58 288,0" stroke="{faixa}" stroke-width="14" fill="none"/>',
        f'<path d="M118,240 q140,52 276,0" stroke="{faixa}" stroke-width="12" fill="none"/>',
        f'<path d="M138,394 q118,44 236,0" stroke="{faixa}" stroke-width="12" fill="none"/>',
        # talinho
        f'<path d="M256,150 q6,-26 -4,-40" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>',
        folha(262, 118),
        carinha(238, 296, 36, 296, blush="#f3a4a4"),
    )


def kiwi() -> str:
    capa = "#8d6e63"
    polpa = "#a8d94e"
    nucleo = "#f4f7d9"
    sementes = "".join(
        f'<circle cx="{256 + 66 * __import__("math").cos(__import__("math").radians(i * 30)):.0f}" '
        f'cy="{296 + 66 * __import__("math").sin(__import__("math").radians(i * 30)):.0f}" r="6" fill="#26202b"/>'
        for i in range(12)
    )
    return svg(
        sombra_ground(),
        f'<ellipse cx="256" cy="296" rx="150" ry="140" fill="{capa}" stroke="{INK}" stroke-width="7"/>',
        # “pelinhos”
        "".join(f'<line x1="{256 + 132 * __import__("math").cos(__import__("math").radians(i * 22.5)):.0f}" y1="{296 + 132 * __import__("math").sin(__import__("math").radians(i * 22.5)):.0f}" x2="{256 + 148 * __import__("math").cos(__import__("math").radians(i * 22.5)):.0f}" y2="{296 + 148 * __import__("math").sin(__import__("math").radians(i * 22.5)):.0f}" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>' for i in range(16)),
        f'<ellipse cx="256" cy="296" rx="118" ry="110" fill="{polpa}" stroke="{INK}" stroke-width="5"/>',
        f'<ellipse cx="256" cy="296" rx="34" ry="32" fill="{nucleo}"/>',
        sementes,
        carinha(236, 292, 32, 292, blush="#8bab3a"),
    )


def pessego() -> str:
    cor = "#f8a5b0"
    soma = "#f56f86"
    return svg(
        sombra_ground(),
        f'<path d="M256,178 q40,-56 84,-36 q66,30 58,124 q-8,102 -90,136 q-52,22 -104,0 q-82,-34 -90,-136 q-8,-94 58,-124 q44,-20 84,36 z" fill="{cor}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        f'<path d="M254,196 q14,90 2,208" stroke="{soma}" stroke-width="10" fill="none" opacity=".55"/>',
        '<ellipse cx="176" cy="252" rx="20" ry="11" fill="#ffe3e9" opacity=".8" transform="rotate(-18 176 252)"/>',
        f'<path d="M256,178 q-2,-34 -10,-46" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>',
        folha(248, 134, flip=-1),
        carinha(238, 292, 34, 292, blush="#ea6f85"),
    )


def maracuja() -> str:
    cor = "#6d4c8d"
    claro = "#9c6fb5"
    folhinha = "#79b851"
    return svg(
        sombra_ground(),
        f'<circle cx="256" cy="308" r="138" fill="{cor}" stroke="{INK}" stroke-width="7"/>',
        f'<path d="M256,196 a112,112 0 0,1 0,224 l0,-224 z" fill="{claro}" opacity=".35"/>',
        # talinho + folha
        f'<path d="M256,172 q4,-24 -6,-36" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>',
        f'<g transform="translate(258,140)"><path d="M0,0 q30,-8 46,-28 q-36,-2 -46,28 z" fill="{folhinha}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/></g>',
        # bochinho grande
        '<path d="M226,322 q30,26 60,0" ' + TRAZO + '/>',
        # carinha de olhos fechados felizes (^^)
        f'<path d="M204,290 q10,-16 20,0 M288,290 q10,-16 20,0" {TRAZO}/>',
        '<ellipse cx="184" cy="322" rx="12" ry="7" fill="#f3a4c8" opacity=".6"/>'
        '<ellipse cx="328" cy="322" rx="12" ry="7" fill="#f3a4c8" opacity=".6"/>',
    )


def coco() -> str:
    casca = "#795548"
    claro = "#a1887f"
    floco = "#efe6dc"
    return svg(
        sombra_ground(),
        f'<circle cx="256" cy="296" r="144" fill="{casca}" stroke="{INK}" stroke-width="7"/>',
        f'<path d="M256,152 a144,144 0 0,1 0,288 l0,-288 z" fill="{claro}" opacity=".45"/>',
        f'<circle cx="256" cy="296" r="112" fill="#5d4037" opacity=".35"/>',
        # três “furinhos”
        f'<ellipse cx="236" cy="256" rx="18" ry="24" fill="{floco}" stroke="{INK}" stroke-width="6"/>',
        f'<ellipse cx="290" cy="256" rx="18" ry="24" fill="{floco}" stroke="{INK}" stroke-width="6"/>',
        f'<ellipse cx="262" cy="316" rx="14" ry="18" fill="{floco}" stroke="{INK}" stroke-width="6"/>',
        # olhos dentro dos furinhos
        '<circle cx="236" cy="258" r="7" fill="#26202b"/><circle cx="290" cy="258" r="7" fill="#26202b"/>',
        '<circle cx="233" cy="255" r="3" fill="#ffffff"/><circle cx="287" cy="255" r="3" fill="#ffffff"/>',
        f'<path d="M244,330 q18,16 36,0" {TRAZO}/>',
        '<ellipse cx="196" cy="304" rx="12" ry="7" fill="#f3a4a4" opacity=".6"/>'
        '<ellipse cx="316" cy="304" rx="12" ry="7" fill="#f3a4a4" opacity=".6"/>',
        # atl topo capim
        f'<path d="M256,180 q0,-40 -14,-60 M256,180 q10,-30 30,-38" stroke="{INK}" stroke-width="8" fill="none" stroke-linecap="round"/>',
        folha(238, 108, escala=0.9, flip=-1),
    )


def goiaba() -> str:
    cor = "#f4a9a8"
    interno = "#ffcfd2"
    folhinha = "#79b851"
    return svg(
        sombra_ground(),
        f'<path d="M256,208 q14,-46 34,-58 q76,18 88,106 q12,86 -56,182 q-58,14 -116,-8 q-70,-92 -60,-170 q10,-78 72,-110 q22,12 38,26 z" fill="{cor}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>',
        # innnnerro rosado
        f'<path d="M256,238 q66,10 74,84 q8,72 -64,148 q-10,2 -20,0 q-72,-76 -64,-148 q8,-74 74,-84 z" fill="{interno}" opacity=".85"/>',
        # sementinhas
        "".join(f'<circle cx="{cx}" cy="{cy}" r="7" fill="#f9dd8f" stroke="{INK}" stroke-width="4"/>' for cx, cy in ((226, 320), (256, 344), (290, 316), (240, 376), (292, 372))),
        f'<path d="M256,208 q0,-40 -8,-56" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>',
        f'<g transform="translate(256,152)"><path d="M0,0 q36,-4 56,-28 q-44,0 -56,28 z" fill="{folhinha}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/></g>',
        carinha(238, 300, 34, 300, blush="#e56b8c"),
    )


# ============================================================
# RENDERIZAÇÃO
# ============================================================

PACOTES: dict[str, dict[str, callable]] = {
    "Fantasia": {"dragao": dragao, "dinossauro": dinossauro, "yeti": yeti, "alien": alien, "fantasma": fantasma, "monstro": monstro},
    "Frutas": {"manga": manga, "laranja": laranja, "limao": limao, "melao": melao, "kiwi": kiwi, "pessego": pessego, "maracuja": maracuja, "coco": coco, "goiaba": goiaba},
}


def render(svg_str: str, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["rsvg-convert", "-w", "512", "-h", "512", "-o", str(destino)], input=svg_str.encode(), check=True)


def main() -> None:
    total = 0
    for pacote, stickers in PACOTES.items():
        for nome, fn in stickers.items():
            out = ROOT / pacote / f"{nome}.png"
            render(fn(), out)
            total += 1
            print(f"  {out}")
    print(f"{total} novas figurinhas geradas")


if __name__ == "__main__":
    main()
