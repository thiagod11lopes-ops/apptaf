import React from 'react';
import { SubTabs, type SubTabOption } from '../sismav/SubTabs';

export type PillOption<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  options: PillOption<T>[];
  value: T;
  onChange: (id: T) => void;
};

/** Mantém API legada; visual SISMAV via SubTabs. */
export function PillTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const subOptions: SubTabOption<T>[] = options;
  return <SubTabs options={subOptions} value={value} onChange={onChange} />;
}
