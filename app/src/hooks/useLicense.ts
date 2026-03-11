import { create } from "zustand";
import { getLicenseStatus, activateLicense, type LicenseStatus } from "../api/license";

interface LicenseStore {
  status: LicenseStatus | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  activate: (key: string) => Promise<LicenseStatus>;
}

export const useLicense = create<LicenseStore>((set) => ({
  status: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const status = await getLicenseStatus();
      set({ status, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  activate: async (key: string) => {
    set({ loading: true, error: null });
    try {
      const status = await activateLicense(key);
      set({ status, loading: false });
      return status;
    } catch (e) {
      const msg = String(e);
      set({ error: msg, loading: false });
      throw e;
    }
  },
}));
