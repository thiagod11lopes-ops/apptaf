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

O build usa `src/config/firebase.public.ts` quando não há variáveis no CI. Para outro projeto Firebase, altere esse arquivo ou defina secrets em **Settings → Secrets and variables → Actions** (`EXPO_PUBLIC_*`).

**Obrigatório no Firebase Console** — **Authentication → Settings → Authorized domains**:

- `thiagod11lopes-ops.github.io`

Sem esse domínio, o login Google falha mesmo com a config correta.

**Safari / celular (OAuth direto)** — no [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials** → cliente OAuth **Web** do Firebase:

- **Authorized JavaScript origins**: `https://thiagod11lopes-ops.github.io`
- **Authorized redirect URIs**: `https://thiagod11lopes-ops.github.io/apptaf`

Sem o redirect URI, o Safari volta ao app mas não conclui o login (`redirect_uri_mismatch`).

Depois de qualquer alteração, rode o deploy de novo (push em `main` ou **Actions → Run workflow**).
