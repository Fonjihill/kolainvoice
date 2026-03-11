use genpdf::elements::{Break, Image, LinearLayout, Paragraph, TableLayout};
use image::GenericImageView;
use genpdf::fonts::FontData;
use genpdf::style::Style;
use genpdf::{Alignment, Element, Margins, Size};

/// Load an image, converting RGBA to RGB (genpdf doesn't support alpha).
/// Resizes to fit within max_px (default 1000px) on the longest side.
fn load_image(path: &str) -> Option<Image> {
    load_image_max(path, 1000)
}

fn load_image_max(path: &str, max_px: u32) -> Option<Image> {
    let dyn_img = image::open(path).ok()?;
    let resized = if dyn_img.width() > max_px || dyn_img.height() > max_px {
        dyn_img.resize(max_px, max_px, image::imageops::FilterType::Lanczos3)
    } else {
        dyn_img
    };
    let rgb = image::DynamicImage::ImageRgb8(resized.to_rgb8());
    Image::from_dynamic_image(rgb).ok()
}

use crate::models::client::Client;
use crate::models::invoice::InvoiceDetail;
use crate::models::payment::Payment;
use crate::models::quote::QuoteDetail;
use crate::models::settings::Settings;

const FONT_REGULAR: &[u8] = include_bytes!("../../fonts/LiberationSans-Regular.ttf");
const FONT_BOLD: &[u8] = include_bytes!("../../fonts/LiberationSans-Bold.ttf");
const FONT_MONO: &[u8] = include_bytes!("../../fonts/LiberationMono-Regular.ttf");

fn load_font_family() -> Result<genpdf::fonts::FontFamily<FontData>, String> {
    let regular = FontData::new(FONT_REGULAR.to_vec(), None).map_err(|e| format!("Regular font: {e}"))?;
    let bold = FontData::new(FONT_BOLD.to_vec(), None).map_err(|e| format!("Bold font: {e}"))?;
    let italic = FontData::new(FONT_REGULAR.to_vec(), None).map_err(|e| format!("Italic font: {e}"))?;
    let bold_italic = FontData::new(FONT_BOLD.to_vec(), None).map_err(|e| format!("BoldItalic font: {e}"))?;
    Ok(genpdf::fonts::FontFamily { regular, bold, italic, bold_italic })
}

fn load_mono_family() -> Result<genpdf::fonts::FontFamily<FontData>, String> {
    let m1 = FontData::new(FONT_MONO.to_vec(), None).map_err(|e| format!("Mono font: {e}"))?;
    let m2 = FontData::new(FONT_MONO.to_vec(), None).map_err(|e| format!("Mono font: {e}"))?;
    let m3 = FontData::new(FONT_MONO.to_vec(), None).map_err(|e| format!("Mono font: {e}"))?;
    let m4 = FontData::new(FONT_MONO.to_vec(), None).map_err(|e| format!("Mono font: {e}"))?;
    Ok(genpdf::fonts::FontFamily { regular: m1, bold: m2, italic: m3, bold_italic: m4 })
}

// ── Helpers ─────────────────────────────────────

fn thousand_sep_char(separator: &str) -> char {
    match separator {
        "dot" => '.',
        _ => '\u{00A0}', // non-breaking space (default)
    }
}

fn fmt_fcfa_with(amount: i64, separator: &str) -> String {
    let sep = thousand_sep_char(separator);
    let s = amount.abs().to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 { result.push(sep); }
        result.push(c);
    }
    let formatted: String = result.chars().rev().collect();
    if amount < 0 { format!("-{} FCFA", formatted) } else { format!("{} FCFA", formatted) }
}

fn fmt_number_with(n: i64, separator: &str) -> String {
    let sep = thousand_sep_char(separator);
    let s = n.abs().to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 { result.push(sep); }
        result.push(c);
    }
    let formatted: String = result.chars().rev().collect();
    if n < 0 { format!("-{}", formatted) } else { formatted }
}

fn fmt_qty(q: f64) -> String {
    if q.fract() == 0.0 { format!("{}", q as i64) } else { format!("{:.2}", q) }
}

fn format_date_with(date: &str, date_format: &str) -> String {
    if date.len() >= 10 {
        let parts: Vec<&str> = date[..10].split('-').collect();
        if parts.len() == 3 {
            return match date_format {
                "MM/DD/YYYY" => format!("{}/{}/{}", parts[1], parts[2], parts[0]),
                _ => format!("{}/{}/{}", parts[2], parts[1], parts[0]), // DD/MM/YYYY (default)
            };
        }
    }
    date.to_string()
}

fn format_date_long(date: &str) -> String {
    if date.len() >= 10 {
        let parts: Vec<&str> = date[..10].split('-').collect();
        if parts.len() == 3 {
            let month = match parts[1] {
                "01" => "Janvier", "02" => "Fevrier", "03" => "Mars",
                "04" => "Avril", "05" => "Mai", "06" => "Juin",
                "07" => "Juillet", "08" => "Aout", "09" => "Septembre",
                "10" => "Octobre", "11" => "Novembre", "12" => "Decembre",
                _ => parts[1],
            };
            let day = parts[2].trim_start_matches('0');
            return format!("{} {} {}", day, month, parts[0]);
        }
    }
    date.to_string()
}

fn status_label(status: &str) -> &str {
    match status {
        "draft" => "BROUILLON", "sent" => "ENVOYEE", "paid" => "PAYEE",
        "cancelled" => "ANNULEE", "accepted" => "ACCEPTE", "refused" => "REFUSE",
        "expired" => "EXPIRE", _ => status,
    }
}

fn amount_in_words(n: i64) -> String {
    if n == 0 { return "zero".to_string(); }
    let n = n.unsigned_abs();

    fn units(n: u64) -> &'static str {
        match n {
            0 => "", 1 => "un", 2 => "deux", 3 => "trois", 4 => "quatre",
            5 => "cinq", 6 => "six", 7 => "sept", 8 => "huit", 9 => "neuf",
            10 => "dix", 11 => "onze", 12 => "douze", 13 => "treize",
            14 => "quatorze", 15 => "quinze", 16 => "seize", _ => "",
        }
    }

    fn tens(n: u64) -> String {
        if n == 0 { return String::new(); }
        if n <= 16 { return units(n).to_string(); }
        if n < 20 { return format!("dix-{}", units(n - 10)); }
        if n == 20 { return "vingt".to_string(); }
        if n == 21 { return "vingt-et-un".to_string(); }
        if n < 30 { return format!("vingt-{}", units(n - 20)); }
        if n == 30 { return "trente".to_string(); }
        if n == 31 { return "trente-et-un".to_string(); }
        if n < 40 { return format!("trente-{}", units(n - 30)); }
        if n == 40 { return "quarante".to_string(); }
        if n == 41 { return "quarante-et-un".to_string(); }
        if n < 50 { return format!("quarante-{}", units(n - 40)); }
        if n == 50 { return "cinquante".to_string(); }
        if n == 51 { return "cinquante-et-un".to_string(); }
        if n < 60 { return format!("cinquante-{}", units(n - 50)); }
        if n == 60 { return "soixante".to_string(); }
        if n == 61 { return "soixante-et-un".to_string(); }
        if n < 70 { return format!("soixante-{}", units(n - 60)); }
        if n == 70 { return "soixante-dix".to_string(); }
        if n == 71 { return "soixante-et-onze".to_string(); }
        if n < 80 { return format!("soixante-{}", tens(n - 60)); }
        if n == 80 { return "quatre-vingts".to_string(); }
        if n < 100 { return format!("quatre-vingt-{}", tens(n - 80)); }
        String::new()
    }

    fn hundreds(n: u64) -> String {
        if n == 0 { return String::new(); }
        if n < 100 { return tens(n); }
        let h = n / 100;
        let r = n % 100;
        let prefix = if h == 1 { "cent".to_string() } else { format!("{} cent", units(h)) };
        if r == 0 {
            if h > 1 { format!("{}s", prefix) } else { prefix }
        } else {
            format!("{} {}", prefix, tens(r))
        }
    }

    let mut parts = Vec::new();
    let billions = n / 1_000_000_000;
    let millions = (n % 1_000_000_000) / 1_000_000;
    let thousands = (n % 1_000_000) / 1_000;
    let remainder = n % 1_000;

    if billions > 0 {
        if billions == 1 { parts.push("un milliard".to_string()); }
        else { parts.push(format!("{} milliards", hundreds(billions))); }
    }
    if millions > 0 {
        if millions == 1 { parts.push("un million".to_string()); }
        else { parts.push(format!("{} millions", hundreds(millions))); }
    }
    if thousands > 0 {
        if thousands == 1 { parts.push("mille".to_string()); }
        else { parts.push(format!("{} mille", hundreds(thousands))); }
    }
    if remainder > 0 || parts.is_empty() {
        parts.push(hundreds(remainder));
    }

    parts.join(" ")
}

fn bordered_table(weights: Vec<usize>) -> TableLayout {
    let mut t = TableLayout::new(weights);
    t.set_cell_decorator(genpdf::elements::FrameCellDecorator::new(true, true, false));
    t
}

// Outer border only (no inner lines)
fn outer_bordered_table(weights: Vec<usize>) -> TableLayout {
    let mut t = TableLayout::new(weights);
    t.set_cell_decorator(genpdf::elements::FrameCellDecorator::new(false, true, false));
    t
}

fn layout_table(weights: Vec<usize>) -> TableLayout {
    let mut t = TableLayout::new(weights);
    t.set_cell_decorator(genpdf::elements::FrameCellDecorator::new(false, false, false));
    t
}

// ── Common doc data ─────────────────────────────

struct DocLine { description: String, quantity: f64, unit_price: i64, discount: f64, tva_rate: f64 }

struct DocData {
    title: String, number: String, status: String,
    issue_date: String, second_date: String, second_date_label: String,
    subtotal: i64, tva_amount: i64, total: i64, notes: String,
    lines: Vec<DocLine>,
    amount_paid: Option<i64>, payment_method: Option<String>, object: Option<String>,
}

// ── PDF Builder ─────────────────────────────────

fn generate_pdf(
    settings: &Settings,
    client: &Client,
    data: &DocData,
) -> Result<Vec<u8>, String> {
    let font_family = load_font_family()?;
    let mono_family = load_mono_family()?;

    let mut doc = genpdf::Document::new(font_family);
    let mono_ref = doc.add_font_family(mono_family);

    // Paper format from settings: "Letter" = 216x279mm, default "A4" = 210x297mm
    let paper_size = match settings.paper_format.as_str() {
        "Letter" => Size::new(216, 279),
        _ => Size::new(210, 297), // A4
    };
    doc.set_paper_size(paper_size);
    doc.set_font_size(9);
    doc.set_line_spacing(1.3);

    // TODO: pdf_watermark_draft — genpdf does not natively support watermarks (rotated
    // semi-transparent text behind content). A proper implementation would require a
    // post-processing step with a PDF manipulation crate (e.g. lopdf) to inject a
    // "BROUILLON" watermark on each page when data.status == "draft" && settings.pdf_watermark_draft.

    let mut decorator = genpdf::SimplePageDecorator::new();
    decorator.set_margins(Margins::trbl(15, 18, 15, 18));
    doc.set_page_decorator(decorator);

    // Local helpers that use settings
    let sep = &settings.thousand_separator;
    let dfmt = &settings.date_format;
    let fmt_fcfa = |amount: i64| fmt_fcfa_with(amount, sep);
    let fmt_number = |n: i64| fmt_number_with(n, sep);
    let format_date = |date: &str| format_date_with(date, dfmt);

    let s_mono = Style::from(mono_ref).with_font_size(9);
    let s_mono_bold = Style::from(mono_ref).with_font_size(9).bold();
    let pad = Margins::trbl(3, 5, 3, 5);
    let pad_sm = Margins::trbl(2, 3, 2, 3);

    let company_name = if settings.company_name.is_empty() { "Kola Invoice" } else { &settings.company_name };

    // ═══════════════════════════════════════════
    //  HEADER — Company info (left) + Doc info (right)
    // ═══════════════════════════════════════════

    let mut header_left = LinearLayout::vertical();

    // Logo replaces company name text when available
    let mut has_logo = false;
    if settings.pdf_include_logo {
        if let Some(ref logo_path) = settings.logo_path {
            if !logo_path.is_empty() {
                if let Some(img) = load_image(logo_path) {
                    header_left.push(img.with_scale(genpdf::Scale::new(0.4, 0.4)));
                    header_left.push(Break::new(0.3));
                    has_logo = true;
                }
            }
        }
    }

    if !has_logo {
        header_left.push(Paragraph::new(company_name).styled(Style::new().bold().with_font_size(16)));
        header_left.push(Break::new(0.2));
    }
    if !settings.company_address.is_empty() {
        header_left.push(Paragraph::new(settings.company_address.as_str()).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_phone.is_empty() {
        header_left.push(Paragraph::new(format!("Tel : {}", settings.company_phone)).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_email.is_empty() {
        header_left.push(Paragraph::new(settings.company_email.as_str()).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_niu.is_empty() {
        header_left.push(Paragraph::new(format!("NIU : {}", settings.company_niu)).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_rccm.is_empty() {
        header_left.push(Paragraph::new(format!("RCCM : {}", settings.company_rccm)).styled(Style::new().with_font_size(8)));
    }

    // Right: document type + number in a box
    let mut header_right = LinearLayout::vertical();

    let mut title_box = outer_bordered_table(vec![1]);
    let mut title_content = LinearLayout::vertical();
    title_content.push(
        Paragraph::new("ORIGINAL")
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(6)),
    );
    title_content.push(
        Paragraph::new(data.title.as_str())
            .aligned(Alignment::Center)
            .styled(Style::new().bold().with_font_size(14)),
    );
    title_content.push(
        Paragraph::new(format!("N\u{00B0} {}", data.number))
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(9)),
    );
    title_content.push(
        Paragraph::new(status_label(&data.status))
            .aligned(Alignment::Center)
            .styled(Style::new().bold().with_font_size(8)),
    );
    title_box.row().element(title_content.padded(Margins::trbl(4, 8, 4, 8)))
        .push().map_err(|e| format!("Title box: {e}"))?;
    header_right.push(title_box);

    let mut header = layout_table(vec![3, 2]);
    header.row()
        .element(header_left)
        .element(header_right)
        .push().map_err(|e| format!("Header: {e}"))?;
    doc.push(header);

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  DATE + CLIENT
    // ═══════════════════════════════════════════

    // Left: dates & payment details
    let mut details_left = LinearLayout::vertical();

    // Date
    let city = if !settings.company_address.is_empty() {
        settings.company_address.split(',').last().unwrap_or("").trim().to_string()
    } else { String::new() };
    let date_str = if city.is_empty() {
        format_date_long(&data.issue_date)
    } else {
        format!("{}, {}", city, format_date_long(&data.issue_date))
    };
    details_left.push(Paragraph::new("Date d'emission").styled(Style::new().with_font_size(7)));
    details_left.push(Paragraph::new(date_str).styled(Style::new().bold().with_font_size(9)));
    details_left.push(Break::new(0.3));

    details_left.push(Paragraph::new(data.second_date_label.as_str()).styled(Style::new().with_font_size(7)));
    details_left.push(Paragraph::new(format_date(&data.second_date)).styled(Style::new().bold().with_font_size(9)));
    details_left.push(Break::new(0.3));

    if let Some(ref method) = data.payment_method {
        if !method.is_empty() {
            details_left.push(Paragraph::new("Mode de paiement").styled(Style::new().with_font_size(7)));
            details_left.push(Paragraph::new(method.as_str()).styled(Style::new().bold().with_font_size(9)));
        }
    }

    if let Some(ref object) = data.object {
        if !object.is_empty() {
            details_left.push(Paragraph::new("Objet").styled(Style::new().with_font_size(7)));
            details_left.push(Paragraph::new(object.as_str()).styled(Style::new().bold().with_font_size(9)));
        }
    }

    // Right: client in bordered box
    let mut details_right = LinearLayout::vertical();
    details_right.push(Paragraph::new("Facturer a :").styled(Style::new().with_font_size(7)));
    details_right.push(Break::new(0.3));

    let mut client_box = outer_bordered_table(vec![1]);
    let mut client_content = LinearLayout::vertical();
    client_content.push(Paragraph::new(client.name.as_str()).styled(Style::new().bold().with_font_size(10)));
    if !client.address.is_empty() {
        client_content.push(Paragraph::new(client.address.as_str()).styled(Style::new().with_font_size(8)));
    }
    if !client.niu.is_empty() {
        client_content.push(Paragraph::new(format!("NIU : {}", client.niu)).styled(Style::new().with_font_size(8)));
    }
    if !client.phone.is_empty() {
        client_content.push(Paragraph::new(format!("Tel : {}", client.phone)).styled(Style::new().with_font_size(8)));
    }
    if !client.email.is_empty() {
        client_content.push(Paragraph::new(client.email.as_str()).styled(Style::new().with_font_size(8)));
    }
    client_box.row().element(client_content.padded(pad)).push().map_err(|e| format!("Client: {e}"))?;
    details_right.push(client_box);

    let mut details_row = layout_table(vec![1, 1]);
    details_row.row()
        .element(details_left)
        .element(details_right)
        .push().map_err(|e| format!("Details: {e}"))?;
    doc.push(details_row);

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  LINES TABLE
    // ═══════════════════════════════════════════

    let mut table = bordered_table(vec![5, 1, 2, 1, 1, 2]);

    let hs = Style::new().bold().with_font_size(8);
    table.row()
        .element(Paragraph::new("DESIGNATION").styled(hs).padded(pad_sm))
        .element(Paragraph::new("QTE").aligned(Alignment::Center).styled(hs).padded(pad_sm))
        .element(Paragraph::new("P.U.").aligned(Alignment::Right).styled(hs).padded(pad_sm))
        .element(Paragraph::new("REM.").aligned(Alignment::Center).styled(hs).padded(pad_sm))
        .element(Paragraph::new("TVA").aligned(Alignment::Center).styled(hs).padded(pad_sm))
        .element(Paragraph::new("MONTANT").aligned(Alignment::Right).styled(hs).padded(pad_sm))
        .push().map_err(|e| format!("Table header: {e}"))?;

    for line in &data.lines {
        let ht = (line.unit_price as f64) * line.quantity * (1.0 - line.discount / 100.0);
        let ht_rounded = ht.round() as i64;
        let discount_str = if line.discount > 0.0 { format!("{}%", line.discount) } else { "\u{2014}".into() };
        let tva_str = if line.tva_rate > 0.0 { format!("{}%", line.tva_rate) } else { "\u{2014}".into() };

        table.row()
            .element(Paragraph::new(line.description.as_str()).styled(Style::new().with_font_size(9)).padded(pad_sm))
            .element(Paragraph::new(fmt_qty(line.quantity)).aligned(Alignment::Center).styled(s_mono).padded(pad_sm))
            .element(Paragraph::new(fmt_number(line.unit_price)).aligned(Alignment::Right).styled(s_mono).padded(pad_sm))
            .element(Paragraph::new(discount_str).aligned(Alignment::Center).styled(s_mono).padded(pad_sm))
            .element(Paragraph::new(tva_str).aligned(Alignment::Center).styled(s_mono).padded(pad_sm))
            .element(Paragraph::new(fmt_number(ht_rounded)).aligned(Alignment::Right).styled(s_mono_bold).padded(pad_sm))
            .push().map_err(|e| format!("Table row: {e}"))?;
    }

    doc.push(table);
    doc.push(Break::new(0.8));

    // ═══════════════════════════════════════════
    //  TOTALS (no borders, right-aligned, clean)
    // ═══════════════════════════════════════════

    let mut totals = layout_table(vec![3, 2]);

    totals.row()
        .element(Paragraph::new("Sous-total HT").aligned(Alignment::Right).styled(Style::new().with_font_size(9)).padded(pad_sm))
        .element(Paragraph::new(fmt_fcfa(data.subtotal)).aligned(Alignment::Right).styled(s_mono).padded(pad_sm))
        .push().map_err(|e| format!("Totals: {e}"))?;

    totals.row()
        .element(Paragraph::new("TVA").aligned(Alignment::Right).styled(Style::new().with_font_size(9)).padded(pad_sm))
        .element(Paragraph::new(fmt_fcfa(data.tva_amount)).aligned(Alignment::Right).styled(s_mono).padded(pad_sm))
        .push().map_err(|e| format!("Totals: {e}"))?;

    // Total TTC in a bordered box for emphasis
    let mut total_box = outer_bordered_table(vec![3, 2]);
    total_box.row()
        .element(Paragraph::new("TOTAL TTC").aligned(Alignment::Right).styled(Style::new().bold().with_font_size(10)).padded(pad_sm))
        .element(Paragraph::new(fmt_fcfa(data.total)).aligned(Alignment::Right).styled(Style::from(mono_ref).bold().with_font_size(10)).padded(pad_sm))
        .push().map_err(|e| format!("Total TTC: {e}"))?;

    if let Some(paid) = data.amount_paid {
        let mut paid_table = layout_table(vec![3, 2]);
        paid_table.row()
            .element(Paragraph::new("Montant paye").aligned(Alignment::Right).styled(Style::new().with_font_size(9)).padded(pad_sm))
            .element(Paragraph::new(fmt_fcfa(paid)).aligned(Alignment::Right).styled(Style::from(mono_ref).with_font_size(9)).padded(pad_sm))
            .push().map_err(|e| format!("Paid: {e}"))?;

        if paid < data.total {
            paid_table.row()
                .element(Paragraph::new("RESTE A PAYER").aligned(Alignment::Right).styled(Style::new().bold().with_font_size(10)).padded(pad_sm))
                .element(Paragraph::new(fmt_fcfa(data.total - paid)).aligned(Alignment::Right).styled(Style::from(mono_ref).bold().with_font_size(10)).padded(pad_sm))
                .push().map_err(|e| format!("Reste: {e}"))?;
        }

        // Wrap: spacer | (totals + total_box + paid)
        let mut right_totals = LinearLayout::vertical();
        right_totals.push(totals);
        right_totals.push(Break::new(0.3));
        right_totals.push(total_box);
        right_totals.push(Break::new(0.2));
        right_totals.push(paid_table);

        let mut wrapper = layout_table(vec![1, 2]);
        wrapper.row().element(Paragraph::new("")).element(right_totals)
            .push().map_err(|e| format!("Wrapper: {e}"))?;
        doc.push(wrapper);
    } else {
        let mut right_totals = LinearLayout::vertical();
        right_totals.push(totals);
        right_totals.push(Break::new(0.3));
        right_totals.push(total_box);

        let mut wrapper = layout_table(vec![1, 2]);
        wrapper.row().element(Paragraph::new("")).element(right_totals)
            .push().map_err(|e| format!("Wrapper: {e}"))?;
        doc.push(wrapper);
    }

    doc.push(Break::new(0.8));

    // ═══════════════════════════════════════════
    //  TVA SUMMARY (if any TVA)
    // ═══════════════════════════════════════════

    // Collect unique TVA rates
    let mut tva_map: std::collections::BTreeMap<String, (i64, i64)> = std::collections::BTreeMap::new();
    for line in &data.lines {
        if line.tva_rate > 0.0 {
            let ht = ((line.unit_price as f64) * line.quantity * (1.0 - line.discount / 100.0)).round() as i64;
            let tva_amt = ((ht as f64) * line.tva_rate / 100.0).round() as i64;
            let key = format!("{}%", line.tva_rate);
            let entry = tva_map.entry(key).or_insert((0, 0));
            entry.0 += ht;
            entry.1 += tva_amt;
        }
    }

    if !tva_map.is_empty() {
        doc.push(Paragraph::new("Recapitulatif TVA").styled(Style::new().bold().with_font_size(8)));
        doc.push(Break::new(0.2));

        let mut tva_table = bordered_table(vec![2, 2, 2]);
        let ths = Style::new().bold().with_font_size(7);
        tva_table.row()
            .element(Paragraph::new("Base HT").styled(ths).padded(pad_sm))
            .element(Paragraph::new("Taux").aligned(Alignment::Center).styled(ths).padded(pad_sm))
            .element(Paragraph::new("Montant TVA").aligned(Alignment::Right).styled(ths).padded(pad_sm))
            .push().map_err(|e| format!("TVA header: {e}"))?;

        for (rate, (base, amt)) in &tva_map {
            tva_table.row()
                .element(Paragraph::new(fmt_fcfa(*base)).styled(Style::new().with_font_size(8)).padded(pad_sm))
                .element(Paragraph::new(rate.as_str()).aligned(Alignment::Center).styled(Style::new().with_font_size(8)).padded(pad_sm))
                .element(Paragraph::new(fmt_fcfa(*amt)).aligned(Alignment::Right).styled(Style::new().with_font_size(8)).padded(pad_sm))
                .push().map_err(|e| format!("TVA row: {e}"))?;
        }

        // Push TVA table to the left (not full width)
        let mut tva_wrapper = layout_table(vec![2, 3]);
        tva_wrapper.row()
            .element(tva_table)
            .element(Paragraph::new(""))
            .push().map_err(|e| format!("TVA wrapper: {e}"))?;
        doc.push(tva_wrapper);

        doc.push(Break::new(0.8));
    }

    // ═══════════════════════════════════════════
    //  ARRETE
    // ═══════════════════════════════════════════

    let doc_label = if data.title == "DEVIS" { "le present devis" } else { "la presente facture" };
    doc.push(
        Paragraph::new(format!(
            "Arrete {} a la somme de : {} francs CFA.",
            doc_label, amount_in_words(data.total)
        ))
        .styled(Style::new().bold().with_font_size(9)),
    );

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  SIGNATURES
    // ═══════════════════════════════════════════

    // "Fait à [ville], le [date]"
    let fait_a = if city.is_empty() {
        format!("Fait {}", format_date_long(&data.issue_date))
    } else {
        format!("Fait a {}, {}", city, format_date_long(&data.issue_date))
    };
    doc.push(Paragraph::new(fait_a).styled(Style::new().with_font_size(8)));
    doc.push(Break::new(0.5));

    let mut sig_left = LinearLayout::vertical();
    sig_left.push(Paragraph::new("Le Client").styled(Style::new().bold().with_font_size(9)));
    sig_left.push(Paragraph::new("Cachet et signature").styled(Style::new().with_font_size(7)));
    sig_left.push(Break::new(0.5));

    // Stamp / signature image
    let mut has_stamp = false;
    if settings.pdf_include_stamp {
        if let Some(ref stamp_path) = settings.stamp_path {
            if !stamp_path.is_empty() {
                if let Some(img) = load_image(stamp_path) {
                    sig_left.push(img.with_scale(genpdf::Scale::new(0.3, 0.3)));
                    has_stamp = true;
                }
            }
        }
    }
    if !has_stamp {
        sig_left.push(Break::new(2.5));
    }

    let mut sig_right = LinearLayout::vertical();
    sig_right.push(Paragraph::new("Le Client").aligned(Alignment::Right).styled(Style::new().bold().with_font_size(9)));
    sig_right.push(Paragraph::new("Lu et approuve").aligned(Alignment::Right).styled(Style::new().with_font_size(7)));
    sig_right.push(Paragraph::new("Cachet et signature").aligned(Alignment::Right).styled(Style::new().with_font_size(7)));
    sig_right.push(Break::new(3));

    let mut sig_table = layout_table(vec![1, 1]);
    sig_table.row()
        .element(sig_left)
        .element(sig_right)
        .push().map_err(|e| format!("Signatures: {e}"))?;
    doc.push(sig_table);

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  BANK DETAILS
    // ═══════════════════════════════════════════

    let has_bank = !settings.bank_name.is_empty() || !settings.bank_account.is_empty();
    if has_bank {
        let mut bank_parts = Vec::new();
        if !settings.bank_name.is_empty() { bank_parts.push(format!("Banque : {}", settings.bank_name)); }
        if !settings.bank_account.is_empty() { bank_parts.push(format!("Compte : {}", settings.bank_account)); }
        if !settings.bank_swift.is_empty() { bank_parts.push(format!("SWIFT : {}", settings.bank_swift)); }

        doc.push(Paragraph::new("Coordonnees bancaires").styled(Style::new().bold().with_font_size(8)));
        doc.push(Paragraph::new(bank_parts.join("  |  ")).styled(Style::new().with_font_size(8)));
        doc.push(Break::new(0.5));
    }

    // ═══════════════════════════════════════════
    //  NOTES + MENTIONS
    // ═══════════════════════════════════════════

    if !data.notes.is_empty() {
        doc.push(Paragraph::new("Notes").styled(Style::new().bold().with_font_size(8)));
        doc.push(Paragraph::new(data.notes.as_str()).styled(Style::new().with_font_size(8)));
        doc.push(Break::new(0.5));
    }

    if !settings.default_mentions.is_empty() {
        doc.push(
            Paragraph::new(settings.default_mentions.as_str())
                .styled(Style::new().with_font_size(7)),
        );
        doc.push(Break::new(0.3));
    }

    // Penalites de retard (invoices only)
    if data.title == "FACTURE" {
        doc.push(
            Paragraph::new("En cas de retard de paiement, une penalite de 1,5% par mois sera appliquee, conformement a la reglementation en vigueur.")
                .styled(Style::new().with_font_size(6)),
        );
        doc.push(Break::new(0.3));
    }

    // Merci
    doc.push(
        Paragraph::new("Merci pour votre confiance.")
            .aligned(Alignment::Center)
            .styled(Style::new().bold().with_font_size(8)),
    );

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  FOOTER
    // ═══════════════════════════════════════════

    let mut footer_parts = vec![company_name.to_string()];
    if !settings.company_niu.is_empty() { footer_parts.push(format!("NIU: {}", settings.company_niu)); }
    if !settings.company_phone.is_empty() { footer_parts.push(format!("Tel: {}", settings.company_phone)); }
    if !settings.company_email.is_empty() { footer_parts.push(settings.company_email.clone()); }
    doc.push(
        Paragraph::new(footer_parts.join("   \u{2022}   "))
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(7)),
    );

    let mut buf = Vec::new();
    doc.render(&mut buf).map_err(|e| format!("PDF render: {e}"))?;
    Ok(buf)
}

// ── Public API ──────────────────────────────────

pub fn generate_invoice_pdf(
    settings: &Settings, client: &Client, invoice: &InvoiceDetail,
) -> Result<Vec<u8>, String> {
    let data = DocData {
        title: "FACTURE".into(), number: invoice.number.clone(),
        status: invoice.status.clone(), issue_date: invoice.issue_date.clone(),
        second_date: invoice.due_date.clone().unwrap_or_default(),
        second_date_label: "Echeance".into(),
        subtotal: invoice.subtotal, tva_amount: invoice.tva_amount, total: invoice.total,
        notes: invoice.notes.clone(),
        lines: invoice.lines.iter().map(|l| DocLine {
            description: l.description.clone(), quantity: l.quantity,
            unit_price: l.unit_price, discount: l.discount, tva_rate: l.tva_rate,
        }).collect(),
        amount_paid: Some(invoice.amount_paid),
        payment_method: invoice.payment_method.clone(), object: None,
    };
    generate_pdf(settings, client, &data)
}

pub fn generate_quote_pdf(
    settings: &Settings, client: &Client, quote: &QuoteDetail,
) -> Result<Vec<u8>, String> {
    let data = DocData {
        title: "DEVIS".into(), number: quote.number.clone(),
        status: quote.status.clone(), issue_date: quote.issue_date.clone(),
        second_date: quote.validity_date.clone().unwrap_or_default(),
        second_date_label: "Validite".into(),
        subtotal: quote.subtotal, tva_amount: quote.tva_amount, total: quote.total,
        notes: quote.notes.clone(),
        lines: quote.lines.iter().map(|l| DocLine {
            description: l.description.clone(), quantity: l.quantity,
            unit_price: l.unit_price, discount: l.discount, tva_rate: l.tva_rate,
        }).collect(),
        amount_paid: None, payment_method: None, object: Some(quote.object.clone()),
    };
    generate_pdf(settings, client, &data)
}

fn payment_method_label(method: &str) -> &str {
    match method {
        "cash" => "Especes",
        "mtn_momo" => "MTN Mobile Money",
        "orange_money" => "Orange Money",
        "virement" => "Virement bancaire",
        "cheque" => "Cheque",
        other => other,
    }
}

pub fn generate_receipt_pdf(
    settings: &Settings,
    client: &Client,
    invoice: &InvoiceDetail,
    payment: &Payment,
    total_paid: i64,
) -> Result<Vec<u8>, String> {
    let font_family = load_font_family()?;
    let mono_family = load_mono_family()?;

    let mut doc = genpdf::Document::new(font_family);
    let mono_ref = doc.add_font_family(mono_family);

    // Paper format from settings
    let paper_size = match settings.paper_format.as_str() {
        "Letter" => Size::new(216, 279),
        _ => Size::new(210, 297), // A4
    };
    doc.set_paper_size(paper_size);
    doc.set_font_size(9);
    doc.set_line_spacing(1.3);

    let mut decorator = genpdf::SimplePageDecorator::new();
    decorator.set_margins(Margins::trbl(15, 18, 15, 18));
    doc.set_page_decorator(decorator);

    // Local helpers that use settings
    let sep = &settings.thousand_separator;
    let fmt_fcfa = |amount: i64| fmt_fcfa_with(amount, sep);

    let s_mono = Style::from(mono_ref).with_font_size(9);
    let s_mono_bold = Style::from(mono_ref).with_font_size(10).bold();
    let pad = Margins::trbl(3, 5, 3, 5);

    let company_name = if settings.company_name.is_empty() { "Kola Invoice" } else { &settings.company_name };

    // ═══════════════════════════════════════════
    //  HEADER — Company info (left) + Title (right)
    // ═══════════════════════════════════════════

    let mut header_left = LinearLayout::vertical();

    let mut has_logo = false;
    if settings.pdf_include_logo {
        if let Some(ref logo_path) = settings.logo_path {
            if !logo_path.is_empty() {
                if let Some(img) = load_image(logo_path) {
                    header_left.push(img.with_scale(genpdf::Scale::new(0.4, 0.4)));
                    header_left.push(Break::new(0.3));
                    has_logo = true;
                }
            }
        }
    }

    if !has_logo {
        header_left.push(Paragraph::new(company_name).styled(Style::new().bold().with_font_size(16)));
        header_left.push(Break::new(0.2));
    }
    if !settings.company_address.is_empty() {
        header_left.push(Paragraph::new(settings.company_address.as_str()).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_phone.is_empty() {
        header_left.push(Paragraph::new(format!("Tel : {}", settings.company_phone)).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_email.is_empty() {
        header_left.push(Paragraph::new(settings.company_email.as_str()).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_niu.is_empty() {
        header_left.push(Paragraph::new(format!("NIU : {}", settings.company_niu)).styled(Style::new().with_font_size(8)));
    }
    if !settings.company_rccm.is_empty() {
        header_left.push(Paragraph::new(format!("RCCM : {}", settings.company_rccm)).styled(Style::new().with_font_size(8)));
    }

    // Right: title box
    let mut header_right = LinearLayout::vertical();
    let mut title_box = outer_bordered_table(vec![1]);
    let mut title_content = LinearLayout::vertical();
    title_content.push(
        Paragraph::new("RECU DE PAIEMENT")
            .aligned(Alignment::Center)
            .styled(Style::new().bold().with_font_size(14)),
    );
    title_content.push(
        Paragraph::new(format!("N\u{00B0} {}", payment.number))
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(9)),
    );
    title_box.row().element(title_content.padded(Margins::trbl(4, 8, 4, 8)))
        .push().map_err(|e| format!("Title box: {e}"))?;
    header_right.push(title_box);

    let mut header = layout_table(vec![3, 2]);
    header.row()
        .element(header_left)
        .element(header_right)
        .push().map_err(|e| format!("Header: {e}"))?;
    doc.push(header);

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  CLIENT INFO (right side)
    // ═══════════════════════════════════════════

    let mut client_label = LinearLayout::vertical();
    client_label.push(Paragraph::new(""));

    let mut client_section = LinearLayout::vertical();
    client_section.push(Paragraph::new("Client :").styled(Style::new().with_font_size(7)));
    client_section.push(Break::new(0.3));

    let mut client_box = outer_bordered_table(vec![1]);
    let mut client_content = LinearLayout::vertical();
    client_content.push(Paragraph::new(client.name.as_str()).styled(Style::new().bold().with_font_size(10)));
    if !client.address.is_empty() {
        client_content.push(Paragraph::new(client.address.as_str()).styled(Style::new().with_font_size(8)));
    }
    if !client.niu.is_empty() {
        client_content.push(Paragraph::new(format!("NIU : {}", client.niu)).styled(Style::new().with_font_size(8)));
    }
    if !client.phone.is_empty() {
        client_content.push(Paragraph::new(format!("Tel : {}", client.phone)).styled(Style::new().with_font_size(8)));
    }
    if !client.email.is_empty() {
        client_content.push(Paragraph::new(client.email.as_str()).styled(Style::new().with_font_size(8)));
    }
    client_box.row().element(client_content.padded(pad)).push().map_err(|e| format!("Client: {e}"))?;
    client_section.push(client_box);

    let mut client_row = layout_table(vec![1, 1]);
    client_row.row()
        .element(client_label)
        .element(client_section)
        .push().map_err(|e| format!("Client row: {e}"))?;
    doc.push(client_row);

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  PAYMENT DETAILS
    // ═══════════════════════════════════════════

    doc.push(Paragraph::new("Details du paiement").styled(Style::new().bold().with_font_size(10)));
    doc.push(Break::new(0.3));

    let mut pay_table = outer_bordered_table(vec![2, 3]);

    pay_table.row()
        .element(Paragraph::new("Date du paiement").styled(Style::new().with_font_size(9)).padded(pad))
        .element(Paragraph::new(format_date_long(&payment.payment_date)).styled(Style::new().bold().with_font_size(9)).padded(pad))
        .push().map_err(|e| format!("Pay date: {e}"))?;

    pay_table.row()
        .element(Paragraph::new("Montant paye").styled(Style::new().with_font_size(9)).padded(pad))
        .element(Paragraph::new(fmt_fcfa(payment.amount)).styled(s_mono_bold).padded(pad))
        .push().map_err(|e| format!("Pay amount: {e}"))?;

    pay_table.row()
        .element(Paragraph::new("Mode de paiement").styled(Style::new().with_font_size(9)).padded(pad))
        .element(Paragraph::new(payment_method_label(&payment.payment_method)).styled(Style::new().bold().with_font_size(9)).padded(pad))
        .push().map_err(|e| format!("Pay method: {e}"))?;

    doc.push(pay_table);
    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  INVOICE REFERENCE
    // ═══════════════════════════════════════════

    doc.push(Paragraph::new(format!("Paiement pour la facture {}", invoice.number)).styled(Style::new().bold().with_font_size(10)));
    doc.push(Break::new(0.3));

    let reste = invoice.total - total_paid;

    let mut inv_table = outer_bordered_table(vec![2, 3]);

    inv_table.row()
        .element(Paragraph::new("Total facture").styled(Style::new().with_font_size(9)).padded(pad))
        .element(Paragraph::new(fmt_fcfa(invoice.total)).styled(s_mono).padded(pad))
        .push().map_err(|e| format!("Inv total: {e}"))?;

    inv_table.row()
        .element(Paragraph::new("Cumul paye").styled(Style::new().with_font_size(9)).padded(pad))
        .element(Paragraph::new(fmt_fcfa(total_paid)).styled(s_mono).padded(pad))
        .push().map_err(|e| format!("Cumul: {e}"))?;

    if reste <= 0 {
        inv_table.row()
            .element(Paragraph::new("Reste a payer").styled(Style::new().bold().with_font_size(9)).padded(pad))
            .element(Paragraph::new("FACTURE SOLDEE").styled(Style::new().bold().with_font_size(10)).padded(pad))
            .push().map_err(|e| format!("Solde: {e}"))?;
    } else {
        inv_table.row()
            .element(Paragraph::new("Reste a payer").styled(Style::new().bold().with_font_size(9)).padded(pad))
            .element(Paragraph::new(fmt_fcfa(reste)).styled(Style::from(mono_ref).bold().with_font_size(10)).padded(pad))
            .push().map_err(|e| format!("Reste: {e}"))?;
    }

    doc.push(inv_table);
    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  NOTES
    // ═══════════════════════════════════════════

    if !payment.notes.is_empty() {
        doc.push(Paragraph::new("Notes").styled(Style::new().bold().with_font_size(8)));
        doc.push(Paragraph::new(payment.notes.as_str()).styled(Style::new().with_font_size(8)));
        doc.push(Break::new(0.8));
    }

    // ═══════════════════════════════════════════
    //  ARRETE
    // ═══════════════════════════════════════════

    doc.push(
        Paragraph::new(format!(
            "Arrete le present recu a la somme de : {} francs CFA.",
            amount_in_words(payment.amount)
        ))
        .styled(Style::new().bold().with_font_size(9)),
    );

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  SIGNATURES
    // ═══════════════════════════════════════════

    let city = if !settings.company_address.is_empty() {
        settings.company_address.split(',').last().unwrap_or("").trim().to_string()
    } else { String::new() };

    let fait_a = if city.is_empty() {
        format!("Fait {}", format_date_long(&payment.payment_date))
    } else {
        format!("Fait a {}, {}", city, format_date_long(&payment.payment_date))
    };
    doc.push(Paragraph::new(fait_a).styled(Style::new().with_font_size(8)));
    doc.push(Break::new(0.5));

    let mut sig_left = LinearLayout::vertical();
    sig_left.push(Paragraph::new("Le Fournisseur").styled(Style::new().bold().with_font_size(9)));
    sig_left.push(Paragraph::new("Cachet et signature").styled(Style::new().with_font_size(7)));
    sig_left.push(Break::new(0.5));

    let mut has_stamp = false;
    if settings.pdf_include_stamp {
        if let Some(ref stamp_path) = settings.stamp_path {
            if !stamp_path.is_empty() {
                if let Some(img) = load_image(stamp_path) {
                    sig_left.push(img.with_scale(genpdf::Scale::new(0.3, 0.3)));
                    has_stamp = true;
                }
            }
        }
    }
    if !has_stamp {
        sig_left.push(Break::new(2.5));
    }

    let mut sig_right = LinearLayout::vertical();
    sig_right.push(Paragraph::new("Le Client").aligned(Alignment::Right).styled(Style::new().bold().with_font_size(9)));
    sig_right.push(Paragraph::new("Lu et approuve").aligned(Alignment::Right).styled(Style::new().with_font_size(7)));
    sig_right.push(Paragraph::new("Cachet et signature").aligned(Alignment::Right).styled(Style::new().with_font_size(7)));
    sig_right.push(Break::new(3));

    let mut sig_table = layout_table(vec![1, 1]);
    sig_table.row()
        .element(sig_left)
        .element(sig_right)
        .push().map_err(|e| format!("Signatures: {e}"))?;
    doc.push(sig_table);

    doc.push(Break::new(1));

    // ═══════════════════════════════════════════
    //  FOOTER
    // ═══════════════════════════════════════════

    doc.push(
        Paragraph::new("Merci pour votre confiance.")
            .aligned(Alignment::Center)
            .styled(Style::new().bold().with_font_size(8)),
    );

    doc.push(Break::new(1));

    let mut footer_parts = vec![company_name.to_string()];
    if !settings.company_niu.is_empty() { footer_parts.push(format!("NIU: {}", settings.company_niu)); }
    if !settings.company_phone.is_empty() { footer_parts.push(format!("Tel: {}", settings.company_phone)); }
    if !settings.company_email.is_empty() { footer_parts.push(settings.company_email.clone()); }
    doc.push(
        Paragraph::new(footer_parts.join("   \u{2022}   "))
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(7)),
    );

    let mut buf = Vec::new();
    doc.render(&mut buf).map_err(|e| format!("PDF render: {e}"))?;
    Ok(buf)
}
