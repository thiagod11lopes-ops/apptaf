# Alterações na planilha de cadastro (Ações)

## 1. Ícones um ao lado do outro

No `CadastroScreen.tsx`:

**Estilos:** Altere `tdAcoes` e `btnAcaoIcon` para:

```ts
tdAcoes: {
  width: 120,
  paddingVertical: 8,
  paddingHorizontal: 6,
  justifyContent: 'center',
  flexDirection: 'row',        // lado a lado
  alignItems: 'center',
  borderLeftWidth: StyleSheet.hairlineWidth,
},
btnAcaoIcon: {
  width: 36,
  height: 36,
  borderRadius: 8,
  borderWidth: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 8,             // espaço entre os dois ícones (remova marginBottom)
},
```

**JSX da célula Ações:** Os dois `TouchableOpacity` já devem estar dentro do mesmo `View`; com `flexDirection: 'row'` no `tdAcoes` eles ficarão lado a lado.

---

## 2. Modal de confirmação ao excluir

**Importe o modal:**
```ts
import { ModalExcluirCadastro } from './ModalExcluirCadastro';
```

**Estado para o modal:**
```ts
const [excluirModalRow, setExcluirModalRow] = useState<CadastroItem | null>(null);
```

**Substitua `handleExcluir`** (remova o `Alert.alert` e use apenas):
```ts
const handleExcluir = (row: CadastroItem) => {
  setExcluirModalRow(row);
};
```

**Função para confirmar exclusão:**
```ts
const confirmarExcluir = async () => {
  if (!excluirModalRow) return;
  try {
    await deleteCadastro(excluirModalRow.id);
    const data = await getCadastros();
    setListaCadastros(data.sort((a, b) => b.createdAt - a.createdAt));
  } catch {
    if (Platform.OS === 'web') alert('Erro ao excluir.');
    else Alert.alert('Erro', 'Não foi possível excluir o cadastro.');
  }
  setExcluirModalRow(null);
};
```

**No return, antes do fechamento do `</View>` principal, adicione:**
```tsx
<ModalExcluirCadastro
  visible={excluirModalRow !== null}
  nomeCadastro={excluirModalRow?.nome ?? ''}
  onConfirmar={confirmarExcluir}
  onCancelar={() => setExcluirModalRow(null)}
  theme={theme}
/>
```
(Se usar `useTheme()`, passe `theme={theme}` para o modal seguir o tema do app; caso contrário o modal usa cores padrão.)
```

Com isso, ao clicar em Excluir abre o modal; em "Excluir" confirma e exclui; em "Cancelar" só fecha o modal.
