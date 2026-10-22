# Simulador do datapath na DE2-115

Placa DE2-115 virtual rodando o datapath de ciclo único do Lab 05. A lógica é a mesma do VHDL e foi conferida contra o GHDL.

## Usar

Abra `dist/index.html` no navegador. É um arquivo só e não precisa de servidor.

**CodePen:** cole `dist/codepen/index.html` no painel HTML, `style.css` no CSS e `script.js` no JS.

A placa começa desligada. POWER faz os displays e LEDs piscarem por ~1,8 s (autoteste visual) e depois carrega o estado inicial: PC = 0 e registradores com os valores do programa.

Para recompilar depois de mexer no TypeScript:

```
npm install
npm run build      # gera dist/index.html
npm test           # confere o modelo contra os resultados do VHDL
```

## Estrutura

```
src/
  hw.ts       modelo do hardware, sem DOM (ula, controle, banco, PC, saídas da placa, hex7seg)
  asm.ts      montador/desmontador e exportação dos blocos VHDL
  board.ts    monta a DE2-115 no DOM (displays, LEDs, chaves, KEYs, POWER) e pinta as saídas
  diagram.ts  diagrama do datapath com os valores de cada fio
  main.ts     estado, teclado, painéis
  page.html   marcação da página
css/
  base.css    cores, fontes, página, comandos
  board.css   placa e componentes
  panels.css  sonda lógica, mapa de E/S, datapath, ROM, registradores, execução
test/check.ts compara o modelo com a saída do GHDL e gera casos aleatórios
scripts/build.mjs  esbuild: junta tudo em dist/index.html
vhdl/datapath_board.vhd  top-level da placa com as funções das chaves
```

Cada função de `hw.ts` corresponde a um bloco do VHDL:

| TS | VHDL |
|---|---|
| `ula()` | `ula.vhd` |
| `controle()` | `controle_ula` |
| `avaliar()` / `passo()` | `datapath`, `pc`, `banco_registradores` |
| `saidasPlaca()` | processo de seleção em `datapath_board` |
| `HEX7SEG` | `hex7seg.vhd` |

## Controles

| Placa | Teclado | Função |
|---|---|---|
| POWER | — | liga/desliga; ao ligar, pisca tudo e depois PC e registradores voltam ao início |
| KEY0 | Espaço | executa uma instrução |
| KEY1 | R | reset |
| KEY2 (segurar) | A | HEX mostra o operando A (rs) |
| KEY3 (segurar) | B | HEX mostra o operando B (rt) |
| SW17 + SW4–0 | clique no registrador | mostra o registrador escolhido |
| SW16 | — | clock automático: 2 instruções por segundo (KEY0 continua funcionando) |
| SW15 | — | HEX7–0 mostram a instrução inteira (32 bits) |
| SW14 / SW13 | — | HEX3–0 mostram o operando A / B, sem precisar segurar KEY2 / KEY3 |

Prioridade nos displays: SW15, depois SW17, depois A (KEY2/SW14), depois B (KEY3/SW13). SW12–5 estão livres.

As funções das chaves SW16–13 estão em `vhdl/datapath_board.vhd`, que é o `datapath_board.vhd` do lab com o top-level alterado (clock automático, seleção dos displays e LEDG4 = Negativo). O `datapath` e o testbench não mudam.

**Valores aleatórios** sorteia novos valores para $1–$8 mantendo o que cada instrução testa (sub negativo, slt nos dois sentidos, Zero no and, Overflow no add). Os blocos INICIAL e ESPERADO/REGS_FINAL em "VHDL deste programa" são atualizados juntos.

**Botão sem debounce** executa de 1 a 4 instruções por aperto. Serve para mostrar o efeito do bouncing que o `debounce` resolve.

## Trocar o programa

Abra **Editar programa e valores iniciais**, escreva e clique em **Montar e resetar**. A seção **VHDL deste programa** gera três blocos:

- `ROM` e `INICIAL`, que vão em `datapath_board.vhd`;
- `ESPERADO` e `REGS_FINAL`, que vão em `datapath_tb.vhd`.

Com os três colados, o testbench continua passando para o programa novo. Isso foi testado com 12 programas aleatórios no GHDL.
