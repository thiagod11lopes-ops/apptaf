# TAF - Teste de Aptidão Física

Aplicativo para gestão do Teste de Aptidão Física: normas, aplicação do TAF e estatísticas.

## Tecnologias

- **Expo** (React Native)
- **React Navigation**
- **TypeScript**
- **Supabase** (Auth Google + Postgres) — opcional via `.env`
- **IndexedDB** (dados locais sem login)

## Pré-requisitos

- Node.js (recomendado LTS)
- npm ou yarn

## Instalação

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/taf-app.git
cd taf-app

# Instale as dependências
npm install
```

### Supabase (login Google + nuvem)

Veja o guia completo em [docs/SUPABASE.md](docs/SUPABASE.md). Resumo:

1. Crie projeto no Supabase e execute `supabase/schema.sql`.
2. Ative **Email** em Authentication → Providers.
3. Copie `.env.example` → `.env` e preencha as chaves `EXPO_PUBLIC_*`.
4. Reinicie o Expo (`npm start`).

Com login (e-mail e senha), cadastros e histórico TAF sincronizam na nuvem (com RLS). Sem login, o app continua usando armazenamento local (IndexedDB).

## Como executar

```bash
# Iniciar o projeto (Expo)
npm start
```

Depois escolha no terminal:

- **Web:** tecle `w` ou rode `npm run web` — abra o endereço que o **próprio terminal** mostrar (em geral **`http://localhost:8081`**).
- **Android:** tecle `a` (com emulador ou dispositivo conectado)
- **iOS:** tecle `i` (apenas no macOS, com simulador ou dispositivo)

Ou só na web:

```bash
npm run web
```

**Se `http://localhost:8082` não abrir:** no Expo atual, o servidor de desenvolvimento costuma usar a porta **8081**, não 8082. A opção `--port` do `expo start` **não se aplica ao modo web** — use sempre o link que aparecer no terminal após `npm run web` ou `npm start`.

**Checklist se a página não carregar:**

1. O servidor precisa estar **rodando** (deixe o terminal aberto; não feche após o comando).
2. Na pasta `taf-app`, execute: `npm install` e depois `npm run web`.
3. Abra **`http://localhost:8081`** (ou a URL exata indicada no terminal).
4. Firewall/antivírus do Windows: permita Node.js na rede local, se pedir.

## Publicar online (ter um endereço para acessar na internet)

Para ter uma **URL pública** (ex.: `https://apptaf.vercel.app`) e acessar o sistema de qualquer lugar:

### 1. Gerar a build da versão web

No computador, na pasta do projeto:

```bash
npm run build:web
```

Isso gera a pasta **`dist/`** com os arquivos estáticos do app.

### 2. Conectar o repositório a um serviço de hospedagem

Escolha um dos serviços abaixo (todos têm plano gratuito):

| Serviço   | Site        | O que fazer |
|-----------|-------------|-------------|
| **Vercel** | vercel.com  | Login com GitHub → "Add New Project" → selecione o repositório `apptaf` → **Root Directory** deixe vazio ou `taf-app` se o repositório tiver essa pasta na raiz. Em **Build Command** use `npm run build:web`. Em **Output Directory** use `dist`. Deploy. |
| **Netlify** | netlify.com | Login com GitHub → "Add new site" → "Import from Git" → escolha o repo. **Build command:** `npm run build:web`. **Publish directory:** `dist`. Deploy. |

### 3. Resultado

Depois do deploy, o serviço mostra uma URL, por exemplo:

- **Vercel:** `https://apptaf.vercel.app` (ou um nome que você escolher)
- **Netlify:** `https://nome-aleatorio.netlify.app` (você pode alterar o nome nas configurações)

Qualquer pessoa pode acessar o sistema por esse endereço.

**Observação:** este app é executado no navegador (web) e pode usar armazenamento local para dados do usuário, quando aplicável.

## Estrutura do projeto

```
taf-app/
├── App.tsx                 # Entrada do app
├── src/
│   ├── components/        # Componentes reutilizáveis (Menu, Header, Card, etc.)
│   ├── constants/        # (módulos de apoio)
│   ├── contexts/         # ThemeContext
│   ├── navigation/       # AppNavigator (rotas)
│   ├── screens/          # Telas (Home, Normas, Registrador de TAF, Estatísticas, etc.)
│   ├── theme/            # Cores
│   ├── types/            # Tipos TypeScript
│   └── utils/            # Utilitários de exibição
├── assets/               # Recursos estáticos
└── Fundo.png             # Imagem de fundo da home
```

## Funcionalidades

- **Home:** acesso a Normas, Registrador de TAF e Estatísticas
- **Normas:** consulta a documentos e normas
- **Registrador de TAF:** tela para aplicação do teste
- **Estatísticas:** análise e métricas

## Licença

Projeto privado. Uso conforme autorização.
