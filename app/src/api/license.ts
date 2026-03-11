import { invoke } from "@tauri-apps/api/core";

export interface LicenseStatus {
  state: "trial" | "active" | "expired";
  device_id: string;
  plan: string | null;
  days_remaining: number;
  expiry_date: string | null;
  trial_days_remaining: number | null;
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("get_license_status");
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("activate_license", { key });
}
