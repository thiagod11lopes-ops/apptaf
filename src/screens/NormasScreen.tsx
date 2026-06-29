import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { AppHeader } from '../components/sismav/AppHeader';
import { NormsContentDisplay } from '../components/NormsContentDisplay';
import { CGCFN_108_NORM_CONTENT } from '../data/normasData';

export default function NormasScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.headerWrap}>
        <AppHeader title="Normas" subtitle="CGCFN-108" onBack={() => navigation.goBack()} />
      </View>
      <NormsContentDisplay normContent={CGCFN_108_NORM_CONTENT} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { paddingHorizontal: 16, paddingTop: 16 },
});
