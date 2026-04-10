import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_COMPARE_ITEMS = 3;

type ThemePreference = 'system' | 'light' | 'dark';

type UserPrefsState = {
  favoritePlotIds: string[];
  comparePlotIds: string[];
  themePreference: ThemePreference;
  isFavorite: (plotId: string) => boolean;
  isCompared: (plotId: string) => boolean;
  toggleFavorite: (plotId: string) => void;
  toggleCompare: (plotId: string) => void;
  clearCompare: () => void;
  setThemePreference: (theme: ThemePreference) => void;
};

const withToggle = (items: string[], next: string, limit?: number): string[] => {
  if (items.includes(next)) {
    return items.filter((item) => item !== next);
  }

  if (typeof limit === 'number' && items.length >= limit) {
    return [...items.slice(1), next];
  }

  return [...items, next];
};

export const useUserPrefsStore = create<UserPrefsState>()(
  persist(
    (set, get) => ({
      favoritePlotIds: [],
      comparePlotIds: [],
      themePreference: 'system',
      isFavorite: (plotId) => get().favoritePlotIds.includes(plotId),
      isCompared: (plotId) => get().comparePlotIds.includes(plotId),
      toggleFavorite: (plotId) => {
        set((state) => ({
          favoritePlotIds: withToggle(state.favoritePlotIds, plotId),
        }));
      },
      toggleCompare: (plotId) => {
        set((state) => ({
          comparePlotIds: withToggle(state.comparePlotIds, plotId, MAX_COMPARE_ITEMS),
        }));
      },
      clearCompare: () => set({ comparePlotIds: [] }),
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: 'land-plots-user-prefs',
      partialize: (state) => ({
        favoritePlotIds: state.favoritePlotIds,
        comparePlotIds: state.comparePlotIds,
        themePreference: state.themePreference,
      }),
    },
  ),
);
