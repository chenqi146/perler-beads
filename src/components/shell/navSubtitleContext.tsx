'use client';

import { createContext } from 'react';

export type NavSubtitleSlot = {
  subtitle?: string;
};

export const NavSubtitleStateContext = createContext<NavSubtitleSlot>({});
export const NavSubtitleSetterContext = createContext<(slot: NavSubtitleSlot) => void>(() => {});
