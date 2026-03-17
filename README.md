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
