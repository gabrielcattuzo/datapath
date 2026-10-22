// test/check.ts
import { writeFileSync } from "node:fs";

// src/hw.ts
var M16 = 65535;
var s16 = (x) => x & 32768 ? (x & M16) - 65536 : x & M16;
var hex = (x, n = 4) => (x >>> 0).toString(16).toUpperCase().padStart(n, "0");
function ula(a, b, ctl) {
  a &= M16;
  b &= M16;
  let r = 0, ovf = false, cout = false;
  switch (ctl & 7) {
    case 0:
      r = a & b;
      break;
    case 1:
      r = a | b;
      break;
    case 2: {
      const s = a + b;
      r = s & M16;
      cout = s > M16;
      ovf = ((a ^ b) & 32768) === 0 && ((a ^ r) & 32768) !== 0;
      break;
    }
    case 3:
      r = a ^ b;
      break;
    case 4: {
      const s = a + (~b & M16) + 1;
      r = s & M16;
      cout = s > M16;
      ovf = ((a ^ b) & 32768) !== 0 && ((a ^ r) & 32768) !== 0;
      break;
    }
    case 5:
      r = a << (b & 15) & M16;
      break;
    case 6:
      r = s16(a) < s16(b) ? 1 : 0;
      break;
    default:
      r = ~(a | b) & M16;
  }
  return { r, zero: r === 0, ovf, cout };
}
var FUNCTS = {
  add: { funct: 32, ctl: 2 },
  sub: { funct: 34, ctl: 4 },
  and: { funct: 36, ctl: 0 },
  or: { funct: 37, ctl: 1 },
  xor: { funct: 38, ctl: 3 },
  nor: { funct: 39, ctl: 7 },
  slt: { funct: 42, ctl: 6 }
};
function mnemDoFunct(funct) {
  for (const k of Object.keys(FUNCTS)) if (FUNCTS[k].funct === funct) return k;
  return null;
}
function controle(opcode, funct) {
  const m2 = mnemDoFunct(funct);
  if (!m2) return { ctl: 2, regWrite: false };
  return { ctl: FUNCTS[m2].ctl, regWrite: opcode === 0 };
}
function campos(w) {
  return {
    op: w >>> 26 & 63,
    rs: w >>> 21 & 31,
    rt: w >>> 16 & 31,
    rd: w >>> 11 & 31,
    shamt: w >>> 6 & 31,
    funct: w & 63
  };
}
function novaMaquina(rom, inicial) {
  const r = rom.slice(0, 16);
  while (r.length < 16) r.push(0);
  const ini = inicial.slice(0, 32).map((v) => v & M16);
  while (ini.length < 32) ini.push(0);
  ini[0] = 0;
  return { pc: 0, regs: ini.slice(), rom: r.map((x) => x >>> 0), inicial: ini };
}
function avaliar(m2) {
  const instr = m2.rom[m2.pc >>> 2 & 15];
  const c = campos(instr);
  const { ctl, regWrite } = controle(c.op, c.funct);
  const a = m2.regs[c.rs], b = m2.regs[c.rt];
  return { ...c, ...ula(a, b, ctl), pc: m2.pc, pc4: m2.pc + 4 & M16, instr, a, b, ctl, regWrite };
}
function passo(m2) {
  const c = avaliar(m2);
  const gravou = c.regWrite && c.rd !== 0;
  if (gravou) m2.regs[c.rd] = c.r;
  m2.pc = c.pc4;
  return { ...c, gravou };
}
var HEX7SEG = [
  64,
  121,
  36,
  48,
  25,
  18,
  2,
  120,
  0,
  16,
  8,
  3,
  70,
  33,
  6,
  14
];
var SW_VER_REG = 17;
var SW_INSTR = 15;
var SW_VER_A = 14;
var SW_VER_B = 13;
function saidasPlaca(m2, e) {
  const c = avaliar(m2);
  const sw = (i) => (e.sw >> i & 1) === 1;
  let mostraReg, mostraValor, fonte;
  if (sw(SW_VER_REG)) {
    mostraReg = e.sw & 31;
    mostraValor = m2.regs[mostraReg];
    fonte = "reg";
  } else if (e.key[2] || sw(SW_VER_A)) {
    mostraReg = c.rs;
    mostraValor = c.a;
    fonte = "rs";
  } else if (e.key[3] || sw(SW_VER_B)) {
    mostraReg = c.rt;
    mostraValor = c.b;
    fonte = "rt";
  } else {
    mostraReg = c.rd;
    mostraValor = c.r;
    fonte = "rd";
  }
  let digitos = [
    mostraValor & 15,
    mostraValor >> 4 & 15,
    mostraValor >> 8 & 15,
    mostraValor >> 12 & 15,
    mostraReg & 15,
    mostraReg >> 4 & 15,
    c.pc & 15,
    c.pc >> 4 & 15
  ];
  if (sw(SW_INSTR)) {
    digitos = digitos.map((_, n) => c.instr >>> 4 * n & 15);
    fonte = "instr";
  }
  const hexes = digitos.map((n) => HEX7SEG[n]);
  const ledg = (c.zero ? 1 : 0) | (c.ovf ? 2 : 0) | (c.cout ? 4 : 0) | (c.regWrite ? 8 : 0) | (c.r >> 15 & 1 ? 16 : 0) | (e.key[0] ? 256 : 0);
  return { hex: hexes, ledr: c.instr & 262143, ledg, mostraReg, mostraValor, fonte };
}

// src/asm.ts
var NOMES = [
  "zero",
  "at",
  "v0",
  "v1",
  "a0",
  "a1",
  "a2",
  "a3",
  "t0",
  "t1",
  "t2",
  "t3",
  "t4",
  "t5",
  "t6",
  "t7",
  "s0",
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "t8",
  "t9",
  "k0",
  "k1",
  "gp",
  "sp",
  "fp",
  "ra"
];
var PROGRAMA_PADRAO = `# Valores iniciais do banco (o resto come\xE7a em 0)
$1 = 5
$2 = 7
$3 = -5
$4 = 12
$5 = 0x00F0
$6 = 0x0F0F
$7 = 0x7FFF
$8 = 1

# Programa (m\xE1ximo 16 instru\xE7\xF5es): op rd, rs, rt
add $9,  $1, $2     # 5 + 7
sub $10, $1, $2     # 5 - 7, negativo
and $11, $5, $6     # Zero
or  $12, $5, $6
slt $13, $3, $4     # -5 < 12
slt $14, $4, $3     # 12 < -5 ? n\xE3o
nor $15, $0, $0
add $16, $7, $8     # Overflow
sub $17, $1, $1     # Zero e Cout
add $18, $9, $10    # usa resultados gravados
xor $19, $5, $6
add $1,  $1, $1     # sobrescreve $1
add $0,  $1, $2     # $0 n\xE3o muda
add $20, $0, $1
`;
function lerReg(tok) {
  const t = tok.trim().toLowerCase();
  if (!t.startsWith("$")) return null;
  const n = t.slice(1);
  if (/^\d+$/.test(n)) {
    const v = Number(n);
    return v <= 31 ? v : null;
  }
  const i = NOMES.indexOf(n);
  return i >= 0 ? i : null;
}
function lerNumero(tok) {
  const t = tok.trim().toLowerCase().replace(/_/g, "");
  let v;
  if (/^-?0x[0-9a-f]+$/.test(t)) v = t.startsWith("-") ? -parseInt(t.slice(3), 16) : parseInt(t.slice(2), 16);
  else if (/^-?0b[01]+$/.test(t)) v = t.startsWith("-") ? -parseInt(t.slice(3), 2) : parseInt(t.slice(2), 2);
  else if (/^-?\d+$/.test(t)) v = parseInt(t, 10);
  else return null;
  if (v < -32768 || v > 65535) return null;
  return v & M16;
}
function codificar(m2, rd, rs, rt) {
  return (rs << 21 | rt << 16 | rd << 11 | FUNCTS[m2].funct) >>> 0;
}
function montar(texto) {
  const erros = [];
  const rom = [];
  const inicial = new Array(32).fill(0);
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = i + 1;
    const s = bruta.replace(/(#|--|\/\/).*$/, "").trim();
    if (!s) return;
    const atrib = s.match(/^(\$\w+)\s*=\s*(\S+)$/);
    if (atrib) {
      const r = lerReg(atrib[1]);
      const v = lerNumero(atrib[2]);
      if (r === null) erros.push({ linha, msg: `registrador inv\xE1lido: ${atrib[1]}` });
      else if (r === 0) erros.push({ linha, msg: "$0 \xE9 sempre zero, n\xE3o d\xE1 para iniciar" });
      else if (v === null) erros.push({ linha, msg: `valor inv\xE1lido: ${atrib[2]} (use decimal, 0x\u2026 ou 0b\u2026, 16 bits)` });
      else inicial[r] = v;
      return;
    }
    const m2 = s.match(/^([a-z]+)\b\s*(.*)$/i);
    const mn = m2 ? m2[1].toLowerCase() : "";
    if (mn === "nop" && m2 && !m2[2].trim()) {
      rom.push(0);
      return;
    }
    if (!m2 || !(mn in FUNCTS)) {
      erros.push({ linha, msg: `instru\xE7\xE3o desconhecida: "${s.split(/\s/)[0]}" (aceitas: add sub and or xor nor slt nop)` });
      return;
    }
    const ops = m2[2].split(",").map((x) => x.trim()).filter(Boolean);
    if (ops.length !== 3) {
      erros.push({ linha, msg: `${mn} precisa de 3 registradores: ${mn} rd, rs, rt` });
      return;
    }
    const regs = ops.map(lerReg);
    const bad = regs.findIndex((r) => r === null);
    if (bad >= 0) {
      erros.push({ linha, msg: `registrador inv\xE1lido: ${ops[bad]}` });
      return;
    }
    rom.push(codificar(mn, regs[0], regs[1], regs[2]));
  });
  if (rom.length > 16) erros.push({ linha: 0, msg: `${rom.length} instru\xE7\xF5es: a mem\xF3ria tem 16 palavras` });
  if (erros.length) return { ok: false, erros };
  const usadas = rom.length;
  while (rom.length < 16) rom.push(0);
  return { ok: true, res: { rom, inicial, usadas } };
}
function desmontar(w) {
  if (w === 0) return "nop";
  const c = campos(w);
  const m2 = c.op === 0 ? mnemDoFunct(c.funct) : null;
  if (!m2) return `.word 0x${hex(w, 8)}`;
  return `${m2} $${c.rd}, $${c.rs}, $${c.rt}`;
}
var pad = (s, n) => s.padEnd(n);
var bit = (b) => b ? "'1'" : "'0'";
function paraVhdl(mo) {
  const linhas = [];
  const n = mo.usadas;
  for (let i = 0; i < n; i++) {
    const w = mo.rom[i];
    const c = campos(w);
    const m2 = mnemDoFunct(c.funct);
    const pc = "0x" + hex(i * 4, 2);
    const code = w === 0 || !m2 ? `${i} => (others => '0'),` : `${i} => tipo_r(F_${m2.toUpperCase()}, ${c.rd}, ${c.rs}, ${c.rt}),`;
    linhas.push(`    ${pad(code, 34)}-- ${pc}  ${desmontar(w)}`);
  }
  if (n < 16) linhas.push(`    others => (others => '0')        -- nop`);
  else linhas[n - 1] = linhas[n - 1].replace(/\),(\s+--)/, ") $1");
  const rom = `  constant ROM : rom_t := (
${linhas.join("\n")}
  );`;
  const ini = [];
  mo.inicial.forEach((v, r) => {
    if (r && v) ini.push(`    ${r} => x"${hex(v)}",   -- ${s16(v)}`);
  });
  ini.push(`    others => x"0000"`);
  const inicial = `  constant INICIAL : regs_t := (
${ini.join("\n")}
  );`;
  const mq = novaMaquina(mo.rom, mo.inicial);
  const pass = [];
  for (let i = 0; i < 17; i++) {
    const r = passo(mq);
    const flags = [r.zero, r.ovf, r.cout, r.regWrite].map(bit).join(",");
    const sep = i === 16 ? " " : ",";
    pass.push(`    (x"${hex(r.pc)}", x"${hex(r.r)}", ${flags})${sep}  -- ${desmontar(r.instr)}`);
  }
  const mf = novaMaquina(mo.rom, mo.inicial);
  for (let i = 0; i < 16; i++) passo(mf);
  const fin = [];
  mf.regs.forEach((v, r) => {
    if (v) fin.push(`${r} => x"${hex(v)}"`);
  });
  const finTxt = [];
  for (let i = 0; i < fin.length; i += 5) finTxt.push("    " + fin.slice(i, i + 5).join(", ") + ",");
  finTxt.push('    others => x"0000");');
  const tb = `  constant ESPERADO : passos_t := (
${pass.join("\n")}
  );

  constant REGS_FINAL : regs_t := (
${finTxt.join("\n")}`;
  return { rom, inicial, tb };
}

// test/check.ts
var falhas = 0;
var ok = (cond, msg) => {
  if (!cond) {
    falhas++;
    console.error("FALHOU:", msg);
  }
};
var GHDL = [
  // pc, R, Z, V, C, W  (copiado da saída do GHDL)
  [0, 12, 0, 0, 0, 1],
  [4, 65534, 0, 0, 0, 1],
  [8, 0, 1, 0, 0, 1],
  [12, 4095, 0, 0, 0, 1],
  [16, 1, 0, 0, 0, 1],
  [20, 0, 1, 0, 0, 1],
  [24, 65535, 0, 0, 0, 1],
  [28, 32768, 0, 1, 0, 1],
  [32, 0, 1, 0, 1, 1],
  [36, 10, 0, 0, 1, 1],
  [40, 4095, 0, 0, 0, 1],
  [44, 10, 0, 0, 0, 1],
  [48, 17, 0, 0, 0, 1],
  [52, 10, 0, 0, 0, 1],
  [56, 0, 1, 0, 0, 0],
  [60, 0, 1, 0, 0, 0],
  [64, 17, 0, 0, 0, 1]
];
var GHDL_INSTR = [
  "00224820",
  "00225022",
  "00A65824",
  "00A66025",
  "0064682A",
  "0083702A",
  "00007827",
  "00E88020",
  "00218822",
  "012A9020",
  "00A69826",
  "00210820",
  "00220020",
  "0001A020"
];
var REGS_FINAL = {
  1: 10,
  2: 7,
  3: 65531,
  4: 12,
  5: 240,
  6: 3855,
  7: 32767,
  8: 1,
  9: 12,
  10: 65534,
  11: 0,
  12: 4095,
  13: 1,
  14: 0,
  15: 65535,
  16: 32768,
  17: 0,
  18: 10,
  19: 4095,
  20: 10
};
var mt = montar(PROGRAMA_PADRAO);
if (!mt.ok) throw new Error("programa padr\xE3o n\xE3o monta: " + JSON.stringify(mt.erros));
GHDL_INSTR.forEach((h, i) => ok(hex(mt.res.rom[i], 8) === h, `palavra ${i}: ${hex(mt.res.rom[i], 8)} != ${h}`));
var m = novaMaquina(mt.res.rom, mt.res.inicial);
for (let i = 0; i < 16; i++) {
  const r = passo(m);
  const [pc, R, z, v, c, w] = GHDL[i];
  ok(
    r.pc === pc && r.r === R && +r.zero === z && +r.ovf === v && +r.cout === c && +r.regWrite === w,
    `passo ${i}: PC=${hex(r.pc)} R=${hex(r.r)} Z${+r.zero} V${+r.ovf} C${+r.cout} W${+r.regWrite}`
  );
}
for (let r = 0; r < 32; r++) ok(m.regs[r] === (REGS_FINAL[r] ?? 0), `$${r} = ${hex(m.regs[r])}`);
{
  const mm = novaMaquina(mt.res.rom, mt.res.inicial);
  for (let i = 0; i < 16; i++) passo(mm);
  const r = passo(mm);
  ok(r.pc === 64 && r.r === 17, "passo 16 (PC 0x40)");
}
{
  const mm = novaMaquina(mt.res.rom, mt.res.inicial);
  let o = saidasPlaca(mm, { sw: 0, key: [false, false, false, false] });
  ok(o.hex[0] === HEX7SEG[12] && o.hex[1] === HEX7SEG[0] && o.hex[6] === HEX7SEG[0], "HEX inicial 000C / PC 00");
  passo(mm);
  o = saidasPlaca(mm, { sw: 0, key: [false, false, false, false] });
  ok(o.hex[6] === 25 && o.mostraValor === 65534, "ap\xF3s 1 passo: PC 04, R FFFE");
  passo(mm);
  o = saidasPlaca(mm, { sw: 1 << 17 | 10, key: [false, false, false, false] });
  ok(o.mostraValor === 65534 && o.hex[4] === 8 && (o.ledg & 1) === 1, "SW17 + $10 = FFFE, HEX4 = A, Zero");
  o = saidasPlaca(mm, { sw: 0, key: [false, false, true, false] });
  ok(o.mostraValor === 240 && o.mostraReg === 5, "KEY2 mostra rs");
  for (let i = 0; i < 5; i++) passo(mm);
  o = saidasPlaca(mm, { sw: 0, key: [false, false, false, false] });
  ok(o.mostraValor === 32768 && (o.ledg & 18) === 18, "LEDG4 (Negativo) e LEDG1 (Overflow) em 0x8000");
  o = saidasPlaca(mm, { sw: 1 << 15, key: [false, false, false, false] });
  ok(o.fonte === "instr" && [0, 2, 0, 8, 8, 14, 0, 0].every((d, n) => o.hex[n] === HEX7SEG[d]), "SW15 mostra 00E88020");
  o = saidasPlaca(mm, { sw: 1 << 15 | 1 << 17 | 1, key: [false, false, false, false] });
  ok(o.fonte === "instr", "SW15 passa na frente do SW17");
  o = saidasPlaca(mm, { sw: 1 << 14, key: [false, false, false, false] });
  ok(o.fonte === "rs" && o.mostraValor === 32767 && o.mostraReg === 7, "SW14 mostra A = $7");
  o = saidasPlaca(mm, { sw: 1 << 13, key: [false, false, false, false] });
  ok(o.fonte === "rt" && o.mostraValor === 1 && o.mostraReg === 8, "SW13 mostra B = $8");
  o = saidasPlaca(mm, { sw: 1 << 16, key: [false, false, false, false] });
  ok(o.fonte === "rd" && o.mostraValor === 32768, "SW16 n\xE3o muda os displays");
}
ok(ula(65531, 12, 2).r === 7 && ula(65531, 12, 2).cout, "-5 + 12");
ok(ula(5, 7, 4).r === 65534 && !ula(5, 7, 4).cout, "5 - 7");
ok(ula(32768, 1, 4).ovf, "overflow na sub");
ok(ula(1, 4, 5).r === 16, "sll");
console.log(falhas ? `${falhas} falha(s)` : "modelo TS = simula\xE7\xE3o VHDL: OK");
var destino = process.argv[2];
if (destino) {
  let seed = 12345;
  const rnd = (n) => {
    seed = seed * 1103515245 + 12345 & 2147483647;
    return seed % n;
  };
  const mns = Object.keys(FUNCTS);
  const casos = [];
  for (let k = 0; k < 12; k++) {
    const n = 1 + rnd(16);
    const rom = [];
    const reg = () => rnd(4) === 0 ? rnd(32) : rnd(10);
    for (let i = 0; i < n; i++) rom.push(rnd(9) === 0 ? 0 : codificar(mns[rnd(mns.length)], reg(), reg(), reg()));
    while (rom.length < 16) rom.push(0);
    const especiais = [32767, 32768, 65535, 1, 0, 240, 21845, 43690];
    const inicial = Array.from({ length: 32 }, (_, r) => r === 0 ? 0 : rnd(3) === 0 ? especiais[rnd(especiais.length)] : rnd(65536));
    casos.push(paraVhdl({ rom, inicial, usadas: n }));
  }
  writeFileSync(destino, JSON.stringify(casos));
  console.log(`${casos.length} casos aleat\xF3rios em ${destino}`);
}
process.exit(falhas ? 1 : 0);
