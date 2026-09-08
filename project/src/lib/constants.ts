import {
  LifeBuoy,
  HeartPulse,
  Home,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { NeedType } from './supabase';

export interface NeedTypeConfig {
  key: NeedType;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NEED_TYPES: NeedTypeConfig[] = [
  {
    key: 'rescue',
    label: 'Rescue',
    icon: LifeBuoy,
    description: 'Trapped, stranded, or need evacuation',
  },
  {
    key: 'medical',
    label: 'Medical',
    icon: HeartPulse,
    description: 'Injured or need medical attention',
  },
  {
    key: 'shelter',
    label: 'Shelter',
    icon: Home,
    description: 'Need a safe place to stay',
  },
  {
    key: 'food',
    label: 'Food',
    icon: UtensilsCrossed,
    description: 'Need food or drinking water',
  },
];

export const NEED_TYPE_MAP: Record<NeedType, NeedTypeConfig> = NEED_TYPES.reduce(
  (acc, cfg) => ({ ...acc, [cfg.key]: cfg }),
  {} as Record<NeedType, NeedTypeConfig>
);
