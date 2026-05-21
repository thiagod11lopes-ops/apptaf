# Módulo TAF

## Formatação de tempos

`tafTimeFormat.ts` — `formatMsByModality`, `parseTafPerformanceInput`, etc.

- **Corrida:** exibição `MM:SS`.
- **Natação:** exibição `N S` (segundos inteiros + espaço + `S` maiúsculo, ex.: `60 S`).

## Corrida 2400 m — notas (50 a 100), feminino e masculino

`corrida2400Nota.ts` — **duas tabelas** (F e M), mesmas faixas etárias: 18–25, 26–33, 34–39, 40–45, 46–49 e **50 anos ou mais**. Tempos máximos de término em MM:SS por nota; tempo pior que o limite da nota 50 → **REPROVADO**. `sexo` indefinido usa a **tabela masculina**.

- `textoNotaCorrida(tempoMs, idadeAnos, sexo)` — `"100"`…`"50"`, `"REPROVADO"` ou `"—"`.
- `textoNotaCorridaFromCadastro({ tempoCorrida, dataNascimento, sexo })` — recalcula sempre pela norma (uso na planilha e ao salvar).
- `notaCorrida2400(tempoMs, idadeAnos, sexo)` — resultado estruturado.

Aliases legados: `textoNotaCorridaMasculina`, `notaCorrida2400Masculino`, `faixaEtariaCorridaMasculina`.

Integração: **Aplicar TAF** (coluna Nota + `notaCorrida` no cadastro) e planilha do **Registrador de TAF**.

## Natação — notas (50 a 100), feminino e masculino

`natacaoNota.ts` — duas tabelas (F e M), tempos em **segundos** como limites máximos por nota e faixa etária (18–25 … 46–50). `sexo` indefinido usa a **tabela masculina**.

- `textoNotaNatacao(tempoMs, idadeAnos, sexo)` — `"100"`…`"50"`, `"REPROVADO"` ou `"—"`.
- `notaNatacao(tempoMs, idadeAnos, sexo)` — resultado estruturado.

Aliases legados: `textoNotaNatacaoFeminina`, `notaNatacaoFeminina`.

Integração: **Aplicar TAF** (coluna Nota + `notaNatacao` no cadastro), coluna **Nota nat.** na planilha do Registrador de TAF.
