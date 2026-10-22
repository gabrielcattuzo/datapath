// Monta a DE2-115 no DOM e pinta as saídas.
// Só aparece aceso o que o datapath_board.vhd realmente liga.
import { FUNCTS, Mnem, Saidas } from "./hw";

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, txt?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
const at = (e: HTMLElement, col: string, row: string) => { e.style.gridColumn = col; e.style.gridRow = row; return e; };

// ------------------------------------------------------- 7 segmentos
// Mesmo desenho do simulador da ULA. Bit 0 = a … bit 6 = g.
const T = 8, G = 1.6, X1 = 8, X2 = 44, Y1 = 8, YM = 48, Y2 = 88, h = T / 2;
const hseg = (y: number, a: number, b: number) => `${a},${y} ${a + h},${y - h} ${b - h},${y - h} ${b},${y} ${b - h},${y + h} ${a + h},${y + h}`;
const vseg = (x: number, a: number, b: number) => `${x},${a} ${x + h},${a + h} ${x + h},${b - h} ${x},${b} ${x - h},${b - h} ${x - h},${a + h}`;
const POLYS = [
  hseg(Y1, X1 + G, X2 - G), vseg(X2, Y1 + G, YM - G), vseg(X2, YM + G, Y2 - G), hseg(Y2, X1 + G, X2 - G),
  vseg(X1, YM + G, Y2 - G), vseg(X1, Y1 + G, YM - G), hseg(YM, X1 + G, X2 - G),
];
const SEG_SVG = '<svg viewBox="0 0 64 96" aria-hidden="true"><g transform="translate(9 0) skewX(-6)">' +
  POLYS.map(p => `<polygon class="s" points="${p}"/>`).join("") +
  '<circle class="s dp" cx="54" cy="88" r="4.2"/></g></svg>';

// ------------------------------------------------------- legendas
const DIGIT_COL: Record<number, number> = { 7: 1, 6: 2, 5: 4, 4: 5, 3: 7, 2: 8, 1: 9, 0: 10 };

const LEDG: Record<number, { fn: string; tip: string }> = {
  8: { fn: "Clk", tip: "KEY0 apertado (já filtrado)" },
  4: { fn: "Neg", tip: "Negativo, R[15]" },
  3: { fn: "Wr", tip: "RegWrite" },
  2: { fn: "Cout", tip: "Carry-out" },
  1: { fn: "Ovf", tip: "Overflow" },
  0: { fn: "Zero", tip: "Zero" },
};

const KEYS: Record<number, { fn: string; desc: string }> = {
  3: { fn: "Ver B", desc: "segure para ver o operando B (rt)" },
  2: { fn: "Ver A", desc: "segure para ver o operando A (rs)" },
  1: { fn: "Reset", desc: "reset: PC e registradores voltam ao início" },
  0: { fn: "Passo", desc: "executa uma instrução" },
};

// grupos acima dos LEDR (campos da instrução) e abaixo das chaves
const LEDR_CAMPOS = [{ t: "rt[1:0]", hi: 17, lo: 16 }, { t: "rd", hi: 15, lo: 11 }, { t: "shamt", hi: 10, lo: 6 }, { t: "funct", hi: 5, lo: 0 }];
const SW_GRUPOS = [
  { t: "Ver", s: "reg", hi: 17, lo: 17, dim: false },
  { t: "Livres", s: "SW16–5", hi: 16, lo: 5, dim: true },
  { t: "Nº reg", s: "SW4–0", hi: 4, lo: 0, dim: false },
];
const colDe = (i: number) => 18 - i;                        // SW17 na coluna 1
const span = (hi: number, lo: number) => `${colDe(hi)} / ${colDe(lo) + 1}`;
const swDesc = (i: number) => i === 17 ? "liga o modo ver registrador" : i <= 4 ? `bit ${i} do número do registrador` : "não usada";

const FX: Record<Mnem, string> = {
  add: "A + B", sub: "A − B", and: "A and B", or: "A or B", xor: "A xor B", nor: "not(A or B)", slt: "A < B ? 1 : 0",
};

const ROTULO: Record<Saidas["fonte"], [string, string]> = {
  rd: ["Reg rd", "Resultado da ULA"],
  rs: ["Reg rs", "A · dado de rs (KEY2)"],
  rt: ["Reg rt", "B · dado de rt (KEY3)"],
  reg: ["Reg · SW4–0", "Valor do registrador (SW17)"],
};

export interface Handlers {
  alternaSw(i: number): void;
  key(i: number, apertado: boolean): void;
  power(): boolean;
}

export interface Placa { pintar(o: Saidas | null, sw: number, keys: boolean[]): void }

export function montarPlaca(cb: Handlers): Placa {
  const segs: SVGElement[][] = [];
  const ledr: HTMLElement[] = [], ledg: HTMLElement[] = [], swBtn: HTMLButtonElement[] = [], keyBtn: HTMLButtonElement[] = [];

  /* displays */
  const hexGrid = $("#hexGrid");
  const hexLbl = [mk("div", "grp top silk", "PC"), mk("div", "grp top silk"), mk("div", "grp top silk")];
  at(hexLbl[0], "1 / 3", "1"); at(hexLbl[1], "4 / 6", "1"); at(hexLbl[2], "7 / 11", "1");
  hexGrid.append(...hexLbl);
  for (const n of [7, 6, 5, 4, 3, 2, 1, 0]) {
    const d = at(mk("div", "digit"), String(DIGIT_COL[n]), "2");
    d.innerHTML = SEG_SVG;
    segs[n] = Array.from(d.querySelectorAll<SVGElement>(".s:not(.dp)"));
    hexGrid.append(d, at(mk("span", "silk n", "HEX" + n), String(DIGIT_COL[n]), "3"));
  }

  /* tabela funct -> ULACtl em silkscreen */
  const mns = Object.keys(FUNCTS) as Mnem[];
  const linha = (a: string, b: string, c: string, d: string, cls = "ot-row") => {
    const r = mk("div", cls);
    r.append(mk("span", "code", a), mk("span", "mn", b), mk("span", "code", c), mk("span", "fx", d));
    return r;
  };
  $("#otCol0").append(linha("funct", "op", "ctl", "ULA", "ot-row h"));
  $("#otCol1").append(linha("funct", "op", "ctl", "ULA", "ot-row h"));
  mns.forEach((m, i) => {
    const f = FUNCTS[m];
    $(i < 4 ? "#otCol0" : "#otCol1").append(linha(f.funct.toString(2).padStart(6, "0"), m.toUpperCase(), f.ctl.toString(2).padStart(3, "0"), FX[m]));
  });
  $("#otCol1").append(linha("outro", "NOP", "—", "RegWrite = 0"));

  /* LEDs verdes */
  const ledgGrid = $("#ledgGrid");
  ledgGrid.append(at(mk("div", "grp top silk", "KEY0"), "1 / 2", "1"), at(mk("div", "grp top silk", "ULA · controle"), "5 / 10", "1"));
  for (let g = 8; g >= 0; g--) {
    const col = String(9 - g), info = LEDG[g];
    const led = at(mk("span", "led g"), col, "2");
    led.title = `LEDG${g} · ${info ? info.tip : "não usado"}`;
    ledg[g] = led;
    ledgGrid.append(led, at(mk("span", "silk n", "G" + g), col, "3"), at(mk("span", "silk fn" + (info ? "" : " dim"), info ? info.fn : "—"), col, "4"));
  }

  /* LEDR + chaves numa grade de 18 colunas */
  const swGrid = $("#swGrid");
  for (const c of LEDR_CAMPOS) swGrid.append(at(mk("div", "grp top silk", c.t), span(c.hi, c.lo), "1"));
  for (let i = 17; i >= 0; i--) {
    const col = String(colDe(i));
    const led = at(mk("span", "led r"), col, "2");
    led.title = `LEDR${i} · bit ${i} da instrução`;
    const b = at(mk("button", "sw"), col, "3") as HTMLButtonElement;
    b.type = "button"; b.id = "sw" + i;
    b.setAttribute("aria-label", `SW${i}, ${swDesc(i)}`);
    b.setAttribute("aria-pressed", "false");
    b.append(mk("span", "lever"));
    b.addEventListener("click", () => cb.alternaSw(i));
    ledr[i] = led; swBtn[i] = b;
    swGrid.append(led, b, at(mk("span", "silk n", "SW" + i), col, "4"));
  }
  for (const g of SW_GRUPOS) {
    const l = at(mk("div", "grp bot silk" + (g.dim ? " dimgrp" : ""), g.t), span(g.hi, g.lo), "5");
    l.append(mk("small", undefined, g.s));
    swGrid.append(l);
  }

  /* botões KEY (momentâneos) */
  const keysWrap = $("#keys");
  for (const k of [3, 2, 1, 0]) {
    const c = mk("div", "keycomp");
    const b = mk("button", "key");
    b.type = "button"; b.id = "key" + k;
    b.setAttribute("aria-label", `KEY${k}, ${KEYS[k].desc}`);
    b.append(mk("span", "cap"));
    let down = false;
    const press = () => { if (down) return; down = true; cb.key(k, true); };
    const release = () => { if (!down) return; down = false; cb.key(k, false); };
    b.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      try { b.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }
      press();
    });
    b.addEventListener("pointerup", release);
    b.addEventListener("pointercancel", release);
    b.addEventListener("lostpointercapture", release);
    b.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); e.stopPropagation(); press(); } });
    b.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); release(); } });
    b.addEventListener("blur", release);
    keyBtn[k] = b;
    c.append(b, mk("span", "silk n", "KEY" + k), mk("span", "silk fn", KEYS[k].fn));
    keysWrap.append(c);
  }

  /* energia */
  const powerBtn = $("#power");
  powerBtn.addEventListener("click", () => {
    const on = cb.power();
    powerBtn.setAttribute("aria-pressed", String(on));
    powerBtn.setAttribute("aria-label", on ? "Botão de energia: desligar a placa" : "Botão de energia: ligar a placa");
  });
  const boardEl = $("#board"), pwrLed = $("#pwrLed");

  return {
    pintar(o, sw, keys) {
      const on = o !== null;
      boardEl.classList.toggle("is-off", !on);
      pwrLed.classList.toggle("on", on);
      for (let n = 0; n < 8; n++) {
        const code = on ? o!.hex[n] : 0x7f;
        segs[n].forEach((el, s) => el.classList.toggle("on", ((code >> s) & 1) === 0));   // ativo em 0
      }
      for (let i = 0; i < 18; i++) ledr[i].classList.toggle("on", on && ((o!.ledr >> i) & 1) === 1);
      for (let g = 0; g < 9; g++) ledg[g].classList.toggle("on", on && ((o!.ledg >> g) & 1) === 1);
      for (let i = 0; i < 18; i++) swBtn[i].setAttribute("aria-pressed", String(((sw >> i) & 1) === 1));
      for (let k = 0; k < 4; k++) keyBtn[k].classList.toggle("down", keys[k]);
      const [a, b] = ROTULO[on ? o!.fonte : "rd"];
      hexLbl[1].textContent = a;
      hexLbl[2].textContent = b;
    },
  };
}
