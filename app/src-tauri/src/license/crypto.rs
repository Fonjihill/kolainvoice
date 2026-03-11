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
const EPOCH_DAYS: u32 = 20454;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
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
    pub expiry_days: u16,
}

impl LicenseData {
    pub fn is_expired(&self) -> bool {
        current_day() > self.expiry_days
    }

    pub fn expiry_date_display(&self) -> String {
        let total_days = EPOCH_DAYS + self.expiry_days as u32;
        let (y, m, d) = days_to_date(total_days);
        format!("{:02}/{:02}/{}", d, m, y)
    }

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

pub fn current_day() -> u16 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let days_since_unix = (secs / 86400) as u32;
    (days_since_unix.saturating_sub(EPOCH_DAYS)) as u16
}

fn days_to_date(total_unix_days: u32) -> (u32, u32, u32) {
    let z = total_unix_days as i64 + 719468;
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

pub fn encode_license(data: &LicenseData) -> String {
    let payload = build_payload(data);
    let mac = compute_mac(&payload);

    let mut raw = Vec::with_capacity(15);
    raw.extend_from_slice(&payload);
    raw.extend_from_slice(&mac);

    let encoded = BASE32_NOPAD.encode(&raw);
    format_key(&encoded)
}

pub fn decode_license(key: &str) -> Result<LicenseData, String> {
    let clean: String = key.chars().filter(|c| c.is_alphanumeric()).collect();
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

    let expected_mac = compute_mac(payload);
    if provided_mac != expected_mac {
        return Err("Clé invalide: signature incorrecte".into());
    }

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
