import { create } from "zustand";
import {
  getAllClients,
  createClient,
  updateClient,
  archiveClient,
  searchClients,
  type Client,
  type SaveClientPayload,
} from "../api/clients";

interface ClientsStore {
  clients: Client[];
  loading: boolean;
  error: string | null;
  showArchived: boolean;

  fetch: () => Promise<void>;
  setShowArchived: (v: boolean) => void;
  search: (query: string) => Promise<void>;
  create: (payload: SaveClientPayload) => Promise<Client>;
  update: (id: number, payload: SaveClientPayload) => Promise<Client>;
  archive: (id: number) => Promise<void>;
}

export const useClients = create<ClientsStore>((set, get) => ({
  clients: [],
  loading: false,
  error: null,
  showArchived: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const clients = await getAllClients(get().showArchived);
      set({ clients, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setShowArchived: (v) => {
    set({ showArchived: v, error: null });
    get().fetch();
  },

  search: async (query) => {
    set({ loading: true, error: null });
    try {
      if (query.trim() === "") {
        const clients = await getAllClients(get().showArchived);
        set({ clients, loading: false });
      } else {
        const clients = await searchClients(query);
        set({ clients, loading: false });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  create: async (payload) => {
    set({ loading: true, error: null });
    try {
      const client = await createClient(payload);
      await get().fetch();
      return client;
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
  },

  update: async (id, payload) => {
    set({ loading: true, error: null });
    try {
      const client = await updateClient(id, payload);
      await get().fetch();
      return client;
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
  },

  archive: async (id) => {
    set({ loading: true, error: null });
    try {
      await archiveClient(id);
      await get().fetch();
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
