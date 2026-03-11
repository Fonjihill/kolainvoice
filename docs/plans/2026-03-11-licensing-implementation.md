# Licensing System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement offline license verification in Kola Invoice + build a Kola Invoice Admin desktop app for license generation.

**Architecture:** HMAC-SHA256 based license keys. The client app verifies keys offline using a shared secret. The admin app generates keys. Both share the same key format: 7 bytes payload + 8 bytes HMAC = 15 bytes, base32-encoded as `KOLA-XXXXX-XXXXX-XXXXX-XXXXX-XXXX`. Device ID is a SHA-256 hash of the machine's hardware UUID, displayed as 8 hex chars.

**Tech Stack:** Rust (hmac, sha2, base32, serde), Tauri 2, React 19, TypeScript, Tailwind CSS v4, Zustand, SQLite (rusqlite)

---

## Crypto Format Specification

### License Key Structure

```
Payload (7 bytes):
  [0..4]  device_id_prefix  — first 4 bytes of SHA-256(hardware_uuid)
  [4]     plan_type         — 0x01=monthly, 0x02=annual, 0xFF=trial
  [5..7]  expiry_days       — u16 LE, days since 2026-01-01

MAC (8 bytes):
  First 8 bytes of HMAC-SHA256(SECRET_KEY, payload)

Total: 15 bytes → Base32 → 24 chars → "KOLA-XXXXX-XXXXX-XXXXX-XXXXX-XXXX"
```

### Shared Secret Key

A 32-byte key hardcoded in both apps. In the client binary, XOR'd with a constant for basic obfuscation.

```rust
// The actual secret (generated once, used in both apps)
const SECRET_RAW: [u8; 32] = [
    0x4B, 0x6F, 0x6C, 0x61, 0x49, 0x6E, 0x76, 0x6F,
    0x69, 0x63, 0x65, 0x4C, 0x69, 0x63, 0x65, 0x6E,
    0x73, 0x65, 0x4B, 0x65, 0x79, 0x32, 0x30, 0x32,
    0x36, 0x53, 0x65, 0x63, 0x72, 0x65, 0x74, 0x21,
];
```

### Device ID

```rust
// macOS: ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID
// Windows: wmic csproduct get uuid
// Linux: cat /etc/machine-id
// → SHA-256 hash → first 4 bytes for license, first 8 hex chars for display
```

### Epoch

`EPOCH = 2026-01-01` — expiry_days is days since this date. u16 gives ~179 years range.

---

## Part A: Kola Invoice — License Integration

### Task 1: Add Rust crypto dependencies

**Files:**
- Modify: `app/src-tauri/Cargo.toml`

**Step 1: Add dependencies**

Add to `[dependencies]` in Cargo.toml:
```toml
hmac = "0.12"
sha2 = "0.10"
data-encoding = "2.6"
```

**Step 2: Verify compilation**

Run: `cd app && npx tauri build --debug 2>&1 | tail -5`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add app/src-tauri/Cargo.toml
git commit -m "feat: add crypto dependencies for license system"
```

---

### Task 2: Device ID generation module

**Files:**
- Create: `app/src-tauri/src/license/mod.rs`
- Create: `app/src-tauri/src/license/device_id.rs`
- Modify: `app/src-tauri/src/lib.rs` (add `mod license;`)

**Step 1: Create license module**

`app/src-tauri/src/license/mod.rs`:
```rust
pub mod device_id;
pub mod crypto;
pub mod manager;
```

**Step 2: Implement device_id.rs**

`app/src-tauri/src/license/device_id.rs`:
```rust
use sha2::{Sha256, Digest};
use std::process::Command;

/// Get the machine's hardware UUID.
fn hardware_uuid() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
            .map_err(|e| format!("Failed to run ioreg: {e}"))?;
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if line.contains("IOPlatformUUID") {
                if let Some(uuid) = line.split('"').nth(3) {
                    return Ok(uuid.to_string());
                }
            }
        }
        Err("IOPlatformUUID not found".into())
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wmic")
            .args(["csproduct", "get", "uuid"])
            .output()
            .map_err(|e| format!("Failed to run wmic: {e}"))?;
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() && trimmed != "UUID" {
                return Ok(trimmed.to_string());
            }
        }
        Err("Machine UUID not found".into())
    }

    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/etc/machine-id")
            .map(|s| s.trim().to_string())
            .map_err(|e| format!("Failed to read machine-id: {e}"))
    }
}

/// Returns the full SHA-256 hash of the hardware UUID (32 bytes).
pub fn device_id_hash() -> Result<[u8; 32], String> {
    let uuid = hardware_uuid()?;
    let mut hasher = Sha256::new();
    hasher.update(uuid.as_bytes());
    Ok(hasher.finalize().into())
}

/// Returns the first 4 bytes of the device ID hash (used in license keys).
pub fn device_id_prefix() -> Result<[u8; 4], String> {
    let hash = device_id_hash()?;
    let mut prefix = [0u8; 4];
    prefix.copy_from_slice(&hash[..4]);
    Ok(prefix)
}

/// Returns the display-friendly device ID (8 hex chars).
pub fn device_id_display() -> Result<String, String> {
    let hash = device_id_hash()?;
    Ok(hex_encode(&hash[..4]))
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02X}", b)).collect()
}
```

**Step 3: Commit**

```bash
git add app/src-tauri/src/license/
git commit -m "feat: add device ID generation (cross-platform)"
```

---

### Task 3: License crypto module (verify)

**Files:**
- Create: `app/src-tauri/src/license/crypto.rs`

**Step 1: Implement crypto.rs**

`app/src-tauri/src/license/crypto.rs`:
```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;
use data_encoding::BASE32_NOPAD;

type HmacSha256 = Hmac<Sha256>;

/// Shared secret XOR'd with mask for basic obfuscation in binary.
const SECRET_MASKED: [u8; 32] = [
    0x0A, 0x2E, 0x2D, 0x20, 0x08, 0x4F, 0x37, 0x2E,
    0x28, 0x22, 0x24, 0x0D, 0x28, 0x22, 0x24, 0x2F,
    0x32, 0x24, 0x0A, 0x24, 0x38, 0x73, 0x71, 0x73,
    0x67, 0x12, 0x24, 0x29, 0x1B, 0x24, 0x32, 0x60,
];
const MASK: u8 = 0x41;

/// Epoch: 2026-01-01 as days since Unix epoch
const EPOCH_DAYS: u32 = 20454; // 2026-01-01

#[derive(Debug, Clone, PartialEq)]
pub enum PlanType {
    Monthly,
    Annual,
    Trial,
}

impl PlanType {
    pub fn to_byte(&self) -> u8 {
        match self {
            PlanType::Monthly => 0x01,
            PlanType::Annual => 0x02,
            PlanType::Trial => 0xFF,
        }
    }

    pub fn from_byte(b: u8) -> Result<Self, String> {
        match b {
            0x01 => Ok(PlanType::Monthly),
            0x02 => Ok(PlanType::Annual),
            0xFF => Ok(PlanType::Trial),
            _ => Err(format!("Unknown plan type: {b}")),
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            PlanType::Monthly => "Mensuel",
            PlanType::Annual => "Annuel",
            PlanType::Trial => "Essai",
        }
    }
}

#[derive(Debug, Clone)]
pub struct LicenseData {
    pub device_id_prefix: [u8; 4],
    pub plan: PlanType,
    pub expiry_days: u16, // days since EPOCH
}

impl LicenseData {
    /// Check if this license has expired.
    pub fn is_expired(&self) -> bool {
        let now_days = current_day();
        now_days > self.expiry_days
    }

    /// Returns the expiration date as "JJ/MM/AAAA".
    pub fn expiry_date_display(&self) -> String {
        let total_days = EPOCH_DAYS + self.expiry_days as u32;
        let date = days_to_date(total_days);
        format!("{:02}/{:02}/{}", date.2, date.1, date.0)
    }

    /// Days remaining (0 if expired).
    pub fn days_remaining(&self) -> u16 {
        let now = current_day();
        if now >= self.expiry_days { 0 } else { self.expiry_days - now }
    }
}

fn secret_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    for i in 0..32 {
        key[i] = SECRET_MASKED[i] ^ MASK;
    }
    key
}

fn current_day() -> u16 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let days_since_unix = (secs / 86400) as u32;
    (days_since_unix.saturating_sub(EPOCH_DAYS)) as u16
}

fn days_to_date(total_unix_days: u32) -> (u32, u32, u32) {
    // Simple days-since-epoch to (year, month, day) conversion
    let secs = total_unix_days as u64 * 86400;
    let days = total_unix_days as i64;

    // Civil days algorithm
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as u32, m, d)
}

/// Encode license data into a key string: KOLA-XXXXX-XXXXX-XXXXX-XXXXX-XXXX
pub fn encode_license(data: &LicenseData) -> String {
    let payload = build_payload(data);
    let mac = compute_mac(&payload);

    let mut raw = Vec::with_capacity(15);
    raw.extend_from_slice(&payload);
    raw.extend_from_slice(&mac);

    let encoded = BASE32_NOPAD.encode(&raw);
    format_key(&encoded)
}

/// Decode and verify a license key. Returns LicenseData if valid.
pub fn decode_license(key: &str) -> Result<LicenseData, String> {
    let clean: String = key.chars().filter(|c| c.is_alphanumeric()).collect();
    // Remove "KOLA" prefix if present
    let b32 = if clean.to_uppercase().starts_with("KOLA") {
        &clean[4..]
    } else {
        &clean
    };

    let raw = BASE32_NOPAD
        .decode(b32.to_uppercase().as_bytes())
        .map_err(|e| format!("Clé invalide: {e}"))?;

    if raw.len() != 15 {
        return Err("Clé invalide: longueur incorrecte".into());
    }

    let payload = &raw[..7];
    let provided_mac = &raw[7..15];

    // Verify HMAC
    let expected_mac = compute_mac(payload);
    if provided_mac != expected_mac {
        return Err("Clé invalide: signature incorrecte".into());
    }

    // Parse payload
    let mut device_id_prefix = [0u8; 4];
    device_id_prefix.copy_from_slice(&payload[..4]);
    let plan = PlanType::from_byte(payload[4])?;
    let expiry_days = u16::from_le_bytes([payload[5], payload[6]]);

    Ok(LicenseData {
        device_id_prefix,
        plan,
        expiry_days,
    })
}

fn build_payload(data: &LicenseData) -> [u8; 7] {
    let mut payload = [0u8; 7];
    payload[..4].copy_from_slice(&data.device_id_prefix);
    payload[4] = data.plan.to_byte();
    let expiry_bytes = data.expiry_days.to_le_bytes();
    payload[5] = expiry_bytes[0];
    payload[6] = expiry_bytes[1];
    payload
}

fn compute_mac(payload: &[u8]) -> [u8; 8] {
    let key = secret_key();
    let mut mac = HmacSha256::new_from_slice(&key)
        .expect("HMAC key size is always valid");
    mac.update(payload);
    let result = mac.finalize().into_bytes();
    let mut truncated = [0u8; 8];
    truncated.copy_from_slice(&result[..8]);
    truncated
}

fn format_key(b32: &str) -> String {
    let chars: Vec<char> = b32.chars().collect();
    let groups: Vec<String> = chars.chunks(5).map(|c| c.iter().collect()).collect();
    format!("KOLA-{}", groups.join("-"))
}
```

**Step 2: Commit**

```bash
git add app/src-tauri/src/license/crypto.rs
git commit -m "feat: license key encode/decode with HMAC-SHA256"
```

---

### Task 4: License manager (trial + persistence)

**Files:**
- Create: `app/src-tauri/src/license/manager.rs`
- Create: `app/src-tauri/src/database/sql/010_license.sql`
- Modify: `app/src-tauri/src/database/migrations.rs` (add migration 10)

**Step 1: Create migration SQL**

`app/src-tauri/src/database/sql/010_license.sql`:
```sql
CREATE TABLE IF NOT EXISTS license (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    device_id      TEXT NOT NULL,
    license_key    TEXT,
    plan_type      TEXT,
    expiry_date    TEXT,
    trial_start    TEXT NOT NULL DEFAULT (date('now')),
    activated_at   TEXT
);
```

**Step 2: Register migration in migrations.rs**

Add to MIGRATIONS array:
```rust
(10, "010_license", include_str!("sql/010_license.sql")),
```

**Step 3: Implement manager.rs**

`app/src-tauri/src/license/manager.rs`:
```rust
use rusqlite::Connection;
use super::crypto::{self, LicenseData, PlanType};
use super::device_id;

const TRIAL_DAYS: i64 = 14;

#[derive(Debug, Clone, serde::Serialize)]
pub struct LicenseStatus {
    pub state: String,           // "trial", "active", "expired"
    pub device_id: String,       // 8 hex chars for display
    pub plan: Option<String>,    // "Mensuel", "Annuel", "Essai"
    pub days_remaining: u16,
    pub expiry_date: Option<String>, // "JJ/MM/AAAA"
    pub trial_days_remaining: Option<i64>,
}

/// Get current license status.
pub fn get_license_status(conn: &Connection) -> Result<LicenseStatus, String> {
    let dev_id = device_id::device_id_display()?;

    // Ensure license row exists (singleton)
    ensure_license_row(conn, &dev_id)?;

    let row = conn.query_row(
        "SELECT license_key, trial_start FROM license WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, String>(1)?,
            ))
        },
    ).map_err(|e| format!("Failed to read license: {e}"))?;

    let (license_key, trial_start) = row;

    // If we have a license key, verify it
    if let Some(key) = &license_key {
        match crypto::decode_license(key) {
            Ok(data) => {
                // Verify device ID matches
                let my_prefix = device_id::device_id_prefix()?;
                if data.device_id_prefix != my_prefix {
                    return Ok(LicenseStatus {
                        state: "expired".into(),
                        device_id: dev_id,
                        plan: None,
                        days_remaining: 0,
                        expiry_date: None,
                        trial_days_remaining: None,
                    });
                }

                if data.is_expired() {
                    return Ok(LicenseStatus {
                        state: "expired".into(),
                        device_id: dev_id,
                        plan: Some(data.plan.label().into()),
                        days_remaining: 0,
                        expiry_date: Some(data.expiry_date_display()),
                        trial_days_remaining: None,
                    });
                }

                return Ok(LicenseStatus {
                    state: "active".into(),
                    device_id: dev_id,
                    plan: Some(data.plan.label().into()),
                    days_remaining: data.days_remaining(),
                    expiry_date: Some(data.expiry_date_display()),
                    trial_days_remaining: None,
                });
            }
            Err(_) => {} // Invalid key, fall through to trial check
        }
    }

    // No valid license — check trial
    let trial_remaining = trial_days_remaining(&trial_start)?;
    if trial_remaining > 0 {
        Ok(LicenseStatus {
            state: "trial".into(),
            device_id: dev_id,
            plan: Some("Essai".into()),
            days_remaining: trial_remaining as u16,
            expiry_date: None,
            trial_days_remaining: Some(trial_remaining),
        })
    } else {
        Ok(LicenseStatus {
            state: "expired".into(),
            device_id: dev_id,
            plan: None,
            days_remaining: 0,
            expiry_date: None,
            trial_days_remaining: Some(0),
        })
    }
}

/// Activate a license key.
pub fn activate_license(conn: &Connection, key: &str) -> Result<LicenseStatus, String> {
    let dev_id = device_id::device_id_display()?;
    ensure_license_row(conn, &dev_id)?;

    // Decode and verify
    let data = crypto::decode_license(key)?;

    // Verify device ID
    let my_prefix = device_id::device_id_prefix()?;
    if data.device_id_prefix != my_prefix {
        return Err("Cette clé n'est pas valide pour cet appareil".into());
    }

    if data.is_expired() {
        return Err("Cette clé a expiré".into());
    }

    // Save to DB
    conn.execute(
        "UPDATE license SET license_key = ?1, plan_type = ?2, expiry_date = ?3, activated_at = datetime('now') WHERE id = 1",
        rusqlite::params![key, data.plan.label(), data.expiry_date_display()],
    ).map_err(|e| format!("Failed to save license: {e}"))?;

    get_license_status(conn)
}

fn ensure_license_row(conn: &Connection, device_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO license (id, device_id) VALUES (1, ?1)",
        rusqlite::params![device_id],
    ).map_err(|e| format!("Failed to ensure license row: {e}"))?;
    Ok(())
}

fn trial_days_remaining(trial_start: &str) -> Result<i64, String> {
    let remaining: i64 = rusqlite::Connection::open_in_memory()
        .map_err(|e| format!("{e}"))?
        .query_row(
            &format!("SELECT {} - CAST(julianday('now') - julianday('{}') AS INTEGER)", TRIAL_DAYS, trial_start),
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Date calc error: {e}"))?;
    Ok(remaining.max(0))
}
```

**Step 4: Commit**

```bash
git add app/src-tauri/src/license/manager.rs app/src-tauri/src/database/sql/010_license.sql app/src-tauri/src/database/migrations.rs
git commit -m "feat: license manager with trial and activation logic"
```

---

### Task 5: License IPC commands

**Files:**
- Create: `app/src-tauri/src/commands/license.rs`
- Modify: `app/src-tauri/src/commands/mod.rs` (add `pub mod license;`)
- Modify: `app/src-tauri/src/lib.rs` (register commands + module)

**Step 1: Create commands/license.rs**

```rust
use tauri::State;
use crate::AppState;
use crate::license::manager;

#[tauri::command]
pub fn get_license_status(state: State<AppState>) -> Result<manager::LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager::get_license_status(&conn)
}

#[tauri::command]
pub fn activate_license(state: State<AppState>, key: String) -> Result<manager::LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager::activate_license(&conn, &key)
}
```

**Step 2: Register in lib.rs**

Add `mod license;` at top, and add to invoke_handler:
```rust
commands::license::get_license_status,
commands::license::activate_license,
```

**Step 3: Commit**

```bash
git add app/src-tauri/src/commands/license.rs app/src-tauri/src/commands/mod.rs app/src-tauri/src/lib.rs
git commit -m "feat: license IPC commands (get_status, activate)"
```

---

### Task 6: Frontend — License API + hook

**Files:**
- Create: `app/src/api/license.ts`
- Create: `app/src/hooks/useLicense.ts`

**Step 1: Create api/license.ts**

```typescript
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
```

**Step 2: Create hooks/useLicense.ts**

```typescript
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
      set({ error: String(e), loading: false });
      throw e;
    }
  },
}));
```

**Step 3: Commit**

```bash
git add app/src/api/license.ts app/src/hooks/useLicense.ts
git commit -m "feat: frontend license API and Zustand store"
```

---

### Task 7: Frontend — License blocking screen + trial banner

**Files:**
- Create: `app/src/pages/LicenseGate.tsx`
- Modify: `app/src/App.tsx`

**Step 1: Create LicenseGate.tsx**

A full-screen blocking page shown when license is expired. Displays:
- Device ID (copiable)
- Plan choice buttons (Mensuel 5000 FCFA / Annuel 45000 FCFA)
- WhatsApp contact link pre-filled with Device ID + plan choice
- License key input field
- "Activer" button

Design: Same dark bg as onboarding splash. Kola Invoice branding at top.

**Step 2: Modify App.tsx**

Add a third gate after onboarding:
```
Loading → Onboarding → License check → Main app
```

New state: `licenseState: "loading" | "trial" | "active" | "expired"`

- If "expired" → show `<LicenseGate />`
- If "trial" → show main app + small banner "Essai : X jours restants"
- If "active" → show main app normally

The trial banner is a thin bar at the top of the main layout, amber colored.

**Step 3: Commit**

```bash
git add app/src/pages/LicenseGate.tsx app/src/App.tsx
git commit -m "feat: license gate screen with trial banner"
```

---

## Part B: Kola Invoice Admin — New Tauri App

### Task 8: Scaffold Kola Invoice Admin project

**Files:**
- Create entire project at: `/Users/mistert/Bomunto/02_Projets_Internes/kola/kola-invoice-admin/app/`

**Step 1: Create project structure**

Mirror the main app structure but minimal:
```
kola-invoice-admin/
└── app/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── index.css
    │   ├── api/
    │   ├── hooks/
    │   └── pages/
    └── src-tauri/
        ├── Cargo.toml
        ├── build.rs
        ├── tauri.conf.json
        ├── icons/ (copy from main app)
        └── src/
            ├── main.rs
            ├── lib.rs
            ├── database/
            └── license/
```

- `tauri.conf.json`: identifier = `com.kolainvoice.admin`, productName = `Kola Invoice Admin`
- Same dependencies as main app minus genpdf/image
- Add: hmac, sha2, data-encoding, chrono

**Step 2: Install frontend dependencies**

Run: `cd /Users/mistert/Bomunto/02_Projets_Internes/kola/kola-invoice-admin/app && npm install`

**Step 3: Verify it compiles**

Run: `cd /Users/mistert/Bomunto/02_Projets_Internes/kola/kola-invoice-admin/app && npx tauri build --debug 2>&1 | tail -5`

**Step 4: Commit** (in new git repo)

```bash
cd /Users/mistert/Bomunto/02_Projets_Internes/kola/kola-invoice-admin
git init
git add .
git commit -m "feat: scaffold Kola Invoice Admin project"
```

---

### Task 9: Admin — License generation crypto

**Files:**
- Create: `kola-invoice-admin/app/src-tauri/src/license/mod.rs`
- Create: `kola-invoice-admin/app/src-tauri/src/license/crypto.rs`
- Create: `kola-invoice-admin/app/src-tauri/src/license/generator.rs`

**Step 1: Copy crypto.rs from main app** (same file, same format)

**Step 2: Create generator.rs**

```rust
use super::crypto::{self, LicenseData, PlanType};

/// Generate a license key for a device.
pub fn generate_license(device_id_hex: &str, plan: &str, duration_days: u16) -> Result<String, String> {
    // Parse device ID from hex display format (8 chars = 4 bytes)
    let prefix = hex_decode_4(device_id_hex)?;

    let plan_type = match plan {
        "monthly" => PlanType::Monthly,
        "annual" => PlanType::Annual,
        _ => return Err(format!("Unknown plan: {plan}")),
    };

    // Calculate expiry: current day + duration
    let expiry_days = current_day() + duration_days;

    let data = LicenseData {
        device_id_prefix: prefix,
        plan: plan_type,
        expiry_days,
    };

    Ok(crypto::encode_license(&data))
}

fn current_day() -> u16 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let days_since_unix = (secs / 86400) as u32;
    (days_since_unix.saturating_sub(20454)) as u16 // 20454 = 2026-01-01
}

fn hex_decode_4(hex: &str) -> Result<[u8; 4], String> {
    if hex.len() != 8 {
        return Err(format!("Device ID doit contenir 8 caractères, reçu: {}", hex.len()));
    }
    let bytes: Result<Vec<u8>, _> = (0..4)
        .map(|i| u8::from_str_radix(&hex[i*2..i*2+2], 16))
        .collect();
    let bytes = bytes.map_err(|e| format!("Device ID invalide: {e}"))?;
    let mut arr = [0u8; 4];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}
```

**Step 3: Commit**

```bash
git add app/src-tauri/src/license/
git commit -m "feat: license key generation crypto"
```

---

### Task 10: Admin — Database + license history

**Files:**
- Create: `kola-invoice-admin/app/src-tauri/src/database/mod.rs`
- Create: `kola-invoice-admin/app/src-tauri/src/database/migrations.rs`
- Create: `kola-invoice-admin/app/src-tauri/src/database/sql/001_init.sql`
- Create: `kola-invoice-admin/app/src-tauri/src/database/licenses.rs`

**Step 1: Create migration SQL**

`001_init.sql`:
```sql
CREATE TABLE IF NOT EXISTS licenses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name     TEXT NOT NULL,
    client_phone    TEXT,
    device_id       TEXT NOT NULL,
    plan_type       TEXT NOT NULL CHECK (plan_type IN ('monthly', 'annual')),
    license_key     TEXT NOT NULL,
    generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at      TEXT NOT NULL,
    notes           TEXT
);

CREATE INDEX idx_licenses_device_id ON licenses(device_id);
```

**Step 2: Implement database layer** (same patterns as main app: init, migrations, CRUD)

**Step 3: Implement licenses.rs** with:
- `create_license(conn, payload) -> License`
- `get_all_licenses(conn) -> Vec<License>`
- `search_licenses(conn, query) -> Vec<License>` (by device_id or client_name)
- `get_license_stats(conn) -> Stats` (active, expired, total, revenue)

**Step 4: Commit**

```bash
git add app/src-tauri/src/database/
git commit -m "feat: admin database with license history"
```

---

### Task 11: Admin — IPC commands + frontend

**Files:**
- Create: `kola-invoice-admin/app/src-tauri/src/commands/`
- Create: `kola-invoice-admin/app/src/api/licenses.ts`
- Create: `kola-invoice-admin/app/src/hooks/useLicenses.ts`
- Create: `kola-invoice-admin/app/src/pages/Dashboard.tsx`
- Create: `kola-invoice-admin/app/src/pages/GenerateLicense.tsx`
- Create: `kola-invoice-admin/app/src/pages/LicenseHistory.tsx`
- Modify: `kola-invoice-admin/app/src/App.tsx`

**Step 1: IPC commands**
- `generate_license(device_id, client_name, client_phone, plan, notes) -> License`
- `get_all_licenses() -> Vec<License>`
- `search_licenses(query) -> Vec<License>`
- `get_license_stats() -> Stats`

**Step 2: Frontend pages**

**Dashboard**: Stats cards (licences actives, expirées, revenus mensuel/annuel) + quick generate button

**GenerateLicense**: Form with:
- Device ID input (8 chars)
- Client name
- Client phone
- Plan selector (Mensuel / Annuel)
- Generate button → shows the key in a big copiable box
- "Copier" button + "Envoyer par WhatsApp" link

**LicenseHistory**: Table with search, columns: client, device ID, plan, key, date, expiry, status

**Step 3: App.tsx with sidebar** (3 items: Dashboard, Générer, Historique)

Same design system as main app (dark sidebar, amber accents).

**Step 4: Commit**

```bash
git add .
git commit -m "feat: admin frontend with dashboard, generator, and history"
```

---

## Summary

| Task | Description | App |
|------|-------------|-----|
| 1 | Crypto dependencies | Kola Invoice |
| 2 | Device ID generation | Kola Invoice |
| 3 | License crypto (verify) | Kola Invoice |
| 4 | License manager + migration | Kola Invoice |
| 5 | License IPC commands | Kola Invoice |
| 6 | Frontend API + hook | Kola Invoice |
| 7 | License gate screen + trial banner | Kola Invoice |
| 8 | Scaffold admin project | Kola Admin |
| 9 | Admin crypto (generate) | Kola Admin |
| 10 | Admin database + history | Kola Admin |
| 11 | Admin IPC + frontend | Kola Admin |
