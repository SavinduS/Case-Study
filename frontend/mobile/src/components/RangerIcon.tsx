import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Curated MaterialCommunityIcons set for the Ranger dashboard. One shared
// wrapper keeps icon sizes consistent and makes future swaps trivial.
export type RangerIconName =
  | 'clipboard-text-outline'
  | 'clipboard-list-outline'
  | 'plus-circle-outline'
  | 'sync'
  | 'account-circle-outline'
  | 'account-outline'
  | 'logout'
  | 'menu'
  | 'magnify'
  | 'filter-outline'
  | 'calendar-range'
  | 'calendar-clock-outline'
  | 'close-circle-outline'
  | 'chevron-down'
  | 'chevron-up'
  | 'map-marker-outline'
  | 'crosshairs-gps'
  | 'camera-outline'
  | 'image-outline'
  | 'clock-outline'
  | 'check-circle-outline'
  | 'alert-circle-outline'
  | 'cloud-upload-outline'
  | 'eye-outline'
  | 'pencil-outline'
  | 'leaf';

interface Props {
  name: RangerIconName;
  size?: number;
  color?: string;
}

export default function RangerIcon({ name, size = 20, color }: Props) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
