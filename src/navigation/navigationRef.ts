import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateTab(name: keyof RootStackParamList) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name);
  }
}

export function getCurrentRouteName(): keyof RootStackParamList {
  const name = navigationRef.getCurrentRoute()?.name;
  return (name ?? 'Home') as keyof RootStackParamList;
}
