import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';

type Props = {
  title: string;
  description?: string;
  /** Ex.: só na Home (web com hover). */
  enabled?: boolean;
  children: React.ReactElement;
  style?: ViewStyle;
};

const bubbleShadowLight =
  '0 12px 40px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.65) inset';
const bubbleShadowDark =
  '0 16px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08) inset';

export function ActionIconTooltip({
  title,
  description,
  enabled = true,
  children,
  style,
}: Props) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const webTooltip = enabled && Platform.OS === 'web';

  const bubbleBg = theme.isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  const bubbleBorder = theme.isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(37, 99, 235, 0.22)';
  const accentLine = theme.primary;

  const child = React.cloneElement(children, {
    onHoverIn: (event: unknown) => {
      if (webTooltip) setVisible(true);
      children.props.onHoverIn?.(event);
    },
    onHoverOut: (event: unknown) => {
      if (webTooltip) setVisible(false);
      children.props.onHoverOut?.(event);
    },
    style: [
      children.props.style,
      webTooltip && visible
        ? ({
            transform: [{ scale: 1.04 }],
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          } as ViewStyle)
        : null,
    ],
  });

  return (
    <View style={[styles.anchor, style]}>
      {webTooltip && visible ? (
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleBg,
              borderColor: bubbleBorder,
            },
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: theme.isDark ? bubbleShadowDark : bubbleShadowLight,
                  animation: 'actionIconTooltipIn 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                } as object)
              : null,
          ]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.accentBar, { backgroundColor: accentLine }]} />
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {title}
          </Text>
          {description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={3}>
              {description}
            </Text>
          ) : null}
          <View
            style={[
              styles.arrow,
              {
                backgroundColor: bubbleBg,
                borderColor: bubbleBorder,
              },
            ]}
          />
        </View>
      ) : null}
      {child}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  bubble: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 12,
    minWidth: 148,
    maxWidth: 220,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    zIndex: 50,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 2,
    opacity: 0.85,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 4,
  },
  description: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 4,
  },
  arrow: {
    position: 'absolute',
    bottom: -5,
    width: 10,
    height: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
});
