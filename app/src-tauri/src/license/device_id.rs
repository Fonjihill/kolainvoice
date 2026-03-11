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
