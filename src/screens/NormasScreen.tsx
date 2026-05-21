import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Header } from '../components/Header';
import { NormsContentDisplay } from '../components/NormsContentDisplay';
import { CGCFN_108_NORM_CONTENT } from '../data/normasData';

export default function NormasScreen() {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-white dark:bg-black select-none-touch">
      <Header title="Normas" onBack={() => navigation.goBack()} />
      <NormsContentDisplay normContent={CGCFN_108_NORM_CONTENT} />
    </View>
  );
}
