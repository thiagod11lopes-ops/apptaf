import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface MenuOption {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface Props {
  options: MenuOption[];
  visible?: boolean;
}

export function Menu({ options, visible = true }: Props) {
  const { theme } = useTheme();
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          onPress={opt.onPress}
          activeOpacity={0.85}
          style={[
            styles.item,
            styles.itemGlass,
            Platform.OS === 'web' && styles.itemBlur,
          ]}
        >
          <Text style={[styles.title, { color: '#FFFFFF' }]}>{opt.title}</Text>
          <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.92)' }]}>{opt.subtitle}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  item: {
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    } as any),
  },
  itemGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  itemBlur: Platform.select({
    web: {
      backdropFilter: 'blur(0.84px)',
      WebkitBackdropFilter: 'blur(0.84px)',
    } as any,
    default: {},
  }),
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    ...(Platform.OS === 'web' && { textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9)' } as any),
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    ...(Platform.OS === 'web' && { textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)' } as any),
  },
});
