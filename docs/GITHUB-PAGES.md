# GitHub Pages — publicar o app (não o README)

Se `https://SEU_USUARIO.github.io/apptaf/` mostra o texto do **README**, a origem do Pages está errada.

## Configuração correta (uma vez)

1. Repositório no GitHub → **Settings** → **Pages**
2. **Build and deployment** → **Source**: **Deploy from a branch**
3. **Branch**: `gh-pages` → pasta **`/ (root)`** → **Save**

O workflow `.github/workflows/deploy-pages.yml` gera essa branch automaticamente a cada push em `main`.

## URL do app

```
https://thiagod11lopes-ops.github.io/apptaf/
```

## Login no site publicado

Defina secrets em **Settings → Secrets and variables → Actions**:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Detalhes em [docs/SUPABASE.md](SUPABASE.md).

**Supabase** → **Authentication → URL Configuration** — Site URL e Redirect URLs:

- `https://thiagod11lopes-ops.github.io/apptaf`

Sem a redirect URL, o link de recuperação/confirmação de e-mail não volta ao app corretamente.

Depois de qualquer alteração, rode o deploy de novo (push em `main` ou **Actions → Run workflow**).
