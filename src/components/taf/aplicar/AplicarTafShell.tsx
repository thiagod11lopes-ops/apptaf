import React from 'react';
import { MobileGlassShell } from '../../mobile/MobileGlassShell';

type Props = {
  children: React.ReactNode;
};

export function AplicarTafShell({ children }: Props) {
  return <MobileGlassShell>{children}</MobileGlassShell>;
}
