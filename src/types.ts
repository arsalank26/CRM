export type WorkType = { id: string; name: string; expense: number; is_active: boolean };

export type CustomerWorkItem = {
  id: string;
  work_type: string;
  amount: number;
  expense: number;
  work_status: string;
};

export type CustomerRecord = {
  id: string;
  customer_name: string;
  mobile: string;
  work_type: string;
  total_amount: number;
  charges: number;
  paid: number;
  expense: number;
  income: number;
  payment_status: string;
  work_status: string;
  payment_mode?: string;
  items?: CustomerWorkItem[];
  created_at: string;
};
export type Spending = { id: string; expense_name: string; amount: number; category: string; created_at: string };
export type Kirkol = { id: string; work: string; price: number; created_at: string };
export type Category = { id: string; name: string };
export type WorkStatus = { id: string; name: string };
export type Page = 'dashboard' | 'customers' | 'spending' | 'work-types' | 'categories' | 'income' | 'sheets' | 'ai-assistant' | 'sms-reminders';

export type AgentRole = 'system' | 'user' | 'assistant';

export type AgentPersonaId = 'master' | 'bi' | 'crm' | 'comm' | 'sync';

export interface AgentSuggestedAction {
  id: string;
  label: string;
  actionType: 'send_sms' | 'queue_all_sms' | 'whatsapp_message' | 'filter_customers' | 'navigate' | 'export_report' | 'sync_sheets';
  payload: Record<string, any>;
  variant?: 'primary' | 'secondary' | 'accent' | 'warning';
}

export interface AgentMessage {
  id: string;
  sender: 'user' | 'assistant';
  persona: AgentPersonaId;
  agentName: string;
  content: string;
  timestamp: string;
  intent?: string;
  dataSourcesUsed?: ('Supabase' | 'Google Sheets' | string)[];
  suggestedActions?: AgentSuggestedAction[];
  insights?: {
    type: 'positive' | 'warning' | 'neutral' | 'critical';
    title: string;
    details: string;
  }[];
}

export type GoogleSheetsConfig = {
  webhookUrl: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  activeYear: number;
  activeMonth: number; // 0 to 11
  autoSync: boolean;
  lastSyncedAt?: string;
};

export type TotalsSummary = {
  totalAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  customerIncome: number;
  kirkolIncome: number;
  totalIncome: number;
  workExpense: number;
  totalSpending: number;
  totalExpense: number;
  remainingAmount: number; // strictly Total Income - Total Spending
  jobsCount: number;
  pendingWorkCount: number;
  spendingsCount: number;
  kirkolCount: number;
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const formatCurrency = (value: number): string =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value || 0))}`;

export const formatDate = (value: string): string => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
};

export const makeId = (): string => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const getStatus = (paid: number, total: number): string =>
  paid >= total && total > 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';

/**
 * Standardize work status strings into their canonical category
 * E.g., 'complete', 'done', 'work done' -> 'Completed'
 *       'in progress', 'progress' -> 'In Progress'
 *       'pay required', 'payment pending' -> 'Payment Pending'
 */
export function normalizeWorkStatusCategory(status?: string): string {
  const norm = (status || '').toLowerCase().trim().replace(/[-_]/g, ' ');
  if (!norm) return 'Pending';
  if (['completed', 'complete', 'done', 'work done', 'finished', 'compleated'].includes(norm)) return 'Completed';
  if (['in progress', 'inprogress', 'progress', 'processing', 'working'].includes(norm)) return 'In Progress';
  if (['pending', 'wait', 'waiting'].includes(norm)) return 'Pending';
  if (['payment pending', 'pay pending', 'pay required', 'payment required'].includes(norm)) return 'Payment Pending';
  if (['delivered', 'deliver'].includes(norm)) return 'Delivered';
  if (['document required', 'docs required', 'doc required', 'documents required'].includes(norm)) return 'Document Required';
  if (['cancelled', 'canceled', 'cancel'].includes(norm)) return 'Cancelled';
  if (['rejected', 'reject'].includes(norm)) return 'Rejected';
  return status?.trim() || 'Pending';
}

/**
 * Checks whether a row's work status matches a given filter, case-insensitively and category-aware.
 */
export function isMatchingWorkStatus(rowStatus: string | undefined, filterStatus: string): boolean {
  if (!filterStatus || filterStatus === 'ALL') return true;
  const rawRow = (rowStatus || 'Pending').toLowerCase().trim();
  const rawFilter = filterStatus.toLowerCase().trim();
  if (rawRow === rawFilter) return true;
  const catRow = normalizeWorkStatusCategory(rowStatus).toLowerCase();
  const catFilter = normalizeWorkStatusCategory(filterStatus).toLowerCase();
  return catRow === catFilter || catRow === rawFilter || rawRow === catFilter;
}

/**
 * Extracts a Google Spreadsheet ID from either a full URL or a raw ID string
 */
export function extractSpreadsheetId(urlOrId?: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) return trimmed;
  return '';
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/**
 * Standardized core calculations across the entire application.
 * Remaining Amount = Total Income - Total Spending
 */
export function calculateTotals(
  customers: CustomerRecord[],
  spendings: Spending[],
  kirkol: Kirkol[]
): TotalsSummary {
  const jobsCount = customers.length;
  const totalAmount = customers.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0);
  const collectedAmount = customers.reduce((sum, row) => sum + (Number(row.paid) || 0), 0);
  const pendingAmount = customers.reduce((sum, row) => sum + Math.max((Number(row.total_amount) || 0) - (Number(row.paid) || 0), 0), 0);

  const workExpense = customers.reduce((sum, row) => sum + (Number(row.expense) || 0), 0);
  const customerIncome = customers.reduce((sum, row) => sum + (Number(row.income) || 0), 0);
  const kirkolIncome = kirkol.reduce((sum, row) => sum + (Number(row.price) || 0), 0);

  // Total Income = Customer Profit (Total Amount - Expense) + Kirkol Revenue
  const totalIncome = customerIncome + kirkolIncome;

  // Total Spending = All direct business spendings recorded
  const totalSpending = spendings.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  // Combined Total Expense = Customer raw work expenses + Business Spendings
  const totalExpense = workExpense + totalSpending;

  // Remaining Amount = strictly Total Income - Total Spending
  const remainingAmount = totalIncome - totalSpending;

  const pendingWorkCount = customers.filter(
    (row) => !['Completed', 'Delivered', 'Cancelled'].includes(row.work_status)
  ).length;

  return {
    totalAmount,
    collectedAmount,
    pendingAmount,
    customerIncome,
    kirkolIncome,
    totalIncome,
    workExpense,
    totalSpending,
    totalExpense,
    remainingAmount,
    jobsCount,
    pendingWorkCount,
    spendingsCount: spendings.length,
    kirkolCount: kirkol.length,
  };
}

/**
 * Calculate totals filtered by specific year and month (0-11)
 */
export function calculateMonthTotals(
  customers: CustomerRecord[],
  spendings: Spending[],
  kirkol: Kirkol[],
  year: number,
  month: number // 0-11, or -1 for all months of that year
): TotalsSummary & {
  filteredCustomers: CustomerRecord[];
  filteredSpendings: Spending[];
  filteredKirkol: Kirkol[];
} {
  const matchDate = (isoString: string) => {
    if (!isoString) return false;
    const d = new Date(isoString);
    if (d.getFullYear() !== year) return false;
    if (month !== -1 && d.getMonth() !== month) return false;
    return true;
  };

  const filteredCustomers = customers.filter((c) => matchDate(c.created_at));
  const filteredSpendings = spendings.filter((s) => matchDate(s.created_at));
  const filteredKirkol = kirkol.filter((k) => matchDate(k.created_at));

  const totals = calculateTotals(filteredCustomers, filteredSpendings, filteredKirkol);

  return {
    ...totals,
    filteredCustomers,
    filteredSpendings,
    filteredKirkol,
  };
}
