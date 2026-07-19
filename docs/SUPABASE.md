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
- Ativada automaticamente no login com a senha da conta.
- Na **primeira entrada do chefe**, o app gera a chave de equipe e grava metadados em `team_e2e_meta` (cifrados com a senha de login).
- **Membros autorizados** precisam da **mesma senha de criptografia do chefe** (na prática, a senha de login do chefe na criação da chave) para desbloquear dados cifrados na nuvem.
- A chave fica em `sessionStorage` do navegador para recarregar a página sem pedir senha de novo (mesma aba/sessão).
- Dados antigos em texto plano na nuvem continuam legíveis; novos uploads passam a ser cifrados após a chave estar ativa.

### SQL adicional (se o projeto já existia antes da E2E)
Execute no SQL Editor:

```sql
create table if not exists public.team_e2e_meta (
  owner_uid uuid primary key,
  salt_b64 text not null,
  wrapped_key_b64 text not null,
  key_version int not null default 1,
  updated_at timestamptz default now()
);
alter table public.team_e2e_meta enable row level security;
grant select, insert, update on public.team_e2e_meta to authenticated;
-- policies: ver supabase/schema.sql (team_e2e_meta_*)
```

## 6. Sync incremental (IndexedDB)
- Após cada sync bem-sucedida, o app guarda um *watermark* (`syncWatermark.ts`).
- Nas próximas comparações com a nuvem, só baixa registros alterados desde o watermark (com baseline do IndexedDB já sincronizado).
- O IndexedDB local é exibido imediatamente após login/recarregar; a nuvem é consultada em segundo plano.

## 7. CI / GitHub Pages
Defina secrets `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no repositório Actions. Sem isso o login na PWA publicada fica desabilitado.

## 8. Vercel (`apptaf.vercel.app`)
O `.env` local **não** vai para a Vercel. Em **Project → Settings → Environment Variables**, adicione as mesmas chaves `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview) e faça **Redeploy**. Sem isso, o painel Admin e o login na nuvem ficam desabilitados no deploy.
