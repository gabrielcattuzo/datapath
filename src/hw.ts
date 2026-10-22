// Modelo do hardware. Cada função espelha um bloco do VHDL:
//   ula()          -> ula.vhd
//   controle()     -> controle_ula      (datapath_board.vhd)
//   avaliar()      -> parte combinacional do datapath
//   passo()        -> borda de subida com en = '1' (pc + banco_registradores)
//   saidasPlaca()  -> processo de seleção dos displays em datapath_board
//   HEX7SEG        -> hex7seg.vhd
// Sem DOM: pode rodar no Node (test/check.ts).

export const M16 = 0xffff;

export const s16 = (x: number): number => ((x & 0x8000) ? (x & M16) - 0x10000 : x & M16);
export const hex = (x: number, n = 4): string => (x >>> 0).toString(16).toUpperCase().padStart(n, "0");

// ---------------------------------------------------------------- ULA
export interface SaidaUla { r: number; zero: boolean; ovf: boolean; cout: boolean }

export const ULA_OPS = ["AND", "OR", "ADD", "XOR", "SUB", "SLL", "SLT", "NOR"] as const;

export function ula(a: number, b: number, ctl: number): SaidaUla {
  a &= M16; b &= M16;
  let r = 0, ovf = false, cout = false;
  switch (ctl & 7) {
    case 0: r = a & b; break;
    case 1: r = a | b; break;
    case 2: {
      const s = a + b;
      r = s & M16; cout = s > M16;
      ovf = ((a ^ b) & 0x8000) === 0 && ((a ^ r) & 0x8000) !== 0;
      break;
    }
    case 3: r = a ^ b; break;
    case 4: {                                   // A + not B + 1
      const s = a + (~b & M16) + 1;
      r = s & M16; cout = s > M16;
      ovf = ((a ^ b) & 0x8000) !== 0 && ((a ^ r) & 0x8000) !== 0;
      break;
    }
    case 5: r = (a << (b & 15)) & M16; break;
    case 6: r = s16(a) < s16(b) ? 1 : 0; break;
    default: r = ~(a | b) & M16;
  }
  return { r, zero: r === 0, ovf, cout };
}

// ------------------------------------------------------- controle_ula
export const FUNCTS = {
  add: { funct: 0b100000, ctl: 2 },
  sub: { funct: 0b100010, ctl: 4 },
  and: { funct: 0b100100, ctl: 0 },
  or:  { funct: 0b100101, ctl: 1 },
  xor: { funct: 0b100110, ctl: 3 },
  nor: { funct: 0b100111, ctl: 7 },
  slt: { funct: 0b101010, ctl: 6 },
} as const;
export type Mnem = keyof typeof FUNCTS;

export function mnemDoFunct(funct: number): Mnem | null {
  for (const k of Object.keys(FUNCTS) as Mnem[]) if (FUNCTS[k].funct === funct) return k;
  return null;
}

export function controle(opcode: number, funct: number): { ctl: number; regWrite: boolean } {
  const m = mnemDoFunct(funct);
  if (!m) return { ctl: 2, regWrite: false };           // when others: "010", valido = 0
  return { ctl: FUNCTS[m].ctl, regWrite: opcode === 0 };
}

// ------------------------------------------------------------ campos
export interface Campos { op: number; rs: number; rt: number; rd: number; shamt: number; funct: number }
export function campos(w: number): Campos {
  return {
    op: (w >>> 26) & 63, rs: (w >>> 21) & 31, rt: (w >>> 16) & 31,
    rd: (w >>> 11) & 31, shamt: (w >>> 6) & 31, funct: w & 63,
  };
}

// ------------------------------------------------------------ máquina
export interface Maquina {
  pc: number;                 // 16 bits, endereço em bytes
  regs: number[];             // 32 x 16 bits
  rom: number[];              // 16 x 32 bits
  inicial: number[];          // valores carregados no reset
}

export function novaMaquina(rom: number[], inicial: number[]): Maquina {
  const r = rom.slice(0, 16); while (r.length < 16) r.push(0);
  const ini = inicial.slice(0, 32).map(v => v & M16); while (ini.length < 32) ini.push(0);
  ini[0] = 0;
  return { pc: 0, regs: ini.slice(), rom: r.map(x => x >>> 0), inicial: ini };
}

export function reset(m: Maquina): void {
  m.pc = 0;
  m.regs = m.inicial.slice();
}

export interface Comb extends Campos, SaidaUla {
  pc: number; pc4: number; instr: number;
  a: number; b: number; ctl: number; regWrite: boolean;
}

export function avaliar(m: Maquina): Comb {
  const instr = m.rom[(m.pc >>> 2) & 15];
  const c = campos(instr);
  const { ctl, regWrite } = controle(c.op, c.funct);
  const a = m.regs[c.rs], b = m.regs[c.rt];
  return { ...c, ...ula(a, b, ctl), pc: m.pc, pc4: (m.pc + 4) & M16, instr, a, b, ctl, regWrite };
}

export interface Registro extends Comb { gravou: boolean }   // gravou = rd mudou de fato

export function passo(m: Maquina): Registro {
  const c = avaliar(m);
  const gravou = c.regWrite && c.rd !== 0;
  if (gravou) m.regs[c.rd] = c.r;
  m.pc = c.pc4;
  return { ...c, gravou };
}

// --------------------------------------------------------- hex7seg
// Ativo em nível baixo, bit 6..0 = g..a (igual ao hex7seg.vhd)
export const HEX7SEG = [
  0b1000000, 0b1111001, 0b0100100, 0b0110000, 0b0011001, 0b0010010, 0b0000010, 0b1111000,
  0b0000000, 0b0010000, 0b0001000, 0b0000011, 0b1000110, 0b0100001, 0b0000110, 0b0001110,
];

// ------------------------------------------------------ datapath_board
export interface Entradas { sw: number; key: [boolean, boolean, boolean, boolean] } // key[i] = apertado
export interface Saidas {
  hex: number[];        // hex[0..7] = HEX0..HEX7 (7 bits ativos em baixo)
  ledr: number;         // 18 bits
  ledg: number;         // 9 bits
  mostraReg: number;
  mostraValor: number;
  fonte: "instr" | "reg" | "rs" | "rt" | "rd";
}

// Chaves com função (as demais, SW12–5, ficam livres)
export const SW_VER_REG = 17, SW_AUTO = 16, SW_INSTR = 15, SW_VER_A = 14, SW_VER_B = 13;
export const AUTO_HZ = 2;   // clock automático: instruções por segundo com SW16 = 1

export function saidasPlaca(m: Maquina, e: Entradas): Saidas {
  const c = avaliar(m);
  const sw = (i: number) => ((e.sw >> i) & 1) === 1;
  let mostraReg: number, mostraValor: number, fonte: Saidas["fonte"];
  if (sw(SW_VER_REG))                { mostraReg = e.sw & 31; mostraValor = m.regs[mostraReg]; fonte = "reg"; }
  else if (e.key[2] || sw(SW_VER_A)) { mostraReg = c.rs; mostraValor = c.a; fonte = "rs"; }
  else if (e.key[3] || sw(SW_VER_B)) { mostraReg = c.rt; mostraValor = c.b; fonte = "rt"; }
  else                               { mostraReg = c.rd; mostraValor = c.r; fonte = "rd"; }
  let digitos = [
    mostraValor & 15, (mostraValor >> 4) & 15, (mostraValor >> 8) & 15, (mostraValor >> 12) & 15,
    mostraReg & 15, (mostraReg >> 4) & 15,
    c.pc & 15, (c.pc >> 4) & 15,
  ];
  if (sw(SW_INSTR)) {                // SW15 passa na frente: HEX7–0 = instrução inteira
    digitos = digitos.map((_, n) => (c.instr >>> (4 * n)) & 15);
    fonte = "instr";
  }
  const hexes = digitos.map(n => HEX7SEG[n]);
  const ledg = (c.zero ? 1 : 0) | (c.ovf ? 2 : 0) | (c.cout ? 4 : 0) | (c.regWrite ? 8 : 0) |
    ((c.r >> 15) & 1 ? 16 : 0) | (e.key[0] ? 256 : 0);                // LEDG4 = R[15] (Negativo)
  return { hex: hexes, ledr: c.instr & 0x3ffff, ledg, mostraReg, mostraValor, fonte };
}
