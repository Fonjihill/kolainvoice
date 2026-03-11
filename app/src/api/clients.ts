import { invoke } from "@tauri-apps/api/core";

export interface Client {
  id: number;
  name: string;
  niu: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveClientPayload {
  name: string;
  niu: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export async function getAllClients(archived = false): Promise<Client[]> {
  return invoke<Client[]>("get_all_clients", { archived });
}

export async function getClientById(id: number): Promise<Client> {
  return invoke<Client>("get_client_by_id", { id });
}

export async function createClient(
  payload: SaveClientPayload,
): Promise<Client> {
  return invoke<Client>("create_client", { payload });
}

export async function updateClient(
  id: number,
  payload: SaveClientPayload,
): Promise<Client> {
  return invoke<Client>("update_client", { id, payload });
}

export async function archiveClient(id: number): Promise<void> {
  return invoke<void>("archive_client", { id });
}

export async function searchClients(query: string): Promise<Client[]> {
  return invoke<Client[]>("search_clients", { query });
}

export async function getSystemClientId(): Promise<number> {
  return invoke<number>("get_system_client_id");
}
