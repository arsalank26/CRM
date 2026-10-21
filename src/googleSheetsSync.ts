import { CustomerRecord, Spending, Kirkol, TotalsSummary, MONTH_NAMES, calculateMonthTotals } from './types';

export const SHEETS_STORAGE_KEY = 'al_uzer_sheets_config';

export const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbxNUI2eYoQdy5dHCilHkf1r7Gc5UxgzvkpcXi8PSQO4fzgZkivGhbHC5oEdTQDKi7DQ/exec';

export const DEFAULT_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1oklvgEStaUW1P73_qqyrbCXSCQ_iYj-d0K94bmraxb4/edit?pli=1&gid=0#gid=0';

export const DEFAULT_SPREADSHEET_ID = '1oklvgEStaUW1P73_qqyrbCXSCQ_iYj-d0K94bmraxb4';

export interface GoogleSheetsConfig {
  webhookUrl: string;
  spreadsheetUrl?: string;
  lastSync?: string;
}

export function getSheetsConfig(): GoogleSheetsConfig {
  try {
    const saved = localStorage.getItem(SHEETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.webhookUrl && typeof parsed.webhookUrl === 'string') {
        const webhookUrl = parsed.webhookUrl.includes('AKfycbwgOZYrRO8GYXw7lvDcau0JnlBlPlWgMEEw5AQ_LUsNgqZVtWY9y_SeIl4eSP181w') || parsed.webhookUrl.includes('AKfycbzJrQPQQ6p4YsM4XqTSwKdbN1NcupzKLG-FBbzCRidqWKYUzkkhCZ6-cHWNqwHjta5d')
          ? DEFAULT_WEBHOOK_URL
          : parsed.webhookUrl;
        const spreadsheetUrl = (parsed.spreadsheetUrl && !parsed.spreadsheetUrl.includes('1ynBrpLAEFuuzn1SL3ZqjScEQHd9SB6d45Rei9bK3uFk') && !parsed.spreadsheetUrl.includes('1pHMlFy-Qn1u4ssrYnyUR_uwvFbt2xveaPOZW5JY7V_I'))
          ? parsed.spreadsheetUrl
          : DEFAULT_SPREADSHEET_URL;

        return {
          webhookUrl,
          spreadsheetUrl,
          lastSync: parsed.lastSync,
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    webhookUrl: DEFAULT_WEBHOOK_URL,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
  };
}

/**
 * Sends a payload to Google Apps Script Web App.
 * Uses text/plain to avoid CORS preflight issues with Google Apps Script redirects.
 */
export async function sendToGoogleAppsScript(payload: Record<string, any>): Promise<boolean> {
  const config = getSheetsConfig();
  if (!config || !config.webhookUrl) return false;

  try {
    const url = config.webhookUrl.trim();
    if (!url.startsWith('https://script.google.com/')) return false;

    const fullPayload = {
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      ...payload,
    };

    // Use text/plain with JSON body - Google Apps Script receives this in e.postData.contents without CORS blocking
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(fullPayload),
    });

    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    try {
      localStorage.setItem(
        SHEETS_STORAGE_KEY,
        JSON.stringify({ ...config, lastSync: now })
      );
    } catch {
      // ignore
    }
    return true;
  } catch (err) {
    console.warn('Google Sheets sync warning:', err);
    return false;
  }
}

/**
 * Automatically syncs a single customer record to Google Sheet
 */
export async function autoSyncCustomer(customer: CustomerRecord): Promise<boolean> {
  const d = new Date(customer.created_at);
  const monthName = MONTH_NAMES[d.getMonth()] || 'September';
  const year = d.getFullYear() || 2026;
  return sendToGoogleAppsScript({
    action: 'save_customer',
    customer,
    monthName,
    year,
  });
}

/**
 * Automatically syncs a spending record to Google Sheet
 */
export async function autoSyncSpending(spending: Spending): Promise<boolean> {
  const d = new Date(spending.created_at);
  const monthName = MONTH_NAMES[d.getMonth()] || 'September';
  const year = d.getFullYear() || 2026;
  return sendToGoogleAppsScript({
    action: 'save_spending',
    spending,
    monthName,
    year,
  });
}

/**
 * Automatically syncs a kirkol record to Google Sheet
 */
export async function autoSyncKirkol(kirkol: Kirkol): Promise<boolean> {
  const d = new Date(kirkol.created_at);
  const monthName = MONTH_NAMES[d.getMonth()] || 'September';
  const year = d.getFullYear() || 2026;
  return sendToGoogleAppsScript({
    action: 'save_kirkol',
    kirkol,
    monthName,
    year,
  });
}

/**
 * Syncs full active month or all records to Google Sheet
 */
export async function fullSyncToGoogleSheets(
  customers: CustomerRecord[],
  spendings: Spending[],
  kirkol: Kirkol[],
  totals: TotalsSummary,
  year = new Date().getFullYear(),
  month = new Date().getMonth(),
  isMonthly = true
): Promise<boolean> {
  const monthData = isMonthly
    ? calculateMonthTotals(customers, spendings, kirkol, year, month)
    : {
      ...totals,
      filteredCustomers: customers,
      filteredSpendings: spendings,
      filteredKirkol: kirkol,
    };

  return sendToGoogleAppsScript({
    action: 'sync_all',
    isMonthly,
    monthName: MONTH_NAMES[month],
    year,
    customers: monthData.filteredCustomers,
    spendings: monthData.filteredSpendings,
    kirkol: monthData.filteredKirkol,
    totals: {
      totalAmount: monthData.totalAmount,
      collectedAmount: monthData.collectedAmount,
      pendingAmount: monthData.pendingAmount,
      totalIncome: monthData.totalIncome,
      totalSpending: monthData.totalSpending,
      remainingAmount: monthData.remainingAmount,
    },
  });
}
