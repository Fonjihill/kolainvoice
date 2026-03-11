# Vente Directe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create an invoice and record full payment in a single atomic operation (point-of-sale workflow).

**Architecture:** Add a system "Client anonyme" via SQL migration. Add a `create_direct_sale` Rust command that creates invoice + payment in one transaction. Reuse `InvoiceForm` with a `direct-sale` mode that pre-fills client anonyme, hides due date, and shows "Encaisser" instead of "Enregistrer". Add buttons on Dashboard and Invoices page.

**Tech Stack:** Rust/Tauri 2 (backend), React 19 + TypeScript + Tailwind (frontend), SQLite

---

### Task 1: SQL Migration — Add `is_system` flag to clients + create "Client anonyme"

**Files:**
- Create: `src-tauri/src/database/sql/009_client_anonyme.sql`
- Modify: `src-tauri/src/database/migrations.rs`

**Step 1: Create migration SQL**

Create `src-tauri/src/database/sql/009_client_anonyme.sql`:

```sql
-- Add is_system flag to clients (0 = normal, 1 = system client)
ALTER TABLE clients ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

-- Create the "Client anonyme" system client
INSERT INTO clients (name, is_system) VALUES ('Client anonyme', 1);
```

**Step 2: Register migration**

In `src-tauri/src/database/migrations.rs`, add to the migrations list:

```rust
(9, "009_client_anonyme", include_str!("sql/009_client_anonyme.sql")),
```

**Step 3: Protect system client from archive/update**

In `src-tauri/src/database/clients.rs`, find the `archive_client` function and add a guard at the top:

```rust
// Check if system client
let is_system: i32 = conn
    .query_row("SELECT is_system FROM clients WHERE id = ?1", params![id], |r| r.get(0))
    .map_err(|e| format!("Client not found: {e}"))?;
if is_system == 1 {
    return Err("Le client systeme ne peut pas etre modifie".to_string());
}
```

Do the same in `update_client`.

**Step 4: Filter system clients from search and client list**

In `src-tauri/src/database/clients.rs`:
- In `get_all_clients`, add `AND is_system = 0` to the WHERE clause
- In `search_clients`, add `AND is_system = 0` to the WHERE clause

The system client will only be fetched by explicit ID (for direct sale pre-selection).

**Step 5: Add command to get system client ID**

In `src-tauri/src/database/clients.rs`, add:

```rust
pub fn get_system_client_id(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT id FROM clients WHERE is_system = 1 LIMIT 1",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("System client not found: {e}"))
}
```

In `src-tauri/src/commands/clients.rs`, add:

```rust
#[tauri::command]
pub fn get_system_client_id(state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::get_system_client_id(&conn)
}
```

Register in `src-tauri/src/lib.rs` invoke_handler:

```rust
commands::clients::get_system_client_id,
```

**Step 6: Verify**

Run: `cd app/src-tauri && cargo check`
Expected: compiles with no errors

---

### Task 2: Backend — `create_direct_sale` command

**Files:**
- Modify: `src-tauri/src/database/invoices.rs`
- Modify: `src-tauri/src/commands/invoices.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/models/invoice.rs`

**Step 1: Add payload struct**

In `src-tauri/src/models/invoice.rs`, add:

```rust
#[derive(Debug, Deserialize)]
pub struct DirectSalePayload {
    pub client_id: i64,
    pub issue_date: String,
    pub payment_method: String,
    pub notes: String,
    pub lines: Vec<InvoiceLinePayload>,
}
```

**Step 2: Add `create_direct_sale` in database layer**

In `src-tauri/src/database/invoices.rs`, add this function after `create_invoice`:

```rust
pub fn create_direct_sale(
    conn: &mut Connection,
    payload: &DirectSalePayload,
) -> Result<InvoiceDetail, String> {
    let prefix: String = conn
        .query_row("SELECT invoice_prefix FROM settings WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| format!("Settings error: {e}"))?;

    let number = next_invoice_number(conn, &prefix)?;

    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    // 1. Create invoice directly as "paid"
    let mut line_data: Vec<(i64, f64)> = Vec::new();
    tx.execute(
        "INSERT INTO invoices (number, client_id, status, issue_date, due_date, payment_method, notes,
                               subtotal, tva_amount, total, amount_paid)
         VALUES (?1, ?2, 'paid', ?3, NULL, ?4, ?5, 0, 0, 0, 0)",
        params![number, payload.client_id, payload.issue_date, payload.payment_method, payload.notes],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let invoice_id = tx.last_insert_rowid();

    // 2. Insert lines
    for line in &payload.lines {
        let line_total = compute_line_total(line.quantity, line.unit_price, line.discount);
        tx.execute(
            "INSERT INTO invoice_lines (invoice_id, catalogue_id, description, quantity,
                                        unit_price, discount, tva_rate, line_total, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                invoice_id, line.catalogue_id, line.description, line.quantity,
                line.unit_price, line.discount, line.tva_rate, line_total, line.sort_order,
            ],
        )
        .map_err(|e| format!("Line insert error: {e}"))?;
        line_data.push((line_total, line.tva_rate));
    }

    // 3. Compute totals
    let (subtotal, tva_amount, total) = compute_totals(&line_data);
    tx.execute(
        "UPDATE invoices SET subtotal = ?1, tva_amount = ?2, total = ?3, amount_paid = ?3 WHERE id = ?4",
        params![subtotal, tva_amount, total, invoice_id],
    )
    .map_err(|e| format!("Totals update error: {e}"))?;

    // 4. Create payment receipt
    let receipt_number = crate::database::payments::next_receipt_number_tx(&tx)?;
    tx.execute(
        "INSERT INTO payments (invoice_id, number, amount, payment_method, payment_date, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, '')",
        params![invoice_id, receipt_number, total, payload.payment_method, payload.issue_date],
    )
    .map_err(|e| format!("Payment insert error: {e}"))?;

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    get_invoice_detail(conn, invoice_id)
}
```

**Step 3: Expose `next_receipt_number` for transaction use**

In `src-tauri/src/database/payments.rs`, rename/add a variant that accepts a `Transaction`:

Actually, since `Transaction` derefs to `Connection`, just make `next_receipt_number` public:

```rust
pub fn next_receipt_number(conn: &Connection) -> Result<String, String> {
```

And add a public alias for clarity in `payments.rs`:

```rust
pub fn next_receipt_number_tx(conn: &Connection) -> Result<String, String> {
    next_receipt_number(conn)
}
```

**Step 4: Add IPC command**

In `src-tauri/src/commands/invoices.rs`, add:

```rust
#[tauri::command]
pub fn create_direct_sale(
    state: State<AppState>,
    payload: DirectSalePayload,
) -> Result<InvoiceDetail, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::create_direct_sale(&mut conn, &payload)
}
```

Add the import for `DirectSalePayload` at the top of the file.

**Step 5: Register command**

In `src-tauri/src/lib.rs`, add to invoke_handler:

```rust
commands::invoices::create_direct_sale,
```

**Step 6: Verify**

Run: `cd app/src-tauri && cargo check`
Expected: compiles with no errors

---

### Task 3: Frontend API + Hook

**Files:**
- Modify: `app/src/api/invoices.ts`
- Modify: `app/src/api/clients.ts`
- Modify: `app/src/hooks/useInvoices.ts`

**Step 1: Add TypeScript types and API call for direct sale**

In `app/src/api/invoices.ts`, add:

```typescript
export interface DirectSalePayload {
  client_id: number;
  issue_date: string;
  payment_method: string;
  notes: string;
  lines: InvoiceLinePayload[];
}

export async function createDirectSale(
  payload: DirectSalePayload,
): Promise<InvoiceDetail> {
  return invoke<InvoiceDetail>("create_direct_sale", { payload });
}
```

**Step 2: Add `getSystemClientId` API call**

In `app/src/api/clients.ts`, add:

```typescript
export async function getSystemClientId(): Promise<number> {
  return invoke<number>("get_system_client_id");
}
```

**Step 3: Add `directSale` action to invoices hook**

In `app/src/hooks/useInvoices.ts`:

Import `DirectSalePayload` and `createDirectSale` from the API.

Add to the store interface:

```typescript
directSale: (payload: DirectSalePayload) => Promise<InvoiceDetail>;
```

Add implementation:

```typescript
directSale: async (payload) => {
  const detail = await createDirectSale(payload);
  await get().fetch();
  return detail;
},
```

**Step 4: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: no errors

---

### Task 4: InvoiceForm — `direct-sale` mode

**Files:**
- Modify: `app/src/pages/InvoiceForm.tsx`

**Step 1: Detect direct-sale mode**

Near the top of the component, after the existing `isEditing` and `isReadonly` lines, add:

```typescript
const isDirectSale = mode === "direct-sale";
```

**Step 2: Pre-fill system client on mount**

In the existing `useEffect` that loads invoice data, add a branch for direct sale:

```typescript
if (isDirectSale) {
  getSystemClientId().then((id) => {
    setClientId(id);
  });
}
```

Import `getSystemClientId` from `../api/clients`.

**Step 3: Change save button and behavior**

Find the save button at the bottom of the form. Wrap it conditionally:

```typescript
{isDirectSale ? (
  <button
    className="btn-primary"
    onClick={handleDirectSale}
    disabled={saving}
  >
    Encaisser
  </button>
) : (
  <button className="btn-primary" onClick={handleSave} disabled={saving}>
    {saving ? "..." : isEditing ? "Enregistrer" : "Enregistrer"}
  </button>
)}
```

**Step 4: Add `handleDirectSale` function**

After the existing `handleSave` function, add:

```typescript
async function handleDirectSale() {
  if (!clientId) {
    setError("Veuillez selectionner un client.");
    return;
  }
  const linePayloads: InvoiceLinePayload[] = lines
    .filter((l) => l.description.trim())
    .map((l, i) => ({
      catalogue_id: l.catalogue_id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount: l.discount,
      tva_rate: l.tva_rate,
      sort_order: i,
    }));

  if (linePayloads.length === 0) {
    setError("Ajoutez au moins une ligne.");
    return;
  }

  setSaving(true);
  setError(null);
  try {
    const created = await store.directSale({
      client_id: clientId,
      issue_date: issueDate,
      payment_method: payMethod,
      notes,
      lines: linePayloads,
    });
    toast.show("Vente enregistree", "success");
    onNavigate("invoice-form", { invoiceId: created.id, mode: "view" });
  } catch (e) {
    setError(String(e));
    setSaving(false);
  }
}
```

Import `DirectSalePayload` from the API if needed (the type is inferred from `store.directSale`).

**Step 5: Adjust Topbar title for direct sale**

In the form's `<Topbar>`, change the title:

```typescript
<Topbar
  title={isDirectSale ? "Vente directe" : isEditing ? "Modifier la facture" : "Nouvelle facture"}
```

**Step 6: Hide due date field in direct sale mode**

Wrap the due date `<FormField>` with:

```typescript
{!isDirectSale && (
  <FormField label="Echeance">
    ...
  </FormField>
)}
```

**Step 7: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: no errors

---

### Task 5: Navigation — Buttons on Dashboard and Invoices page

**Files:**
- Modify: `app/src/pages/Dashboard.tsx`
- Modify: `app/src/pages/Invoices.tsx`
- Modify: `app/src/App.tsx`

**Step 1: Pass `direct-sale` mode through App.tsx**

In `app/src/App.tsx`, the `invoice-form` case already reads `params.mode`. No change needed — `mode: "direct-sale"` will be passed through.

**Step 2: Add "Vente directe" button on Dashboard**

In `app/src/pages/Dashboard.tsx`, in the `<Topbar>` actions, add before the existing "Nouvelle facture" button:

```typescript
<button
  onClick={() => onNavigate("invoice-form", { mode: "direct-sale" })}
  className="btn-primary text-[13px]"
>
  Vente directe
</button>
```

**Step 3: Add "Vente directe" button on Invoices page**

In `app/src/pages/Invoices.tsx`, in the `<Topbar>` actions, add before the "Nouvelle facture" button:

```typescript
<button
  className="btn-primary"
  onClick={() => onNavigate("invoice-form", { mode: "direct-sale" })}
>
  Vente directe
</button>
```

**Step 4: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: no errors

---

### Task 6: Final verification

**Step 1: Full Rust check**

Run: `cd app/src-tauri && cargo check`
Expected: compiles (warnings OK)

**Step 2: Full TypeScript check**

Run: `cd app && npx tsc --noEmit`
Expected: no errors

**Step 3: Launch and test**

Run: `cd app && npx tauri dev`

Test scenarios:
1. Dashboard — click "Vente directe" → opens form with "Vente directe" title, client anonyme pre-selected, no due date field, "Encaisser" button
2. Add items, click "Encaisser" → redirects to readonly view showing invoice as "Payee" with a payment/receipt listed
3. Invoices page — click "Vente directe" → same behavior
4. Verify the invoice appears in the invoices list with status "Payee"
5. Verify receipt PDF works from the readonly view
6. Verify normal invoice creation still works unchanged
