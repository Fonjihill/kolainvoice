use rusqlite::Connection;
use super::crypto;
use super::device_id;

const TRIAL_DAYS: i64 = 14;

#[derive(Debug, Clone, serde::Serialize)]
pub struct LicenseStatus {
    pub state: String,           // "trial", "active", "expired"
    pub device_id: String,       // 8 hex chars for display
    pub plan: Option<String>,    // "Mensuel", "Annuel", "Essai"
    pub days_remaining: u16,
    pub expiry_date: Option<String>,
    pub trial_days_remaining: Option<i64>,
}

pub fn get_license_status(conn: &Connection) -> Result<LicenseStatus, String> {
    let dev_id = device_id::device_id_display()?;
    ensure_license_row(conn, &dev_id)?;

    let (license_key, trial_start): (Option<String>, String) = conn.query_row(
        "SELECT license_key, trial_start FROM license WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("Failed to read license: {e}"))?;

    if let Some(key) = &license_key {
        if let Ok(data) = crypto::decode_license(key) {
            let my_prefix = device_id::device_id_prefix()?;
            if data.device_id_prefix == my_prefix {
                if !data.is_expired() {
                    return Ok(LicenseStatus {
                        state: "active".into(),
                        device_id: dev_id,
                        plan: Some(data.plan.label().into()),
                        days_remaining: data.days_remaining(),
                        expiry_date: Some(data.expiry_date_display()),
                        trial_days_remaining: None,
                    });
                }
                return Ok(LicenseStatus {
                    state: "expired".into(),
                    device_id: dev_id,
                    plan: Some(data.plan.label().into()),
                    days_remaining: 0,
                    expiry_date: Some(data.expiry_date_display()),
                    trial_days_remaining: None,
                });
            }
        }
    }

    // No valid license — check trial
    let trial_remaining = trial_days_remaining(conn, &trial_start)?;
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

pub fn activate_license(conn: &Connection, key: &str) -> Result<LicenseStatus, String> {
    let dev_id = device_id::device_id_display()?;
    ensure_license_row(conn, &dev_id)?;

    let data = crypto::decode_license(key)?;

    let my_prefix = device_id::device_id_prefix()?;
    if data.device_id_prefix != my_prefix {
        return Err("Cette clé n'est pas valide pour cet appareil".into());
    }

    if data.is_expired() {
        return Err("Cette clé a expiré".into());
    }

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

fn trial_days_remaining(conn: &Connection, trial_start: &str) -> Result<i64, String> {
    let remaining: i64 = conn.query_row(
        "SELECT ?1 - CAST(julianday('now') - julianday(?2) AS INTEGER)",
        rusqlite::params![TRIAL_DAYS, trial_start],
        |row| row.get(0),
    ).map_err(|e| format!("Date calc error: {e}"))?;
    Ok(remaining.max(0))
}
