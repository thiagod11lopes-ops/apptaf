# Firebase — login Google e Firestore

## 1. Criar projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/).
2. Crie um projeto (ou use um existente).
3. Em **Build → Authentication → Sign-in method**, ative **Google**.
4. Em **Project settings → Your apps**, registre um app **Web** e copie o objeto de configuração.

## 2. Google OAuth (Web Client ID)

1. No Firebase, em Authentication → Google, copie o **Web client ID**.
2. Cole em `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no arquivo `.env`.

Para Android/iOS nativos (opcional), crie IDs OAuth no [Google Cloud Console](https://console.cloud.google.com/) e preencha `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

## 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha todas as variáveis `EXPO_PUBLIC_FIREBASE_*` e `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

Reinicie o servidor Expo após alterar o `.env`:

```bash
npm start
```

## 4. Firestore

1. No Firebase Console, em **Build → Firestore Database**, crie o banco (modo produção ou teste).
2. Em **Rules**, publique as regras de `docs/firestore.rules` (cada usuário só acessa `users/{seuUid}/...`).

### Estrutura de dados

```
users/{uid}/cadastros/{cadastroId}
users/{uid}/sessoes/{sessaoId}
```

- **cadastros**: militares cadastrados (mesmo formato do IndexedDB).
- **sessoes**: histórico de aplicações TAF (Resultado Geral, Histórico).

## 5. Comportamento no app

| Situação | Onde os dados são salvos |
|----------|--------------------------|
| Sem login Google | IndexedDB local (navegador) |
| Com login Google | Firestore (`users/{uid}/...`) |

Após entrar com Google, cadastros e sessões passam a usar a nuvem automaticamente.

## 6. E-mails autorizados (equipe)

O chefe (conta dona dos dados) gerencia em **Configurações → E-mails autorizados** no app.

- Membros entram com o **próprio Google** e acessam `users/{uidDoChefe}/...`.
- Publique as regras em `docs/firestore.rules` (inclui `member_lookup` e `emails_autorizados`).

## 7. Domínios autorizados (web)

Em Firebase → Authentication → Settings → **Authorized domains**, inclua:

- `localhost` (desenvolvimento)
- Domínio de produção (ex.: `seu-app.vercel.app`)
