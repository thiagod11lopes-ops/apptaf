# Publicar o TAF no GitHub Pages

Assim você terá um endereço online no próprio GitHub, por exemplo:  
**https://thiagod11lopes-ops.github.io/apptaf/**

## O que já está pronto no repositório

- Workflow **Deploy to GitHub Pages** (pasta `.github/workflows/deploy-pages.yml`): a cada push na branch `main`, o GitHub monta a versão web e publica em Pages.

## O que você precisa fazer nas configurações do repositório

1. No repositório **apptaf**, clique em **Settings** (Configurações).
2. No menu da esquerda, abra **Pages** (em "Code and automation").
3. Em **Build and deployment**:
   - Em **Source** (Fonte), escolha: **GitHub Actions**.
4. Salve (não é preciso preencher mais nada nessa tela).

Depois disso, ao dar **push** na branch `main` (por exemplo, ao enviar o arquivo do workflow que criamos), o GitHub vai:

1. Rodar o workflow "Deploy to GitHub Pages".
2. Instalar dependências, rodar `npm run build:web` e publicar a pasta `dist`.
3. Disponibilizar o site em: **https://thiagod11lopes-ops.github.io/apptaf/**

## Resumo

| Onde | O que fazer |
|------|-------------|
| **Settings → Pages** | Source = **GitHub Actions** |
| **Seu computador** | Dar push no código (incluindo a pasta `.github/workflows`) para a branch `main` |

As outras opções da página de configurações (Nome do repositório, Ramo padrão, Wikis, Issues, etc.) **não precisam** ser alteradas para o site funcionar. Você pode deixar tudo como está e só mudar o **Source** em **Pages** para **GitHub Actions**.
