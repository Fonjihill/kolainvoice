use rusqlite::Connection;

use crate::models::settings::{SaveSettingsPayload, Settings};

pub fn get_settings(conn: &Connection) -> Result<Settings, String> {
    conn.query_row(
        "SELECT id, company_name, company_address, company_phone, company_email,
                company_niu, company_rccm, logo_path, stamp_path,
                tva_enabled, tva_rate, default_printer, language,
                invoice_prefix, quote_prefix,
                bank_name, bank_account, bank_swift,
                next_invoice_number, next_quote_number, payment_days, quote_validity_days, default_mentions,
                paper_format, default_copies, pdf_include_logo, pdf_include_stamp, pdf_watermark_draft,
                date_format, thousand_separator,
                auto_backup_alert, update_auto_check, update_notify
         FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                id: row.get(0)?,
                company_name: row.get(1)?,
                company_address: row.get(2)?,
                company_phone: row.get(3)?,
                company_email: row.get(4)?,
                company_niu: row.get(5)?,
                company_rccm: row.get(6)?,
                logo_path: row.get(7)?,
                stamp_path: row.get(8)?,
                tva_enabled: row.get::<_, i32>(9)? != 0,
                tva_rate: row.get(10)?,
                default_printer: row.get(11)?,
                language: row.get(12)?,
                invoice_prefix: row.get(13)?,
                quote_prefix: row.get(14)?,
                bank_name: row.get(15)?,
                bank_account: row.get(16)?,
                bank_swift: row.get(17)?,
                next_invoice_number: row.get(18)?,
                next_quote_number: row.get(19)?,
                payment_days: row.get(20)?,
                quote_validity_days: row.get(21)?,
                default_mentions: row.get(22)?,
                paper_format: row.get(23)?,
                default_copies: row.get(24)?,
                pdf_include_logo: row.get::<_, i32>(25)? != 0,
                pdf_include_stamp: row.get::<_, i32>(26)? != 0,
                pdf_watermark_draft: row.get::<_, i32>(27)? != 0,
                date_format: row.get(28)?,
                thousand_separator: row.get(29)?,
                auto_backup_alert: row.get::<_, i32>(30)? != 0,
                update_auto_check: row.get::<_, i32>(31)? != 0,
                update_notify: row.get::<_, i32>(32)? != 0,
            })
        },
    )
    .map_err(|e| format!("Failed to read settings: {e}"))
}

pub fn save_settings(conn: &Connection, payload: &SaveSettingsPayload) -> Result<Settings, String> {
    conn.execute(
        "UPDATE settings SET
            company_name = ?1, company_address = ?2, company_phone = ?3,
            company_email = ?4, company_niu = ?5, company_rccm = ?6,
            logo_path = ?7, stamp_path = ?8,
            tva_enabled = ?9, tva_rate = ?10,
            default_printer = ?11, language = ?12,
            invoice_prefix = ?13, quote_prefix = ?14,
            bank_name = ?15, bank_account = ?16, bank_swift = ?17,
            next_invoice_number = ?18, next_quote_number = ?19,
            payment_days = ?20, quote_validity_days = ?21, default_mentions = ?22,
            paper_format = ?23, default_copies = ?24,
            pdf_include_logo = ?25, pdf_include_stamp = ?26, pdf_watermark_draft = ?27,
            date_format = ?28, thousand_separator = ?29,
            auto_backup_alert = ?30, update_auto_check = ?31, update_notify = ?32,
            updated_at = datetime('now')
         WHERE id = 1",
        rusqlite::params![
            payload.company_name,
            payload.company_address,
            payload.company_phone,
            payload.company_email,
            payload.company_niu,
            payload.company_rccm,
            payload.logo_path,
            payload.stamp_path,
            payload.tva_enabled as i32,
            payload.tva_rate,
            payload.default_printer,
            payload.language,
            payload.invoice_prefix,
            payload.quote_prefix,
            payload.bank_name,
            payload.bank_account,
            payload.bank_swift,
            payload.next_invoice_number,
            payload.next_quote_number,
            payload.payment_days,
            payload.quote_validity_days,
            payload.default_mentions,
            payload.paper_format,
            payload.default_copies,
            payload.pdf_include_logo as i32,
            payload.pdf_include_stamp as i32,
            payload.pdf_watermark_draft as i32,
            payload.date_format,
            payload.thousand_separator,
            payload.auto_backup_alert as i32,
            payload.update_auto_check as i32,
            payload.update_notify as i32,
        ],
    )
    .map_err(|e| format!("Failed to save settings: {e}"))?;

    get_settings(conn)
}
