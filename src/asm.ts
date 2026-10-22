// Montador / desmontador das instruções tipo R e exportação para VHDL.
import { FUNCTS, Mnem, M16, campos, hex, mnemDoFunct, novaMaquina, passo, s16 } from "./hw";

const NOMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];

export const PROGRAMA_PADRAO = `# Valores iniciais do banco (o resto começa em 0)
$1 = 5
$2 = 7
$3 = -5
$4 = 12
$5 = 0x00F0
$6 = 0x0F0F
$7 = 0x7FFF
$8 = 1

# Programa (máximo 16 instruções): op rd, rs, rt
add $9,  $1, $2     # 5 + 7
sub $10, $1, $2     # 5 - 7, negativo
and $11, $5, $6     # Zero
or  $12, $5, $6
slt $13, $3, $4     # -5 < 12
slt $14, $4, $3     # 12 < -5 ? não
nor $15, $0, $0
add $16, $7, $8     # Overflow
sub $17, $1, $1     # Zero e Cout
add $18, $9, $10    # usa resultados gravados
xor $19, $5, $6
add $1,  $1, $1     # sobrescreve $1
add $0,  $1, $2     # $0 não muda
add $20, $0, $1
`;

export interface Erro { linha: number; msg: string }
export interface Montado { rom: number[]; inicial: number[]; usadas: number }

function lerReg(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (!t.startsWith("$")) return null;
  const n = t.slice(1);
  if (/^\d+$/.test(n)) { const v = Number(n); return v <= 31 ? v : null; }
  const i = NOMES.indexOf(n);
  return i >= 0 ? i : null;
}

function lerNumero(tok: string): number | null {
  const t = tok.trim().toLowerCase().replace(/_/g, "");
  let v: number;
  if (/^-?0x[0-9a-f]+$/.test(t)) v = t.startsWith("-") ? -parseInt(t.slice(3), 16) : parseInt(t.slice(2), 16);
  else if (/^-?0b[01]+$/.test(t)) v = t.startsWith("-") ? -parseInt(t.slice(3), 2) : parseInt(t.slice(2), 2);
  else if (/^-?\d+$/.test(t)) v = parseInt(t, 10);
  else return null;
  if (v < -32768 || v > 65535) return null;
  return v & M16;
}

export function codificar(m: Mnem, rd: number, rs: number, rt: number): number {
  return ((rs << 21) | (rt << 16) | (rd << 11) | FUNCTS[m].funct) >>> 0;
}

export function montar(texto: string): { ok: true; res: Montado } | { ok: false; erros: Erro[] } {
  const erros: Erro[] = [];
  const rom: number[] = [];
  const inicial = new Array(32).fill(0);
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = i + 1;
    const s = bruta.replace(/(#|--|\/\/).*$/, "").trim();
    if (!s) return;
    const atrib = s.match(/^(\$\w+)\s*=\s*(\S+)$/);
    if (atrib) {
      const r = lerReg(atrib[1]);
      const v = lerNumero(atrib[2]);
      if (r === null) erros.push({ linha, msg: `registrador inválido: ${atrib[1]}` });
      else if (r === 0) erros.push({ linha, msg: "$0 é sempre zero, não dá para iniciar" });
      else if (v === null) erros.push({ linha, msg: `valor inválido: ${atrib[2]} (use decimal, 0x… ou 0b…, 16 bits)` });
      else inicial[r] = v;
      return;
    }
    const m = s.match(/^([a-z]+)\b\s*(.*)$/i);
    const mn = m ? m[1].toLowerCase() : "";
    if (mn === "nop" && m && !m[2].trim()) { rom.push(0); return; }
    if (!m || !(mn in FUNCTS)) {
      erros.push({ linha, msg: `instrução desconhecida: "${s.split(/\s/)[0]}" (aceitas: add sub and or xor nor slt nop)` });
      return;
    }
    const ops = m[2].split(",").map(x => x.trim()).filter(Boolean);
    if (ops.length !== 3) { erros.push({ linha, msg: `${mn} precisa de 3 registradores: ${mn} rd, rs, rt` }); return; }
    const regs = ops.map(lerReg);
    const bad = regs.findIndex(r => r === null);
    if (bad >= 0) { erros.push({ linha, msg: `registrador inválido: ${ops[bad]}` }); return; }
    rom.push(codificar(mn as Mnem, regs[0]!, regs[1]!, regs[2]!));
  });
  if (rom.length > 16) erros.push({ linha: 0, msg: `${rom.length} instruções: a memória tem 16 palavras` });
  if (erros.length) return { ok: false, erros };
  const usadas = rom.length;
  while (rom.length < 16) rom.push(0);
  return { ok: true, res: { rom, inicial, usadas } };
}

export function desmontar(w: number): string {
  if (w === 0) return "nop";
  const c = campos(w);
  const m = c.op === 0 ? mnemDoFunct(c.funct) : null;
  if (!m) return `.word 0x${hex(w, 8)}`;
  return `${m} $${c.rd}, $${c.rs}, $${c.rt}`;
}

// ----------------------------------------------------------- VHDL
const pad = (s: string, n: number) => s.padEnd(n);
const bit = (b: boolean) => (b ? "'1'" : "'0'");

/** Gera os 3 blocos para colar no VHDL: ROM, INICIAL e ESPERADO/REGS_FINAL do testbench. */
export function paraVhdl(mo: Montado): { rom: string; inicial: string; tb: string } {
  // ROM (mem_instrucoes em datapath_board.vhd)
  const linhas: string[] = [];
  const n = mo.usadas;
  for (let i = 0; i < n; i++) {
    const w = mo.rom[i];
    const c = campos(w);
    const m = mnemDoFunct(c.funct);
    const pc = "0x" + hex(i * 4, 2);
    const code = w === 0 || !m
      ? `${i} => (others => '0'),`
      : `${i} => tipo_r(F_${m.toUpperCase()}, ${c.rd}, ${c.rs}, ${c.rt}),`;
    linhas.push(`    ${pad(code, 34)}-- ${pc}  ${desmontar(w)}`);
  }
  if (n < 16) linhas.push(`    others => (others => '0')        -- nop`);
  else linhas[n - 1] = linhas[n - 1].replace(/\),(\s+--)/, ") $1");
  const rom = `  constant ROM : rom_t := (\n${linhas.join("\n")}\n  );`;

  // INICIAL (banco_registradores)
  const ini: string[] = [];
  mo.inicial.forEach((v, r) => { if (r && v) ini.push(`    ${r} => x"${hex(v)}",   -- ${s16(v)}`); });
  ini.push(`    others => x"0000"`);
  const inicial = `  constant INICIAL : regs_t := (\n${ini.join("\n")}\n  );`;

  // ESPERADO + REGS_FINAL (datapath_tb): 16 passos gravando + 1 observado
  const mq = novaMaquina(mo.rom, mo.inicial);
  const pass: string[] = [];
  for (let i = 0; i < 17; i++) {
    const r = passo(mq);
    const flags = [r.zero, r.ovf, r.cout, r.regWrite].map(bit).join(",");
    const sep = i === 16 ? " " : ",";
    pass.push(`    (x"${hex(r.pc)}", x"${hex(r.r)}", ${flags})${sep}  -- ${desmontar(r.instr)}`);
  }
  // REGS_FINAL = estado após 16 passos: refaz sem o 17º
  const mf = novaMaquina(mo.rom, mo.inicial);
  for (let i = 0; i < 16; i++) passo(mf);
  const fin: string[] = [];
  mf.regs.forEach((v, r) => { if (v) fin.push(`${r} => x"${hex(v)}"`); });
  const finTxt: string[] = [];
  for (let i = 0; i < fin.length; i += 5) finTxt.push("    " + fin.slice(i, i + 5).join(", ") + ",");
  finTxt.push("    others => x\"0000\");");
  const tb =
    `  constant ESPERADO : passos_t := (\n${pass.join("\n")}\n  );\n\n` +
    `  constant REGS_FINAL : regs_t := (\n${finTxt.join("\n")}`;
  return { rom, inicial, tb };
}
