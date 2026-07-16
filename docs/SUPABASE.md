# Supabase — configuração do TAF App

## 1. Criar projeto
1. Acesse https://supabase.com e crie um projeto.
2. Em **Project Settings → API**, copie:
   - Project URL → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Cole no arquivo `.env` (veja `.env.example`).

## 2. Schema e RLS
No **SQL Editor**, execute o arquivo:
`supabase/schema.sql`

Isso cria as tabelas (JSONB), lookups de membro e as policies (chefe / membro autorizado).

## 3. Auth por e-mail e senha
1. Supabase → **Authentication → Providers → Email** → ativar.
2. Em **Authentication → URL Configuration**, adicione a URL do app (ex.: `https://seu-usuario.github.io/apptaf`) em:
   - Site URL
   - Redirect URLs (necessário para confirmação de e-mail e recuperação de senha)
3. O app aceita **somente** e-mails `@marinha.mil.br` (login, cadastro e recuperação).

Não é necessário configurar Google OAuth.

## 4. O que mudou
- Firebase Auth/Firestore foram removidos.
- Login na nuvem: e-mail + senha (criar conta, entrar, esqueci a senha).
- A nuvem é Postgres via Supabase (tabelas JSONB + RLS).
- Dexie offline-first e sync last-write-wins foram mantidos.

## 5. Criptografia ponta a ponta (E2E)
- Módulo: `src/services/supabase/e2eCrypto.ts` (AES-GCM + PBKDF2).
- Já encaixado no upload/download (`ownerDocs.ts`).
- **Desligado por padrão** até chamar `setActiveTeamKey(...)` com a chave de equipe.

## 6. CI / GitHub Pages
Defina secrets `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no repositório Actions. Sem isso o login na PWA publicada fica desabilitado.
