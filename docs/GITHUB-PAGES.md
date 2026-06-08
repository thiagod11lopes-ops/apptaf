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

## Login Google no site publicado

Adicione em **Settings → Secrets and variables → Actions** os mesmos valores do `.env`:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

Depois rode o workflow de deploy novamente (push em `main` ou **Actions → Run workflow**).

## Firebase — domínio autorizado

Em **Authentication → Settings → Authorized domains**, inclua:

- `thiagod11lopes-ops.github.io`
