import { parseCSV, parseUserDate } from './utils';
import { Bank, Category } from '@/types';

export type TxKind = 'income' | 'expense';

export interface ImportedRow {
  transaction_type: TxKind;
  transaction_date: string;
  description: string;
  amount: number;
  category_id: number;
  bank_id: number;
  notes: string;
  status: 'posted';
}

export interface ImportResult {
  rows: ImportedRow[];
  // receiptDriveUrls[i] pairs 1:1 with rows[i]. Null if the row had no
  // receipt_drive_url column. Not part of the DB row itself — the CSV import
  // flow uses it to trigger a post-insert fetch → Storage upload for that row.
  receiptDriveUrls: (string | null)[];
  errors: { line: number; message: string }[];
}

const REQUIRED = ['transaction_date', 'description', 'amount', 'category', 'bank'];

// Pre-pass helper: scan a CSV and return the unique, trimmed, non-empty
// category strings from the "category" column, preserving the casing the
// user typed. Callers use this to detect categories that need to be
// auto-created before running buildImportRows.
export const extractCsvCategoryNames = (csv: string): string[] => {
  const parsed = parseCSV(csv);
  const seen = new Map<string, string>(); // lower-case → first-seen casing
  for (const row of parsed) {
    const raw = (row.category || '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!seen.has(key)) seen.set(key, raw);
  }
  return Array.from(seen.values());
};

export const csvTemplate = (kind: TxKind): string => {
  return [
    'transaction_date,description,amount,category,bank,notes,receipt_drive_url',
    `01-04-2026,${kind === 'expense' ? 'Groceries' : 'Salary'},5000,General,HDFC,Optional notes,https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing`,
    `02-04-2026,${kind === 'expense' ? 'Fuel' : 'Freelance'},1200,General,HDFC,,`,
  ].join('\n');
};

export const downloadCSVTemplate = (kind: TxKind) => {
  const blob = new Blob([csvTemplate(kind)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-import-template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const buildImportRows = (
  csv: string,
  kind: TxKind,
  categories: Category[],
  banks: Bank[]
): ImportResult => {
  const parsed = parseCSV(csv);
  const errors: ImportResult['errors'] = [];
  const rows: ImportedRow[] = [];
  const receiptDriveUrls: (string | null)[] = [];

  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  // Match banks by name (case-insensitive). Personal use = each user's bank
  // names are unique per user; account numbers were removed from the model.
  const bankByName = new Map(banks.map((b) => [b.bank_name.toLowerCase(), b.id]));

  parsed.forEach((row, idx) => {
    const line = idx + 2; // +1 for header, +1 for 1-indexed
    for (const key of REQUIRED) {
      if (!row[key]) {
        errors.push({ line, message: `missing "${key}"` });
        return;
      }
    }
    // Strip commas ("1,000.50") so parseFloat doesn't stop at the first
    // comma. Reject scientific notation ("1e5" → 100000) and any non-numeric
    // shape — Excel exports sometimes contain both.
    const rawAmt = String(row.amount).trim().replace(/,/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(rawAmt)) {
      errors.push({ line, message: `invalid amount "${row.amount}"` });
      return;
    }
    const amount = parseFloat(rawAmt);
    if (isNaN(amount) || amount <= 0) {
      errors.push({ line, message: `invalid amount "${row.amount}"` });
      return;
    }
    const transaction_date = parseUserDate(row.transaction_date);
    if (!transaction_date) {
      errors.push({ line, message: `date must be dd-mm-yyyy (YYYY-MM-DD also accepted), got "${row.transaction_date}"` });
      return;
    }
    const category_id = catByName.get(row.category.toLowerCase());
    if (!category_id) {
      errors.push({ line, message: `unknown category "${row.category}"` });
      return;
    }
    const bank_id = bankByName.get(String(row.bank).trim().toLowerCase());
    if (!bank_id) {
      errors.push({ line, message: `unknown bank "${row.bank}" — add it under Settings → Banks/Cards first` });
      return;
    }

    rows.push({
      transaction_type: kind,
      transaction_date,
      description: row.description,
      amount,
      category_id,
      bank_id,
      notes: row.notes || '',
      status: 'posted',
    });
    // Pair with the row we just pushed. Blank/missing column → null.
    const driveRaw = (row.receipt_drive_url || '').trim();
    receiptDriveUrls.push(driveRaw || null);
  });

  return { rows, receiptDriveUrls, errors };
};
