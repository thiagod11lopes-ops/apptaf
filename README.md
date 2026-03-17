# TAF - Teste de Aptidão Física

Aplicativo para gestão do Teste de Aptidão Física: cadastro, normas, aplicação do TAF e estatísticas.

## Tecnologias

- **Expo** (React Native)
- **React Navigation**
- **TypeScript**
- **AsyncStorage** (dados locais)

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

## Como executar

```bash
# Iniciar o projeto (Expo)
npm start
```

Depois escolha no terminal:

- **Web:** tecle `w` ou acesse `http://localhost:8081` (ou a porta indicada)
- **Android:** tecle `a` (com emulador ou dispositivo conectado)
- **iOS:** tecle `i` (apenas no macOS, com simulador ou dispositivo)

Para rodar direto na web em uma porta específica:

```bash
npx expo start --web --port 8082
```

Acesse no navegador: `http://localhost:8082`

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

**Observação:** os dados do cadastro ficam no **navegador** (AsyncStorage/localStorage). Em um novo computador ou celular, os dados não aparecem; cada dispositivo tem sua própria lista. Para dados compartilhados entre usuários seria necessário um backend (servidor/banco de dados).

## Estrutura do projeto

```
taf-app/
├── App.tsx                 # Entrada do app
├── src/
│   ├── components/        # Componentes reutilizáveis (Menu, Header, Card, etc.)
│   ├── constants/        # Postos, graduações
│   ├── contexts/         # ThemeContext
│   ├── navigation/       # AppNavigator (rotas)
│   ├── screens/          # Telas (Home, Cadastro, Normas, etc.)
│   ├── services/         # Storage (cadastros)
│   ├── theme/            # Cores
│   ├── types/            # Tipos TypeScript
│   └── utils/            # Normalização de exibição
├── assets/               # Recursos estáticos
└── Fundo.png             # Imagem de fundo da home
```

## Funcionalidades

- **Home:** acesso a Normas, Cadastro, Aplicação do TAF e Estatísticas
- **Cadastro:** registro por categoria (Oficial/Praça), posto/graduação, NIP, nome e data; lista com filtros e ações editar/excluir
- **Normas:** consulta a documentos e normas
- **Aplicação do TAF:** tela para aplicação do teste
- **Estatísticas:** análise e métricas

## Licença

Projeto privado. Uso conforme autorização.
