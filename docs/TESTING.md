# Guia de testes — App TAF (offline-first)

## Antes de começar

1. **Build local (opcional):**
   ```bash
   cd taf-app
   npm install --legacy-peer-deps
   npm run build:web
   npx expo start --web
   ```

2. **Produção:** https://thiagod11lopes-ops.github.io/apptaf/

3. **Ferramentas úteis:** Chrome DevTools → Application → IndexedDB → `taf_offline_first_v1`

---

## Teste 1 — Login e carga inicial

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Abrir app e entrar com Google (chefe) | Login OK |
| 2 | Aguardar 10–30 s | Nuvem **verde** ao lado do e-mail |
| 3 | Home | Contagem de cadastros igual à nuvem |
| 4 | Configurações → Sincronização e diagnóstico | Conectividade ONLINE, fila 0 |

---

## Teste 2 — Offline puro

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | DevTools → Network → Offline | Nuvem **vermelha** |
| 2 | Cadastrar 1 militar ou aplicar TAF | Salva sem erro |
| 3 | Recarregar página (F5) | Dado continua visível |
| 4 | IndexedDB | Registro em `cadastros` ou `sessoes`, fila em `syncQueue` |

---

## Teste 3 — Reconexão

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Voltar Network → Online | Sync automático |
| 2 | Diagnóstico | Fila vai a **0**, nuvem verde |
| 3 | Outro navegador logado | Vê alteração em ~5–15 s |

---

## Teste 4 — Dois dispositivos

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | PC + celular, mesma conta (chefe ou autorizado) | Mesmos totais na Home |
| 2 | Aplicar TAF no celular | PC atualiza sem F5 |
| 3 | Cadastro no PC | Celular atualiza |

---

## Teste 5 — Importação em lote (~865 PDF)

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Chefe → importar planilha PDF | Barra progride, não trava eternamente |
| 2 | Diagnóstico | Fila sobe e depois zera |
| 3 | Firebase Console | Documentos em `users/{uid}/cadastros` |

---

## Teste 6 — Autorizado

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Login com e-mail autorizado | Vê dados do **chefe** |
| 2 | Aplicar TAF | Chefe vê no tempo real |
| 3 | Autorizado **não** vê zona admin/planilha chefe | OK |

---

## Teste 7 — Limpar dados (zona de perigo)

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Configurações → excluir tudo (chefe) | Local + nuvem zerados |
| 2 | IndexedDB | Tabelas vazias para o owner |

---

## Problemas comuns

| Sintoma | Verificar |
|---------|-----------|
| Nuvem vermelha permanente | Diagnóstico → logs; Firebase `.env` / secrets no deploy |
| Dados não somem no outro aparelho | Mesmo login? Autorizado usa UID do chefe |
| Build falhou | `npm run build:web` — corrigir erro no terminal |
| Fila não zera | Forçar sincronização no diagnóstico |

---

## Comandos

```bash
npm test          # testes unitários (ConflictResolver)
npm run build:web # build para GitHub Pages
```
