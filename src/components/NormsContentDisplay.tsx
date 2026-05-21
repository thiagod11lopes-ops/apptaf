import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  normContent: string;
};

export function NormsContentDisplay({ normContent }: Props) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim()) {
      return <Text style={[styles.normText, { color: theme.text }]}>{normContent}</Text>;
    }

    const regex = new RegExp(`(${searchQuery.trim()})`, 'gi');
    const parts = normContent.split(regex);

    return (
      <Text style={[styles.normText, { color: theme.text }]}>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <Text key={index} style={styles.highlight}> {part} </Text>
          ) : (
            part
          ),
        )}
      </Text>
    );
  }, [normContent, searchQuery, theme.text]);

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.cardBg }]}
          placeholder="Buscar na norma..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {highlightedContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  normText: {
    fontSize: 15,
    lineHeight: 24,
  },
  highlight: {
    backgroundColor: 'yellow',
    fontWeight: 'bold',
  },
});