import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { NormsContentDisplay } from '../components/NormsContentDisplay';
import { CGCFN_108_NORM_CONTENT } from '../data/normasData';

export default function NormasScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Normas · CGCFN-108" onBack={() => navigation.goBack()} />
      <NormsContentDisplay normContent={CGCFN_108_NORM_CONTENT} />
    </View>
  );
}
