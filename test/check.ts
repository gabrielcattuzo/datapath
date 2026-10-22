// Confere o modelo TS contra o resultado da simulação VHDL (GHDL).
// node dist/test.js            -> roda o programa do lab e compara
// node dist/test.js casos.json -> também gera programas aleatórios para comparar no GHDL
import { writeFileSync } from "node:fs";
import { HEX7SEG, hex, novaMaquina, passo, saidasPlaca, ula } from "../src/hw";
import { PROGRAMA_PADRAO, codificar, montar, paraVhdl } from "../src/asm";
import { FUNCTS, Mnem } from "../src/hw";

let falhas = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { falhas++; console.error("FALHOU:", msg); } };

// 1) programa do lab: mesmos valores do datapath_tb (que passou no GHDL)
const GHDL = [ // pc, R, Z, V, C, W  (copiado da saída do GHDL)
  [0x00, 0x000C, 0, 0, 0, 1], [0x04, 0xFFFE, 0, 0, 0, 1], [0x08, 0x0000, 1, 0, 0, 1], [0x0C, 0x0FFF, 0, 0, 0, 1],
  [0x10, 0x0001, 0, 0, 0, 1], [0x14, 0x0000, 1, 0, 0, 1], [0x18, 0xFFFF, 0, 0, 0, 1], [0x1C, 0x8000, 0, 1, 0, 1],
  [0x20, 0x0000, 1, 0, 1, 1], [0x24, 0x000A, 0, 0, 1, 1], [0x28, 0x0FFF, 0, 0, 0, 1], [0x2C, 0x000A, 0, 0, 0, 1],
  [0x30, 0x0011, 0, 0, 0, 1], [0x34, 0x000A, 0, 0, 0, 1], [0x38, 0x0000, 1, 0, 0, 0], [0x3C, 0x0000, 1, 0, 0, 0],
  [0x40, 0x0011, 0, 0, 0, 1],
];
const GHDL_INSTR = ["00224820", "00225022", "00A65824", "00A66025", "0064682A", "0083702A", "00007827", "00E88020",
  "00218822", "012A9020", "00A69826", "00210820", "00220020", "0001A020"];
const REGS_FINAL: Record<number, number> = { 1: 0x000A, 2: 7, 3: 0xFFFB, 4: 0x000C, 5: 0x00F0, 6: 0x0F0F, 7: 0x7FFF, 8: 1,
  9: 0x000C, 10: 0xFFFE, 11: 0, 12: 0x0FFF, 13: 1, 14: 0, 15: 0xFFFF, 16: 0x8000, 17: 0, 18: 0x000A, 19: 0x0FFF, 20: 0x000A };

const mt = montar(PROGRAMA_PADRAO);
if (!mt.ok) throw new Error("programa padrão não monta: " + JSON.stringify(mt.erros));
GHDL_INSTR.forEach((h, i) => ok(hex(mt.res.rom[i], 8) === h, `palavra ${i}: ${hex(mt.res.rom[i], 8)} != ${h}`));
const m = novaMaquina(mt.res.rom, mt.res.inicial);
for (let i = 0; i < 16; i++) {
  const r = passo(m);
  const [pc, R, z, v, c, w] = GHDL[i];
  ok(r.pc === pc && r.r === R && +r.zero === z && +r.ovf === v && +r.cout === c && +r.regWrite === w,
    `passo ${i}: PC=${hex(r.pc)} R=${hex(r.r)} Z${+r.zero} V${+r.ovf} C${+r.cout} W${+r.regWrite}`);
}
for (let r = 0; r < 32; r++) ok(m.regs[r] === (REGS_FINAL[r] ?? 0), `$${r} = ${hex(m.regs[r])}`);
// passo 16 (observado)
{
  const mm = novaMaquina(mt.res.rom, mt.res.inicial); for (let i = 0; i < 16; i++) passo(mm);
  const r = passo(mm); ok(r.pc === 0x40 && r.r === 0x11, "passo 16 (PC 0x40)");
}

// 2) displays: mesmo mapeamento do datapath_board (verificado no placa_tb do GHDL)
{
  const mm = novaMaquina(mt.res.rom, mt.res.inicial);
  let o = saidasPlaca(mm, { sw: 0, key: [false, false, false, false] });
  ok(o.hex[0] === HEX7SEG[0xC] && o.hex[1] === HEX7SEG[0] && o.hex[6] === HEX7SEG[0], "HEX inicial 000C / PC 00");
  passo(mm);
  o = saidasPlaca(mm, { sw: 0, key: [false, false, false, false] });
  ok(o.hex[6] === 0b0011001 && o.mostraValor === 0xFFFE, "após 1 passo: PC 04, R FFFE");
  passo(mm);
  o = saidasPlaca(mm, { sw: (1 << 17) | 10, key: [false, false, false, false] });
  ok(o.mostraValor === 0xFFFE && o.hex[4] === 0b0001000 && (o.ledg & 1) === 1, "SW17 + $10 = FFFE, HEX4 = A, Zero");
  o = saidasPlaca(mm, { sw: 0, key: [false, false, true, false] });
  ok(o.mostraValor === 0x00F0 && o.mostraReg === 5, "KEY2 mostra rs");
  for (let i = 0; i < 5; i++) passo(mm);                        // PC 0x1C: add $16 = 0x8000
  o = saidasPlaca(mm, { sw: 0, key: [false, false, false, false] });
  ok(o.mostraValor === 0x8000 && (o.ledg & 0x12) === 0x12, "LEDG4 (Negativo) e LEDG1 (Overflow) em 0x8000");
}

// 3) ULA: casos do Lab 04
ok(ula(0xFFFB, 12, 2).r === 7 && ula(0xFFFB, 12, 2).cout, "-5 + 12");
ok(ula(5, 7, 4).r === 0xFFFE && !ula(5, 7, 4).cout, "5 - 7");
ok(ula(0x8000, 1, 4).ovf, "overflow na sub");
ok(ula(1, 4, 5).r === 16, "sll");

console.log(falhas ? `${falhas} falha(s)` : "modelo TS = simulação VHDL: OK");

// 4) casos aleatórios para o GHDL
const destino = process.argv[2];
if (destino) {
  let seed = 12345;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const mns = Object.keys(FUNCTS) as Mnem[];
  const casos = [];
  for (let k = 0; k < 12; k++) {
    const n = 1 + rnd(16);
    const rom: number[] = [];
    const reg = () => (rnd(4) === 0 ? rnd(32) : rnd(10));
    for (let i = 0; i < n; i++) rom.push(rnd(9) === 0 ? 0 : codificar(mns[rnd(mns.length)], reg(), reg(), reg()));
    while (rom.length < 16) rom.push(0);
    const especiais = [0x7FFF, 0x8000, 0xFFFF, 1, 0, 0x00F0, 0x5555, 0xAAAA];
    const inicial = Array.from({ length: 32 }, (_, r) => (r === 0 ? 0 : rnd(3) === 0 ? especiais[rnd(especiais.length)] : rnd(0x10000)));
    casos.push(paraVhdl({ rom, inicial, usadas: n }));
  }
  writeFileSync(destino, JSON.stringify(casos));
  console.log(`${casos.length} casos aleatórios em ${destino}`);
}
process.exit(falhas ? 1 : 0);
