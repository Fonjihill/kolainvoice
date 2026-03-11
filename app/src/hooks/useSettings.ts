import { create } from "zustand";
import {
  getSettings,
  saveSettings,
  type SaveSettingsPayload,
  type Settings,
} from "../api/settings";

interface SettingsStore {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  save: (payload: SaveSettingsPayload) => Promise<void>;
}

export const useSettings = create<SettingsStore>((set) => ({
  settings: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await getSettings();
      set({ settings, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  save: async (payload) => {
    set({ loading: true, error: null });
    try {
      const settings = await saveSettings(payload);
      set({ settings, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
