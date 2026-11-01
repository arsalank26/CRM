import { useMemo, useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, Check, Filter, Wand, FileDown,
  Sparkles, Bot, Smartphone, Calendar, Printer, PieChart, ArrowRight,
  TrendingUp, Wallet, ArrowDownRight, ArrowUpRight, DollarSign, Save,
  CheckCircle2, Layers
} from 'lucide-react';
import {
  CustomerRecord, Spending, Kirkol, Category, WorkType, WorkStatus,
  formatCurrency, formatDate, getStatus, todayISO, MONTH_NAMES,
  normalizeWorkStatusCategory, isMatchingWorkStatus
} from './types';
import { CustomerModal } from './CustomerModal';
import { OwnerAuthModal } from './OwnerAuthModal';
import { QuickPayModal } from './QuickPayModal';
import { ConfirmDialog } from './ConfirmDialog';
import { WorkStatusSelect } from './WorkStatusSelect';
import { printThermalBill } from './billPrinter';

type StatusFilter = string;

function checkIsAlUzer(row: CustomerRecord): boolean {
  const norm = (str?: string) => (str || '').toLowerCase().replace(/[\s\-_.]/g, '');
  const name = norm(row.customer_name);
  const work = norm(row.work_type);
  const status = norm(row.work_status);

  if (name.includes('aluzer') || work.includes('aluzer') || status.includes('aluzer')) {
    return true;
  }
  if (row.items && row.items.some((it) => {
    const itWork = norm(it.work_type);
    const itStatus = norm(it.work_status);
    return itWork.includes('aluzer') || itStatus.includes('aluzer');
  })) {
    return true;
  }
  return false;
}

type Props = {
  customers: CustomerRecord[];
  spendings?: Spending[];
  kirkol?: Kirkol[];
  categories?: Category[];
  workTypes: WorkType[];
  workStatuses: WorkStatus[];
  isOwnerMode?: boolean;
  onSaveCustomer: (data: Partial<CustomerRecord>, editingId?: string) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onAddCustomer?: () => void;
  onAddKirkol: () => void;
  onOpenMonthlyReport?: () => void;
  onOpenAIAssistant?: () => void;
  onOpenSMSReminders?: () => void;
};

export function CRMDashboard({
  customers,
  spendings = [],
  kirkol = [],
  categories = [],
  workTypes,
  workStatuses,
  isOwnerMode = false,
  onSaveCustomer,
  onDeleteCustomer,
  onAddCustomer,
  onAddKirkol,
  onOpenMonthlyReport,
  onOpenAIAssistant,
  onOpenSMSReminders,
}: Props) {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [workFilter, setWorkFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [deleting, setDeleting] = useState<CustomerRecord | null>(null);
  const [quickPayCustomer, setQuickPayCustomer] = useState<CustomerRecord | null>(null);
  const [ownerAuth, setOwnerAuth] = useState<{
    isOpen: boolean;
    action: 'edit' | 'delete';
    customer: CustomerRecord | null;
  }>({
    isOpen: false,
    action: 'edit',
    customer: null,
  });

  // Generate available Month & Year options from recorded customer, spending, and kirkol dates
  const monthOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; year: number; month: number }>();
    const registerDate = (iso?: string) => {
      if (!iso) return;
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
        if (!map.has(key)) {
          const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
          map.set(key, { key, label, year: d.getFullYear(), month: d.getMonth() });
        }
      } catch {}
    };

    // Also register current month and past 3 months
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      registerDate(d.toISOString());
    }

    customers.forEach((c) => registerDate(c.created_at));
    spendings.forEach((s) => registerDate(s.created_at));
    kirkol.forEach((k) => registerDate(k.created_at));

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [customers, spendings, kirkol]);

  // Month-filtered datasets
  const monthFilteredCustomers = useMemo(() => {
    if (selectedMonthKey === 'ALL') return customers;
    return customers.filter((c) => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      return key === selectedMonthKey;
    });
  }, [customers, selectedMonthKey]);

  const monthFilteredSpendings = useMemo(() => {
    if (selectedMonthKey === 'ALL') return spendings;
    return spendings.filter((s) => {
      if (!s.created_at) return false;
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      return key === selectedMonthKey;
    });
  }, [spendings, selectedMonthKey]);

  const monthFilteredKirkol = useMemo(() => {
    if (selectedMonthKey === 'ALL') return kirkol;
    return kirkol.filter((k) => {
      if (!k.created_at) return false;
      const d = new Date(k.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      return key === selectedMonthKey;
    });
  }, [kirkol, selectedMonthKey]);

  // Core Financial stats for the selected month
  const monthFinancials = useMemo(() => {
    const totalJobs = monthFilteredCustomers.length;
    const totalAmount = monthFilteredCustomers.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
    const receivedAmount = monthFilteredCustomers.reduce((sum, r) => sum + (Number(r.paid) || 0), 0);
    const pendingAmount = monthFilteredCustomers.reduce(
      (sum, r) => sum + Math.max((Number(r.total_amount) || 0) - (Number(r.paid) || 0), 0),
      0
    );

    const customerIncome = monthFilteredCustomers.reduce((sum, r) => sum + (Number(r.income) || 0), 0);
    const kirkolIncome = monthFilteredKirkol.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const totalIncome = customerIncome + kirkolIncome;

    const totalSpending = monthFilteredSpendings.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const remainingAmount = totalIncome - totalSpending;

    return {
      totalJobs,
      totalAmount,
      receivedAmount,
      pendingAmount,
      customerIncome,
      kirkolIncome,
      totalIncome,
      totalSpending,
      remainingAmount,
    };
  }, [monthFilteredCustomers, monthFilteredSpendings, monthFilteredKirkol]);

  // Customer dropdown filter options for selected month
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>();
    monthFilteredCustomers.forEach((c) => map.set(c.customer_name, c.customer_name));
    return Array.from(map.keys()).sort();
  }, [monthFilteredCustomers]);

  const alUzerCount = useMemo(() => {
    return monthFilteredCustomers.filter(checkIsAlUzer).length;
  }, [monthFilteredCustomers]);

  // Table-filtered customer records
  const filtered = useMemo(() => {
    return monthFilteredCustomers.filter((row) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Al Uzer') {
          if (!checkIsAlUzer(row)) return false;
        } else if (!isMatchingWorkStatus(row.work_status, statusFilter)) {
          return false;
        }
      }
      if (workFilter !== 'ALL' && row.work_type !== workFilter) return false;
      if (customerFilter !== 'ALL' && row.customer_name !== customerFilter) return false;
      if (
        search &&
        !`${row.customer_name} ${row.mobile} ${row.work_type} ${row.work_status}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [monthFilteredCustomers, statusFilter, workFilter, customerFilter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: monthFilteredCustomers.length,
      Pending: 0,
      'Payment Pending': 0,
      'In Progress': 0,
      'Al Uzer': alUzerCount,
      Delivered: 0,
      'Document Required': 0,
      Completed: 0,
    };
    monthFilteredCustomers.forEach((row) => {
      const cat = normalizeWorkStatusCategory(row.work_status);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [monthFilteredCustomers, alUzerCount]);

  // Pie Chart 1: Work Status Distribution
  const workStatusPieData = useMemo(() => {
    const total = monthFilteredCustomers.length;
    if (!total) return { items: [], gradient: '#e2e8f0', total: 0 };

    const statusCountsMap: Record<string, number> = {};
    monthFilteredCustomers.forEach((c) => {
      const st = normalizeWorkStatusCategory(c.work_status);
      statusCountsMap[st] = (statusCountsMap[st] || 0) + 1;
    });

    const statusPalette: Record<string, string> = {
      Pending: '#eab308',
      'In Progress': '#3b82f6',
      Completed: '#10b981',
      Delivered: '#167c57',
      'Payment Pending': '#f97316',
      'Document Required': '#8b5cf6',
      Rejected: '#ef4444',
      Cancelled: '#64748b',
    };

    const items = Object.entries(statusCountsMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], idx) => {
        const pct = Math.round((count / total) * 100);
        const color = statusPalette[name] || ['#06b6d4', '#ec4899', '#6366f1', '#14b8a6'][idx % 4];
        return { name, count, pct, color };
      });

    let currentPct = 0;
    const gradientParts = items.map((item) => {
      const start = currentPct;
      currentPct += (item.count / total) * 100;
      return `${item.color} ${start.toFixed(1)}% ${currentPct.toFixed(1)}%`;
    });

    return {
      items,
      gradient: `conic-gradient(${gradientParts.join(', ')})`,
      total,
    };
  }, [monthFilteredCustomers]);

  // Pie Chart 2: Category Spending Distribution
  const categoryPieData = useMemo(() => {
    const total = monthFinancials.totalSpending;
    if (!total || monthFilteredSpendings.length === 0) {
      return { items: [], gradient: '#e2e8f0', total: 0 };
    }

    const catMap: Record<string, number> = {};
    monthFilteredSpendings.forEach((s) => {
      const cat = s.category || 'Business';
      catMap[cat] = (catMap[cat] || 0) + (Number(s.amount) || 0);
    });

    const categoryColors = ['#e8753a', '#2563eb', '#10b981', '#9333ea', '#06b6d4', '#f59e0b'];

    const items = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount], idx) => {
        const pct = Math.round((amount / total) * 100);
        const color = categoryColors[idx % categoryColors.length];
        return { name, amount, pct, color };
      });

    let currentPct = 0;
    const gradientParts = items.map((item) => {
      const start = currentPct;
      currentPct += (item.amount / total) * 100;
      return `${item.color} ${start.toFixed(1)}% ${currentPct.toFixed(1)}%`;
    });

    return {
      items,
      gradient: `conic-gradient(${gradientParts.join(', ')})`,
      total,
    };
  }, [monthFilteredSpendings, monthFinancials.totalSpending]);

  const statusButtons = useMemo(() => {
    const standard: { key: string; label: string }[] = [
      { key: 'ALL', label: 'ALL' },
      { key: 'Pending', label: 'PENDING' },
      { key: 'Payment Pending', label: 'PAYMENT PENDING' },
      { key: 'In Progress', label: 'IN PROGRESS' },
      { key: 'Al Uzer', label: 'AL UZER' },
      { key: 'Delivered', label: 'DELIVERED' },
      { key: 'Document Required', label: 'DOCUMENT REQUIRED' },
      { key: 'Completed', label: 'COMPLETED' },
    ];
    const stdSet = new Set(standard.map((b) => b.key.toLowerCase()));
    const customList: { key: string; label: string }[] = [];

    monthFilteredCustomers.forEach((c) => {
      const raw = (c.work_status || '').trim();
      const cat = normalizeWorkStatusCategory(raw);
      if (raw && !stdSet.has(cat.toLowerCase()) && !stdSet.has(raw.toLowerCase())) {
        stdSet.add(raw.toLowerCase());
        customList.push({ key: raw, label: raw.toUpperCase() });
      }
    });

    workStatuses.forEach((ws) => {
      const raw = (ws.name || '').trim();
      const cat = normalizeWorkStatusCategory(raw);
      if (raw && !stdSet.has(cat.toLowerCase()) && !stdSet.has(raw.toLowerCase())) {
        stdSet.add(raw.toLowerCase());
        customList.push({ key: raw, label: raw.toUpperCase() });
      }
    });

    return [...standard, ...customList];
  }, [monthFilteredCustomers, workStatuses]);

  const openCreate = (): void => {
    if (onAddCustomer) {
      onAddCustomer();
    } else {
      setEditing(null);
      setShowForm(true);
    }
  };

  const handleRequestOwnerAuth = (action: 'edit' | 'delete', customer: CustomerRecord) => {
    if (isOwnerMode) {
      if (action === 'edit') {
        setEditing(customer);
        setShowForm(true);
      } else {
        setDeleting(customer);
      }
      return;
    }
    setOwnerAuth({
      isOpen: true,
      action,
      customer,
    });
  };

  const handleOwnerVerified = () => {
    const { action, customer } = ownerAuth;
    setOwnerAuth({ isOpen: false, action: 'edit', customer: null });
    if (!customer) return;

    if (action === 'edit') {
      setEditing(customer);
      setShowForm(true);
    } else if (action === 'delete') {
      setDeleting(customer);
    }
  };

  const handleSave = async (data: Partial<CustomerRecord>, editingId?: string): Promise<void> => {
    await onSaveCustomer(data, editingId);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return;
    await onDeleteCustomer(deleting.id);
    setDeleting(null);
  };

  const selectedMonthLabel =
    selectedMonthKey === 'ALL'
      ? 'All Months (All Time Records)'
      : monthOptions.find((m) => m.key === selectedMonthKey)?.label || selectedMonthKey;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow accent">AL UZER SERVICES & CRM</span>
          <h1>Job Management & Workflow</h1>
          <p>Customer work orders, statuses, daily workflow, and thermal receipt billing.</p>
        </div>
        <div className="heading-actions">
          {onOpenSMSReminders && (
            <button
              className="button"
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #0d9488 100%)',
                color: '#ffffff',
                border: '1px solid rgba(52, 211, 153, 0.45)',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 15px',
                borderRadius: '10px',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={onOpenSMSReminders}
              title="Open Automated 5-Day SMS Reminder Hub"
            >
              <Smartphone size={16} style={{ filter: 'drop-shadow(0 0 5px rgba(52,211,153,0.9))' }} />
              <span>SMS Reminders</span>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.22)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '12px',
                  letterSpacing: '0.4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#34d399',
                    boxShadow: '0 0 6px #34d399',
                    display: 'inline-block',
                  }}
                />
                5-DAY
              </span>
            </button>
          )}
          {onOpenAIAssistant && (
            <button
              className="button"
              style={{
                background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #7c3aed 100%)',
                color: '#ffffff',
                border: '1px solid rgba(167, 139, 250, 0.45)',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 15px',
                borderRadius: '10px',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={onOpenAIAssistant}
              title="Open AI Intelligence & Payment Chat Assistant"
            >
              <Sparkles size={16} style={{ filter: 'drop-shadow(0 0 6px rgba(196,181,253,0.9))' }} />
              <span>AI Assistant</span>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.22)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '12px',
                  letterSpacing: '0.4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#a78bfa',
                    boxShadow: '0 0 6px #a78bfa',
                    display: 'inline-block',
                  }}
                />
                CHAT
              </span>
            </button>
          )}
          {onOpenMonthlyReport && (
            <button className="button secondary" onClick={onOpenMonthlyReport}>
              <FileDown size={16} /> Monthly PDF Report
            </button>
          )}
          <button className="button kirkol-btn" onClick={onAddKirkol}>
            <Wand size={16} /> Kirkol
          </button>
          <button className="button primary" onClick={openCreate}>
            <Plus size={16} /> Add customer
          </button>
        </div>
      </div>

      {/* Month-Wise Selector Bar */}
      <div
        className="month-filter-strip"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8e2',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#eaf6ef',
              color: '#167c57',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#88958e', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Select Month Filter
            </div>
            <strong style={{ fontSize: '15px', color: '#16251e' }}>{selectedMonthLabel}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="filter-select"
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#16251e',
              background: '#f6f8f6',
              border: '1.5px solid #167c57',
              borderRadius: '8px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="ALL">📅 All Months (Full History)</option>
            {monthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                🗓️ {opt.label}
              </option>
            ))}
          </select>

          {selectedMonthKey !== 'ALL' && (
            <button
              className="button secondary"
              style={{ padding: '8px 12px', fontSize: '12px' }}
              onClick={() => setSelectedMonthKey('ALL')}
            >
              Reset to All
            </button>
          )}
        </div>
      </div>

      {/* Privacy-Safe Operational Job Metrics */}
      <div
        className="month-financial-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div
          className="crm-summary-card"
          style={{ background: '#ffffff', border: '1px solid #e4e9e4', borderRadius: '12px', padding: '14px 16px' }}
        >
          <span className="crm-summary-label" style={{ color: '#78847d', fontSize: '12px', fontWeight: 600 }}>
            Total Jobs
          </span>
          <strong className="crm-summary-value" style={{ fontSize: '20px', display: 'block', marginTop: '4px' }}>
            {monthFilteredCustomers.length}
          </strong>
          <span style={{ fontSize: '11px', color: '#8b9790' }}>
            in {selectedMonthKey === 'ALL' ? 'all months' : selectedMonthLabel}
          </span>
        </div>

        <div
          className="crm-summary-card"
          style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 16px' }}
        >
          <span className="crm-summary-label" style={{ color: '#15803d', fontSize: '12px', fontWeight: 600 }}>
            Completed & Delivered
          </span>
          <strong className="crm-summary-value" style={{ fontSize: '20px', display: 'block', marginTop: '4px', color: '#15803d' }}>
            {monthFilteredCustomers.filter((c) => ['Completed', 'Delivered'].includes(normalizeWorkStatusCategory(c.work_status))).length}
          </strong>
          <span style={{ fontSize: '11px', color: '#15803d' }}>Fulfilled jobs</span>
        </div>

        <div
          className="crm-summary-card"
          style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '12px', padding: '14px 16px' }}
        >
          <span className="crm-summary-label" style={{ color: '#c2410c', fontSize: '12px', fontWeight: 600 }}>
            Active / In Progress
          </span>
          <strong className="crm-summary-value" style={{ fontSize: '20px', display: 'block', marginTop: '4px', color: '#ea580c' }}>
            {monthFilteredCustomers.filter((c) => ['Pending', 'In Progress', 'Payment Pending', 'Document Required'].includes(normalizeWorkStatusCategory(c.work_status))).length}
          </strong>
          <span style={{ fontSize: '11px', color: '#ea580c' }}>In processing</span>
        </div>

        <div
          className="crm-summary-card"
          style={{ background: '#ffffff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '14px 16px' }}
        >
          <span className="crm-summary-label" style={{ color: '#4338ca', fontSize: '12px', fontWeight: 600 }}>
            Al Uzer Direct
          </span>
          <strong className="crm-summary-value" style={{ fontSize: '20px', display: 'block', marginTop: '4px', color: '#4338ca' }}>
            {alUzerCount}
          </strong>
          <span style={{ fontSize: '11px', color: '#4338ca' }}>Counter tasks</span>
        </div>
      </div>

      {/* Status Bar */}
      <div className="crm-status-bar">
        {statusButtons.map((btn) => (
          <button
            key={btn.key}
            className={`crm-status-btn ${statusFilter === btn.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(btn.key)}
          >
            {btn.label}
            <span className="crm-status-count">{statusCounts[btn.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Customer Jobs Table for Selected Month */}
      <section className="panel table-panel crm-table-panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={15} />
            <input
              placeholder={`Search in ${selectedMonthLabel}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="filter-group">
            <Filter size={14} className="filter-icon" />
            <select
              className="filter-select"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="ALL">All Customers ({uniqueCustomers.length})</option>
              {uniqueCustomers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select className="filter-select" value={workFilter} onChange={(e) => setWorkFilter(e.target.value)}>
              <option value="ALL">All Work Types</option>
              {workTypes.map((wt) => (
                <option key={wt.id} value={wt.name}>
                  {wt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Work Type</th>
                <th>Status</th>
                <th>Total</th>
                <th>Received</th>
                <th>Balance</th>
                <th>Payment Mode</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const balance = row.total_amount - row.paid;
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="customer-cell">
                        <div className="table-avatar">{row.customer_name.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <strong>{row.customer_name}</strong>
                          <span>{row.mobile || 'No mobile'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span className="work-pill">{row.work_type}</span>
                        {row.items && row.items.length > 1 && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: '#059669',
                              background: '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              borderRadius: '6px',
                              padding: '1px 6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              width: 'fit-content',
                              fontWeight: 700,
                            }}
                          >
                            <Layers size={10} /> {row.items.length} works itemized
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <WorkStatusSelect
                        currentStatus={row.work_status}
                        workStatuses={workStatuses}
                        customerId={row.id}
                        customerName={row.customer_name}
                        onStatusChange={(newStatus) => onSaveCustomer({ work_status: newStatus }, row.id)}
                      />
                    </td>
                    <td>
                      <strong>{formatCurrency(row.total_amount)}</strong>
                    </td>
                    <td>{formatCurrency(row.paid)}</td>
                    <td className={balance > 0 ? 'warning-text' : 'success-text'}>
                      <strong>{formatCurrency(balance)}</strong>
                    </td>
                    <td>
                      <span
                        className="work-pill"
                        style={{
                          fontSize: '11px',
                          background: row.payment_mode === 'Online' ? '#e0f2fe' : '#f0fdf4',
                          color: row.payment_mode === 'Online' ? '#0369a1' : '#15803d',
                          fontWeight: 600,
                        }}
                      >
                        {row.payment_mode === 'Online' ? '💳 Online' : '💵 Cash'}
                      </span>
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className="crm-row-actions" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                        {/* Quick Pay / Paid Button */}
                        <button
                          className="crm-action-btn"
                          onClick={() => setQuickPayCustomer(row)}
                          title={balance > 0 ? `Collect remaining balance (${formatCurrency(balance)})` : 'Customer has paid in full'}
                          style={
                            balance > 0
                              ? { color: '#059669', borderColor: '#6ee7b7', background: '#ecfdf5', fontWeight: 700 }
                              : { color: '#64748b', borderColor: '#cbd5e1', background: '#f8fafc' }
                          }
                        >
                          <CheckCircle2 size={13} />
                          <span style={{ fontSize: '11px', marginLeft: '3px' }}>{balance > 0 ? 'Pay' : 'Paid'}</span>
                        </button>

                        <button
                          className="crm-action-btn"
                          onClick={() => printThermalBill(row)}
                          title="Print Thermal Bill (80mm/58mm)"
                          style={{ color: '#167c57', borderColor: '#b2dfcb', background: '#f0f9f4' }}
                        >
                          <Printer size={13} />
                        </button>

                        {/* Owner PIN protected Edit */}
                        <button
                          className="crm-action-btn"
                          onClick={() => handleRequestOwnerAuth('edit', row)}
                          title="Edit (Requires Owner PIN)"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Owner PIN protected Delete */}
                        <button
                          className="crm-action-btn danger"
                          onClick={() => handleRequestOwnerAuth('delete', row)}
                          title="Delete (Requires Owner PIN)"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty-state">
              <p>No customer jobs match your filters for {selectedMonthLabel}.</p>
              <button className="button primary" style={{ marginTop: '8px' }} onClick={openCreate}>
                <Plus size={15} /> Add job for {selectedMonthLabel}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      {showForm && (
        <CustomerModal
          workTypes={workTypes}
          workStatuses={workStatuses}
          customers={customers}
          editing={editing}
          isOwnerMode={isOwnerMode}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={handleSave}
        />
      )}

      {quickPayCustomer && (
        <QuickPayModal
          customer={quickPayCustomer}
          onClose={() => setQuickPayCustomer(null)}
          onSavePayment={onSaveCustomer}
        />
      )}

      <OwnerAuthModal
        isOpen={ownerAuth.isOpen}
        actionTitle={ownerAuth.action === 'delete' ? 'Owner Authorization: Delete Record' : 'Owner Authorization: Edit Record'}
        actionDescription={
          ownerAuth.action === 'delete'
            ? `Enter Owner PIN to delete "${ownerAuth.customer?.customer_name}"'s record.`
            : `Enter Owner PIN to edit "${ownerAuth.customer?.customer_name}"'s record.`
        }
        onClose={() => setOwnerAuth({ isOpen: false, action: 'edit', customer: null })}
        onVerified={handleOwnerVerified}
      />

      {deleting && (
        <ConfirmDialog
          title="Delete job?"
          message={`"${deleting.customer_name}"'s job will be permanently removed and all stats recalculated.`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
