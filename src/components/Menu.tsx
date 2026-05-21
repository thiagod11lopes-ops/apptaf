import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { PREMIUM } from '../theme/premium';

export interface MenuOption {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  Icon: LucideIcon;
}

interface Props {
  options: MenuOption[];
  visible?: boolean;
}

const CARD_MIN_HEIGHT = 76;

export function Menu({ options, visible = true }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const Icon = opt.Icon;
        return (
          <PressableScale
            key={opt.id}
            onPress={opt.onPress}
            style={[
              styles.item,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.accentMuted }]}>
              <Icon size={22} color={theme.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.textBlock}>
              <Text style={ts.h2} numberOfLines={1}>
                {opt.title}
              </Text>
              <Text style={[ts.caption, styles.subGap]} numberOfLines={2}>
                {opt.subtitle}
              </Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} strokeWidth={2.5} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: CARD_MIN_HEIGHT,
    height: CARD_MIN_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 8,
    justifyContent: 'center',
  },
  subGap: { marginTop: 4 },
});
