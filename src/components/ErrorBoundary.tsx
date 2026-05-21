import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';

type Props = { children: ReactNode };
type State = { error: Error | null; info: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: '' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info: info.componentStack ?? '' });
    console.error('[TAF ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Erro ao carregar o app</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.msg}>{this.state.error.message}</Text>
            {this.state.info ? <Text style={styles.stack}>{this.state.info}</Text> : null}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#18181B',
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 48 : 24,
  },
  title: { color: '#FAFAFA', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  scroll: { flex: 1 },
  msg: { color: '#FB7185', fontSize: 14, marginBottom: 12 },
  stack: { color: '#A1A1AA', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
