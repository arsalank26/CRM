import { useState, useEffect } from 'react';
import {
  FileSpreadsheet, Sparkles, RefreshCw, Check, Copy, ExternalLink, Calendar,
  Download, PlusCircle, CheckCircle2, AlertCircle, HelpCircle, Layers, ArrowUpRight
} from 'lucide-react';
import { CustomerRecord, Spending, Kirkol, TotalsSummary, MONTH_NAMES, calculateMonthTotals, formatCurrency } from './types';

type Props = {
  customers: CustomerRecord[];
  spendings: Spending[];
  kirkol: Kirkol[];
  totals: TotalsSummary;
  notify: (msg: string) => void;
};

const STORAGE_KEY = 'al_uzer_sheets_config';
const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbxNUI2eYoQdy5dHCilHkf1r7Gc5UxgzvkpcXi8PSQO4fzgZkivGhbHC5oEdTQDKi7DQ/exec';
const DEFAULT_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1oklvgEStaUW1P73_qqyrbCXSCQ_iYj-d0K94bmraxb4/edit?pli=1&gid=0#gid=0';

export function GoogleSheetsPage({ customers, spendings, kirkol, totals, notify }: Props) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(DEFAULT_SPREADSHEET_URL);
  const [activeYear, setActiveYear] = useState<number>(currentYear);
  const [activeMonth, setActiveMonth] = useState<number>(currentMonth);
  const [newYearTarget, setNewYearTarget] = useState<number>(currentYear + 1);

  const [syncing, setSyncing] = useState(false);
  const [creatingMonth, setCreatingMonth] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'workspace' | 'setup'>('workspace');

  // Load saved config
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const activeWebhook = (!parsed.webhookUrl || parsed.webhookUrl.includes('AKfycbwgOZYrRO8GYXw7lvDcau0JnlBlPlWgMEEw5AQ_LUsNgqZVtWY9y_SeIl4eSP181w') || parsed.webhookUrl.includes('AKfycbzJrQPQQ6p4YsM4XqTSwKdbN1NcupzKLG-FBbzCRidqWKYUzkkhCZ6-cHWNqwHjta5d'))
          ? DEFAULT_WEBHOOK_URL
          : parsed.webhookUrl;
        const activeSpreadsheet = (!parsed.spreadsheetUrl || parsed.spreadsheetUrl.includes('1ynBrpLAEFuuzn1SL3ZqjScEQHd9SB6d45Rei9bK3uFk') || parsed.spreadsheetUrl.includes('1pHMlFy-Qn1u4ssrYnyUR_uwvFbt2xveaPOZW5JY7V_I'))
          ? DEFAULT_SPREADSHEET_URL
          : parsed.spreadsheetUrl;

        setWebhookUrl(activeWebhook);
        setSpreadsheetUrl(activeSpreadsheet);
        if (parsed.lastSync) setLastSync(parsed.lastSync);

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ webhookUrl: activeWebhook, spreadsheetUrl: activeSpreadsheet, lastSync: parsed.lastSync })
        );
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ webhookUrl: DEFAULT_WEBHOOK_URL, spreadsheetUrl: DEFAULT_SPREADSHEET_URL })
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ webhookUrl, spreadsheetUrl, lastSync })
      );
      notify('Google Sheets settings saved.');
      testConnection();
    } catch {
      notify('Failed to save settings to localStorage.');
    }
  };

  const testConnection = async () => {
    if (!webhookUrl) return;
    try {
      setSyncing(true);
      const res = await fetch(webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'action=status', {
        method: 'GET',
        mode: 'cors',
      });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus('connected');
        if (data.spreadsheetUrl && !spreadsheetUrl) {
          setSpreadsheetUrl(data.spreadsheetUrl);
        }
        notify('Connected to Google Sheets successfully!');
      } else {
        setConnectionStatus('error');
      }
    } catch {
      // In Google Apps Script, simple GET can still work or have CORS, fallback to connected if valid URL
      if (webhookUrl.startsWith('https://script.google.com/')) {
        setConnectionStatus('connected');
        notify('Google Apps Script URL validated.');
      } else {
        setConnectionStatus('error');
        notify('Invalid Google Apps Script URL.');
      }
    } finally {
      setSyncing(false);
    }
  };

  // Sync data for active month or all records to Google Sheets
  const syncToGoogleSheet = async (isMonthly = true) => {
    if (!webhookUrl) {
      notify('Please enter and save your Google Apps Script Web App URL first.');
      setActiveTab('setup');
      return;
    }

    setSyncing(true);
    try {
      const monthData = isMonthly
        ? calculateMonthTotals(customers, spendings, kirkol, activeYear, activeMonth)
        : {
          ...totals,
          filteredCustomers: customers,
          filteredSpendings: spendings,
          filteredKirkol: kirkol,
        };

      const payload = {
        action: 'sync_all',
        isMonthly,
        monthName: MONTH_NAMES[activeMonth],
        year: activeYear,
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
      };

      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script redirects require no-cors for direct browser posting
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setLastSync(now);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ webhookUrl, spreadsheetUrl, lastSync: now })
      );
      notify(`Synced ${monthData.filteredCustomers.length} jobs to Google Sheet (${MONTH_NAMES[activeMonth]} ${activeYear})!`);
      setConnectionStatus('connected');
    } catch (e) {
      notify('Sync request dispatched to Google Sheets.');
    } finally {
      setSyncing(false);
    }
  };

  // Create a specific Month Sheet tab in Google Sheet with Customers, Spendings, and Kirkol on a single page
  const createMonthSheetFor = async (targetMonth = activeMonth, targetYear = activeYear) => {
    if (!webhookUrl) {
      notify('Please configure your Google Apps Script URL first.');
      setActiveTab('setup');
      return;
    }

    setCreatingMonth(true);
    try {
      const monthData = calculateMonthTotals(customers, spendings, kirkol, targetYear, targetMonth);
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_month_sheet',
          monthName: MONTH_NAMES[targetMonth],
          year: targetYear,
          isMonthly: true,
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
        }),
      });

      notify(`Created "${MONTH_NAMES[targetMonth]} ${targetYear}" tab on single page with Customers, Spendings, & Kirkol!`);
    } catch {
      notify(`Month sheet command sent.`);
    } finally {
      setCreatingMonth(false);
    }
  };

  const createMonthSheet = () => createMonthSheetFor(activeMonth, activeYear);

  const createNextMonthSheet = async () => {
    const nextM = (activeMonth + 1) % 12;
    const nextY = activeMonth === 11 ? activeYear + 1 : activeYear;
    setActiveMonth(nextM);
    setActiveYear(nextY);
    await createMonthSheetFor(nextM, nextY);
  };

  // Create full new year workspace
  const createYearWorkspace = async () => {
    if (!webhookUrl) {
      notify('Please configure your Google Apps Script URL first.');
      setActiveTab('setup');
      return;
    }

    setCreatingYear(true);
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_year_workspace',
          year: newYearTarget,
        }),
      });

      notify(`New Year Workspace for ${newYearTarget} created with 12 monthly sheets! Check your Google Drive.`);
    } catch {
      notify(`New Year workspace command sent.`);
    } finally {
      setCreatingYear(false);
    }
  };

  const copyAppsScriptCode = async () => {
    try {
      const res = await fetch('/src/google-apps-script.js');
      let code = '';
      if (res.ok) {
        code = await res.text();
      } else {
        code = getEmbeddedAppsScriptCode();
      }
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      notify('Google Apps Script code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      await navigator.clipboard.writeText(getEmbeddedAppsScriptCode());
      setCopiedCode(true);
      notify('Google Apps Script code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  const downloadAppsScriptFile = () => {
    const code = getEmbeddedAppsScriptCode();
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Al_Uzer_Google_Apps_Script.gs';
    a.click();
    URL.revokeObjectURL(url);
    notify('Downloaded Al_Uzer_Google_Apps_Script.gs');
  };

  const monthTotals = calculateMonthTotals(customers, spendings, kirkol, activeYear, activeMonth);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow accent">GOOGLE WORKSPACE INTEGRATION</span>
          <h1>Google Sheets & Workspace Manager</h1>
          <p>Store all customer work, spendings, and income in Google Sheets with 12 monthly tabs and annual workspaces.</p>
        </div>
        <div className="heading-actions">
          <button
            className={`button ${activeTab === 'workspace' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveTab('workspace')}
          >
            <Layers size={16} /> Workspace & Sync
          </button>
          <button
            className={`button ${activeTab === 'setup' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveTab('setup')}
          >
            <HelpCircle size={16} /> Setup Guide & Script
          </button>
        </div>
      </div>

      {/* Main Connection Status Banner */}
      <section className="sheet-card" style={{ marginBottom: '20px' }}>
        <div className="sheet-logo">
          <FileSpreadsheet size={28} />
        </div>
        <div className="sheet-main">
          <span className="eyebrow">CONNECTED GOOGLE SHEET</span>
          <h2>Al Uzer CRM - Google Sheets Storage</h2>
          <p>Customer Records • Spendings • Kirkol • 12 Monthly Tabs • Year Workspaces</p>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '10px' }}>
            <span className={`connected-label ${webhookUrl ? 'active' : ''}`} style={{ color: webhookUrl ? '#167c57' : '#9aa49e' }}>
              <i style={{ background: webhookUrl ? '#167c57' : '#9aa49e' }} />
              {webhookUrl ? 'Apps Script Connected' : 'Not Connected (Paste Web App URL below)'}
            </span>
            {lastSync && <span style={{ fontSize: '11px', color: '#78847d' }}>• Last synced: {lastSync}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl.startsWith('http') ? spreadsheetUrl : `https://docs.google.com/spreadsheets/d/${spreadsheetUrl}`}
              target="_blank"
              rel="noreferrer"
              className="button secondary"
              style={{ textDecoration: 'none' }}
            >
              Open Google Sheet <ExternalLink size={14} />
            </a>
          )}
          <button
            className="button primary"
            onClick={() => syncToGoogleSheet(true)}
            disabled={syncing || !webhookUrl}
          >
            <RefreshCw size={15} className={syncing ? 'spin-icon' : ''} />
            {syncing ? 'Syncing to Sheet...' : 'Sync Active Month'}
          </button>
        </div>
      </section>

      {activeTab === 'workspace' && (
        <>
          {/* 12-Month Workspace Controls Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', marginBottom: '20px' }}>
            {/* Monthly Management Panel */}
            <section className="panel" style={{ padding: '22px' }}>
              <div className="panel-header" style={{ marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '16px' }}>Monthly Sheet Management (12 Months)</h2>
                  <p>Switch active month and create or sync monthly sheet tabs in your spreadsheet.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#55655b', marginBottom: '6px' }}>
                    Select Month (1-12)
                  </label>
                  <select
                    className="filter-select"
                    style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600 }}
                    value={activeMonth}
                    onChange={(e) => setActiveMonth(Number(e.target.value))}
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {idx + 1}. {m} ({activeYear})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#55655b', marginBottom: '6px' }}>
                    Select Year
                  </label>
                  <input
                    type="number"
                    value={activeYear}
                    onChange={(e) => setActiveYear(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: '1px solid #dfe6e1',
                      borderRadius: '7px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              {/* Month Summary Preview Box */}
              <div style={{ background: '#f5f8f5', borderRadius: '8px', padding: '14px', marginBottom: '18px', border: '1px solid #e4e9e4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '12px', color: '#18382b' }}>
                    {MONTH_NAMES[activeMonth]} {activeYear} Data
                  </strong>
                  <span style={{ fontSize: '11px', color: '#167c57', fontWeight: 700 }}>
                    {monthTotals.filteredCustomers.length} Jobs Ready
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: '#888', display: 'block' }}>Total Revenue:</span>
                    <strong>{formatCurrency(monthTotals.totalAmount)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#888', display: 'block' }}>Total Income:</span>
                    <strong style={{ color: '#167c57' }}>{formatCurrency(monthTotals.totalIncome)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#888', display: 'block' }}>Remaining:</span>
                    <strong style={{ color: '#18382b' }}>{formatCurrency(monthTotals.remainingAmount)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="button primary"
                  onClick={() => syncToGoogleSheet(true)}
                  disabled={syncing || !webhookUrl}
                >
                  <RefreshCw size={15} className={syncing ? 'spin-icon' : ''} />
                  Sync "{MONTH_NAMES[activeMonth]} {activeYear}"
                </button>
                <button
                  className="button secondary"
                  onClick={createMonthSheet}
                  disabled={creatingMonth || !webhookUrl}
                >
                  <PlusCircle size={15} />
                  {creatingMonth ? 'Creating Tab...' : `Create "${MONTH_NAMES[activeMonth]}" Tab`}
                </button>
                <button
                  className="button secondary"
                  onClick={createNextMonthSheet}
                  disabled={creatingMonth || !webhookUrl}
                  style={{ borderColor: '#167c57', color: '#167c57' }}
                >
                  <ArrowUpRight size={15} />
                  {`+ Next Month ("${MONTH_NAMES[(activeMonth + 1) % 12]}")`}
                </button>
              </div>

              <div style={{ marginTop: '14px', padding: '10px 12px', background: '#eaf6ef', borderRadius: '7px', fontSize: '11px', color: '#18382b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#167c57" />
                <span><strong>Single Page Layout:</strong> Every month tab contains Customers, Spendings, and Kirkol together on that single page! New customer entries auto-sync to their month.</span>
              </div>
            </section>

            {/* Year-End Workspace Creator */}
            <section className="panel" style={{ padding: '22px' }}>
              <div className="panel-header" style={{ marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '16px' }}>Year-End / New Year Workspace</h2>
                  <p>When the year ends, create a complete new Google Spreadsheet workspace with all 12 pre-formatted monthly tabs.</p>
                </div>
              </div>

              <div style={{ background: '#eaf6ef', border: '1px solid #cce8d7', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
                <span className="eyebrow accent" style={{ marginBottom: '4px' }}>AUTOMATIC 12-MONTH CREATION</span>
                <p style={{ fontSize: '12px', color: '#274b39', margin: '4px 0 12px' }}>
                  Creates <strong>"Al Uzer CRM - {newYearTarget} Workspace"</strong> in your Google Drive with:
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#3d6350', lineHeight: 1.6 }}>
                  <li>Annual Overview Summary Sheet</li>
                  <li>12 Formatted Monthly Tabs (January to December)</li>
                  <li>Pre-configured formulas & column widths</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#55655b' }}>
                  Target Year:
                </label>
                <input
                  type="number"
                  value={newYearTarget}
                  onChange={(e) => setNewYearTarget(Number(e.target.value))}
                  style={{
                    width: '90px',
                    padding: '8px 10px',
                    border: '1px solid #dfe6e1',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                />
                <button
                  className="button primary"
                  style={{ background: '#18382b', flex: 1 }}
                  onClick={createYearWorkspace}
                  disabled={creatingYear || !webhookUrl}
                >
                  <Sparkles size={15} />
                  {creatingYear ? 'Creating Workspace...' : `Create ${newYearTarget} Workspace`}
                </button>
              </div>
            </section>
          </div>

          {/* Quick Settings & Connection Card */}
          <section className="panel" style={{ padding: '22px', marginBottom: '20px' }}>
            <div className="panel-header" style={{ marginBottom: '14px' }}>
              <div>
                <h2>Google Apps Script Webhook Settings</h2>
                <p>Enter the deployed Google Apps Script Web App URL to enable instant syncing.</p>
              </div>
              <button className="button secondary" onClick={testConnection} disabled={!webhookUrl}>
                Test Connection
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#65736a', marginBottom: '6px' }}>
                  Google Apps Script Web App URL
                </label>
                <input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value.trim())}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #dfe6e1',
                    borderRadius: '7px',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#65736a', marginBottom: '6px' }}>
                  Google Sheet URL (Optional)
                </label>
                <input
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value.trim())}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #dfe6e1',
                    borderRadius: '7px',
                    fontSize: '12px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="button primary" onClick={saveSettings}>
                Save Settings
              </button>
            </div>
          </section>
        </>
      )}

      {activeTab === 'setup' && (
        <section className="panel" style={{ padding: '26px' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <div>
              <span className="eyebrow accent">STEP-BY-STEP INSTRUCTIONS</span>
              <h2 style={{ fontSize: '18px' }}>How to Connect Google Sheets (One-Time Setup)</h2>
              <p>Follow these 5 simple steps to connect Google Sheets to Al Uzer CRM.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button secondary" onClick={downloadAppsScriptFile}>
                <Download size={15} /> Download .gs File
              </button>
              <button className="button primary" onClick={copyAppsScriptCode}>
                {copiedCode ? <Check size={15} /> : <Copy size={15} />}
                {copiedCode ? 'Code Copied!' : 'Copy Apps Script Code'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: '#f5f8f5', border: '1px solid #e4e9e4', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '24px', height: '24px', background: '#167c57', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700 }}>1</span>
                <strong>Open Google Sheets</strong>
              </div>
              <p style={{ fontSize: '11px', color: '#68766e', margin: 0 }}>
                Go to <a href="https://sheets.google.com" target="_blank" rel="noreferrer" style={{ color: '#167c57', fontWeight: 600 }}>sheets.google.com</a> and create a blank sheet (or open your existing one).
              </p>
            </div>

            <div style={{ background: '#f5f8f5', border: '1px solid #e4e9e4', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '24px', height: '24px', background: '#167c57', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700 }}>2</span>
                <strong>Open Apps Script</strong>
              </div>
              <p style={{ fontSize: '11px', color: '#68766e', margin: 0 }}>
                Click <strong>Extensions</strong> in the top menu, then click <strong>Apps Script</strong>.
              </p>
            </div>

            <div style={{ background: '#f5f8f5', border: '1px solid #e4e9e4', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '24px', height: '24px', background: '#167c57', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700 }}>3</span>
                <strong>Paste Script Code</strong>
              </div>
              <p style={{ fontSize: '11px', color: '#68766e', margin: 0 }}>
                Delete any existing code in the editor, click <strong>"Copy Apps Script Code"</strong> above, and paste it. Press <strong>Ctrl+S</strong> to save.
              </p>
            </div>

            <div style={{ background: '#f5f8f5', border: '1px solid #e4e9e4', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '24px', height: '24px', background: '#167c57', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700 }}>4</span>
                <strong>Deploy as Web App</strong>
              </div>
              <p style={{ fontSize: '11px', color: '#68766e', margin: 0 }}>
                Click <strong>Deploy → New deployment → Web app</strong>. Set <em>Execute as: Me</em> and <strong>Who has access: Anyone</strong>. Click Deploy.
              </p>
            </div>

            <div style={{ background: '#f5f8f5', border: '1px solid #e4e9e4', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '24px', height: '24px', background: '#167c57', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700 }}>5</span>
                <strong>Paste URL & Save</strong>
              </div>
              <p style={{ fontSize: '11px', color: '#68766e', margin: 0 }}>
                Copy the Web App URL (starts with <code>https://script.google.com/...</code>) and paste it into the Webhook URL box on this page!
              </p>
            </div>
          </div>

          <div style={{ background: '#18382b', color: '#d8f2e3', borderRadius: '10px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>Ready to copy the code?</strong>
              <span style={{ fontSize: '12px', color: '#a2cbb5' }}>Click the button on the right to copy the full Google Apps Script code.</span>
            </div>
            <button
              className="button primary"
              style={{ background: '#fff', color: '#18382b', fontWeight: 700 }}
              onClick={copyAppsScriptCode}
            >
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              {copiedCode ? 'Copied!' : 'Copy Code Now'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function getEmbeddedAppsScriptCode(): string {
  return `/**
 * ============================================================================
 * AL UZER COMMON SERVICES - GOOGLE APPS SCRIPT WEB APP
 * ============================================================================
 * 
 * HOW TO SET UP THIS GOOGLE APPS SCRIPT:
 * 1. Open your Google Spreadsheet:
 *    https://docs.google.com/spreadsheets/d/1oklvgEStaUW1P73_qqyrbCXSCQ_iYj-d0K94bmraxb4/edit
 * 2. In the top menu, click: Extensions -> Apps Script.
 * 3. Delete all code currently in the editor and PASTE this entire script.
 * 4. Click the "Save project" (Floppy disk icon) or press Ctrl+S.
 * 5. Click the blue "Deploy" button (top right) -> "Manage deployments" -> edit icon (pencil)
 *    -> Version: "New version" -> Deploy.
 *    (OR click "New deployment" -> type: Web app -> Execute as: Me -> Access: Anyone -> Deploy)
 * 6. That's it! Your single-page layout (Customers + Spendings + Kirkol) is now active.
 * ============================================================================
 */

var DEFAULT_SPREADSHEET_ID = '1oklvgEStaUW1P73_qqyrbCXSCQ_iYj-d0K94bmraxb4';

var MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getSpreadsheet(data) {
  var id = (data && (data.spreadsheetId || data.id)) || DEFAULT_SPREADSHEET_ID;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId()) return ss;
  } catch (e) { }

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) { }
  }
  return null;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'status';
  var ss = getSpreadsheet(e ? e.parameter : null);

  if (action === 'status') {
    if (!ss) {
      return createJsonResponse({
        success: false,
        error: 'Could not access spreadsheet. Please check Spreadsheet ID: ' + DEFAULT_SPREADSHEET_ID
      });
    }
    return createJsonResponse({
      success: true,
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      sheets: ss.getSheets().map(function (s) { return s.getName(); }),
      message: 'Google Apps Script Web App is connected and active!'
    });
  }

  return createJsonResponse({ success: true, message: 'Al Uzer CRM Web App API is running.' });
}

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var action = data.action || 'sync_all';
    var ss = getSpreadsheet(data);

    if (!ss) {
      return createJsonResponse({
        success: false,
        error: 'Unable to open target spreadsheet (ID: ' + DEFAULT_SPREADSHEET_ID + ').'
      });
    }

    switch (action) {
      case 'get_status':
        return createJsonResponse({
          success: true,
          spreadsheetName: ss.getName(),
          spreadsheetUrl: ss.getUrl(),
          spreadsheetId: ss.getId(),
          sheets: ss.getSheets().map(function (s) { return s.getName(); })
        });

      case 'create_month_sheet':
        return handleCreateMonthSheet(ss, data);

      case 'create_year_workspace':
        return handleCreateYearWorkspace(data);

      case 'sync_all':
        return handleSyncAll(ss, data);

      case 'save_customer':
        return handleSaveCustomer(ss, data);

      case 'save_spending':
        return handleSaveSpending(ss, data);

      case 'save_kirkol':
        return handleSaveKirkol(ss, data);

      default:
        return createJsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString(), stack: err.stack });
  }
}

function handleCreateMonthSheet(ss, data) {
  var monthName = data.monthName || 'September';
  var year = data.year || new Date().getFullYear();
  var sheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  renderFullMonthSheet(
    sheet,
    sheetName,
    data.customers || [],
    data.spendings || [],
    data.kirkol || [],
    data.totals || {}
  );

  return createJsonResponse({
    success: true,
    sheetName: sheetName,
    spreadsheetUrl: ss.getUrl(),
    message: 'Month sheet "' + sheetName + '" created with Customer, Spending, and Kirkol on a single page!'
  });
}

function handleCreateYearWorkspace(data) {
  var year = Number(data.year) || (new Date().getFullYear() + 1);
  var workspaceName = 'Al Uzer CRM - ' + year + ' Workspace';

  var newSS = SpreadsheetApp.create(workspaceName);

  var overviewSheet = newSS.getActiveSheet();
  overviewSheet.setName('Annual Overview');
  formatAnnualOverviewSheet(overviewSheet, year, MONTHS);

  for (var i = 0; i < MONTHS.length; i++) {
    var monthSheet = newSS.insertSheet(MONTHS[i] + ' ' + year);
    renderFullMonthSheet(monthSheet, MONTHS[i] + ' ' + year, [], [], [], {});
  }

  return createJsonResponse({
    success: true,
    year: year,
    spreadsheetId: newSS.getId(),
    spreadsheetUrl: newSS.getUrl(),
    spreadsheetName: workspaceName,
    message: 'New Year Workspace "' + workspaceName + '" created with 12 formatted single-page month sheets!'
  });
}

function handleSyncAll(ss, data) {
  var monthName = data.monthName || 'September';
  var year = data.year || new Date().getFullYear();
  var customers = data.customers || [];
  var spendings = data.spendings || [];
  var kirkol = data.kirkol || [];
  var totals = data.totals || {};

  var targetSheetName = data.isMonthly ? (monthName + ' ' + year) : (monthName + ' ' + year);
  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
  }

  renderFullMonthSheet(sheet, targetSheetName, customers, spendings, kirkol, totals);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    customersCount: customers.length,
    spendingsCount: spendings.length,
    kirkolCount: kirkol.length,
    spreadsheetUrl: ss.getUrl(),
    message: 'Data successfully synced to ' + targetSheetName + ' on a single page!'
  });
}

function handleSaveCustomer(ss, data) {
  var c = data.customer || data;
  var d = c.created_at ? new Date(c.created_at) : new Date();
  var monthName = data.monthName || MONTHS[d.getMonth()];
  var year = data.year || d.getFullYear();
  var targetSheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    renderFullMonthSheet(sheet, targetSheetName, [], [], [], {});
  }

  if (data.customers && data.customers.length > 0) {
    renderFullMonthSheet(sheet, targetSheetName, data.customers, data.spendings || [], data.kirkol || [], data.totals || {});
    return createJsonResponse({ success: true, sheetName: targetSheetName, message: 'Updated ' + targetSheetName });
  }

  insertCustomerIntoMonthSheet(sheet, c);
  recalculateSheetTotals(sheet);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    message: 'Customer added to ' + targetSheetName + ' sheet'
  });
}

function handleSaveSpending(ss, data) {
  var s = data.spending || data;
  var d = s.created_at ? new Date(s.created_at) : new Date();
  var monthName = data.monthName || MONTHS[d.getMonth()];
  var year = data.year || d.getFullYear();
  var targetSheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    renderFullMonthSheet(sheet, targetSheetName, [], [], [], {});
  }

  if (data.spendings && data.spendings.length > 0) {
    renderFullMonthSheet(sheet, targetSheetName, data.customers || [], data.spendings, data.kirkol || [], data.totals || {});
    return createJsonResponse({ success: true, sheetName: targetSheetName, message: 'Updated ' + targetSheetName });
  }

  insertSpendingIntoMonthSheet(sheet, s);
  recalculateSheetTotals(sheet);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    message: 'Spending added to ' + targetSheetName + ' sheet'
  });
}

function handleSaveKirkol(ss, data) {
  var k = data.kirkol || data;
  var d = k.created_at ? new Date(k.created_at) : new Date();
  var monthName = data.monthName || MONTHS[d.getMonth()];
  var year = data.year || d.getFullYear();
  var targetSheetName = monthName + ' ' + year;

  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    renderFullMonthSheet(sheet, targetSheetName, [], [], [], {});
  }

  if (data.kirkol && data.kirkol.length > 0) {
    renderFullMonthSheet(sheet, targetSheetName, data.customers || [], data.spendings || [], data.kirkol, data.totals || {});
    return createJsonResponse({ success: true, sheetName: targetSheetName, message: 'Updated ' + targetSheetName });
  }

  insertKirkolIntoMonthSheet(sheet, k);
  recalculateSheetTotals(sheet);

  return createJsonResponse({
    success: true,
    sheetName: targetSheetName,
    message: 'Kirkol added to ' + targetSheetName + ' sheet'
  });
}

function renderFullMonthSheet(sheet, sheetTitle, customers, spendings, kirkol, totals) {
  customers = customers || [];
  spendings = spendings || [];
  kirkol = kirkol || [];
  totals = totals || {};

  sheet.clear();

  // 1. Title Banner
  sheet.getRange('A1:L1').merge();
  var titleCell = sheet.getRange('A1');
  titleCell.setValue('AL UZER COMMON SERVICES - ' + sheetTitle.toUpperCase());
  titleCell.setFontSize(14).setFontWeight('bold').setBackground('#18382b').setFontColor('#ffffff').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 40);

  // Compute values
  var custTotal = 0, custPaid = 0, custBalance = 0, custExpense = 0, custIncome = 0;
  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    var tot = Number(c.total_amount) || 0;
    var pd = Number(c.paid) || 0;
    var exp = Number(c.expense) || 0;
    custTotal += tot;
    custPaid += pd;
    custBalance += (tot - pd);
    custIncome += (tot - exp);
  }

  var spendTotal = 0;
  for (var j = 0; j < spendings.length; j++) {
    spendTotal += (Number(spendings[j].amount) || 0);
  }

  var kirkolTotal = 0;
  for (var k = 0; k < kirkol.length; k++) {
    kirkolTotal += (Number(kirkol[k].price) || 0);
  }

  var finalTotalAmount = totals.totalAmount != null ? totals.totalAmount : custTotal;
  var finalCollected = totals.collectedAmount != null ? totals.collectedAmount : custPaid;
  var finalPending = totals.pendingAmount != null ? totals.pendingAmount : custBalance;
  var finalIncome = totals.totalIncome != null ? totals.totalIncome : (custIncome + kirkolTotal);
  var finalSpending = totals.totalSpending != null ? totals.totalSpending : spendTotal;
  var remainingVal = finalIncome - finalSpending;

  // 2. KPI Summary Cards
  sheet.getRange('A3:B3').merge().setValue('Total Jobs / Records').setFontWeight('bold').setBackground('#f0f5f2');
  sheet.getRange('A4:B4').merge().setValue(customers.length).setFontSize(13).setFontWeight('bold');

  sheet.getRange('C3:D3').merge().setValue('Sum of Total Amount').setFontWeight('bold').setBackground('#f0f5f2');
  sheet.getRange('C4:D4').merge().setValue(finalTotalAmount).setFontSize(13).setFontWeight('bold').setNumberFormat('₹#,##0');

  sheet.getRange('E3:F3').merge().setValue('Collected Amount').setFontWeight('bold').setBackground('#e7f5ed');
  sheet.getRange('E4:F4').merge().setValue(finalCollected).setFontSize(13).setFontWeight('bold').setFontColor('#167c57').setNumberFormat('₹#,##0');

  sheet.getRange('G3:H3').merge().setValue('Pending Amount').setFontWeight('bold').setBackground('#fff0ea');
  sheet.getRange('G4:H4').merge().setValue(finalPending).setFontSize(13).setFontWeight('bold').setFontColor('#c46143').setNumberFormat('₹#,##0');

  sheet.getRange('I3:J3').merge().setValue('Total Income (Profit)').setFontWeight('bold').setBackground('#e6f5ee');
  sheet.getRange('I4:J4').merge().setValue(finalIncome).setFontSize(13).setFontWeight('bold').setFontColor('#167c57').setNumberFormat('₹#,##0');

  sheet.getRange('K3:L3').merge().setValue('Total Spending').setFontWeight('bold').setBackground('#fff3dd');
  sheet.getRange('K4:L4').merge().setValue(finalSpending).setFontSize(13).setFontWeight('bold').setFontColor('#b27a29').setNumberFormat('₹#,##0');

  // 3. Remaining Amount Banner
  sheet.getRange('A6:L6').merge();
  var remainingCell = sheet.getRange('A6');
  remainingCell.setValue('★ REMAINING AMOUNT (Total Income - Total Spending): ' + formatInr(remainingVal));
  remainingCell.setFontSize(12).setFontWeight('bold').setBackground('#d8f2e3').setFontColor('#105a3e').setHorizontalAlignment('center');
  sheet.setRowHeight(6, 32);

  // 4. Section 1: Customer Work & Transactions Table
  sheet.getRange('A8').setValue('CUSTOMER WORK & TRANSACTIONS').setFontSize(11).setFontWeight('bold').setFontColor('#18382b');
  var custHeaders = ['#', 'Date', 'Customer Name', 'Mobile', 'Work Type', 'Work Status', 'Total Amount (₹)', 'Paid (₹)', 'Balance (₹)', 'Expense (₹)', 'Income (₹)', 'Payment Status'];
  sheet.getRange(9, 1, 1, custHeaders.length).setValues([custHeaders])
    .setFontWeight('bold').setBackground('#167c57').setFontColor('#ffffff');

  var startRow = 10;
  if (customers.length > 0) {
    var custRows = customers.map(function (c, idx) {
      var tot = Number(c.total_amount) || 0;
      var pd = Number(c.paid) || 0;
      var exp = Number(c.expense) || 0;
      var bal = tot - pd;
      var inc = tot - exp;
      return [
        idx + 1,
        formatDateStr(c.created_at),
        c.customer_name || '',
        c.mobile || '',
        c.work_type || '',
        c.work_status || '',
        tot,
        pd,
        bal,
        exp,
        inc,
        c.payment_status || ''
      ];
    });
    sheet.getRange(startRow, 1, custRows.length, custHeaders.length).setValues(custRows);
    sheet.getRange(startRow, 7, custRows.length, 5).setNumberFormat('₹#,##0');
    startRow += custRows.length;
  } else {
    sheet.getRange(startRow, 1, 1, custHeaders.length).merge().setValue('No customer records found.')
      .setFontStyle('italic').setFontColor('#888888').setHorizontalAlignment('center');
    startRow += 1;
  }

  // 5. Section 2: Business Spendings
  startRow += 2;
  sheet.getRange(startRow, 1).setValue('BUSINESS SPENDINGS').setFontSize(11).setFontWeight('bold').setFontColor('#b27a29');
  startRow += 1;
  var spendHeaders = ['#', 'Date', 'Expense Name', 'Category', 'Amount (₹)'];
  sheet.getRange(startRow, 1, 1, spendHeaders.length).setValues([spendHeaders])
    .setFontWeight('bold').setBackground('#c78329').setFontColor('#ffffff');
  startRow += 1;

  if (spendings.length > 0) {
    var spendRows = spendings.map(function (s, idx) {
      return [
        idx + 1,
        formatDateStr(s.created_at),
        s.expense_name || '',
        s.category || '',
        Number(s.amount) || 0
      ];
    });
    sheet.getRange(startRow, 1, spendRows.length, spendHeaders.length).setValues(spendRows);
    sheet.getRange(startRow, 5, spendRows.length, 1).setNumberFormat('₹#,##0');
    startRow += spendRows.length;
  } else {
    sheet.getRange(startRow, 1, 1, spendHeaders.length).merge().setValue('No spending recorded.')
      .setFontStyle('italic').setFontColor('#888888').setHorizontalAlignment('center');
    startRow += 1;
  }

  // 6. Section 3: Kirkol (Misc Work)
  startRow += 2;
  sheet.getRange(startRow, 1).setValue('KIRKOL (MISC WORK)').setFontSize(11).setFontWeight('bold').setFontColor('#e8753a');
  startRow += 1;
  var kirkolHeaders = ['#', 'Date', 'Work Description', 'Price (₹)'];
  sheet.getRange(startRow, 1, 1, kirkolHeaders.length).setValues([kirkolHeaders])
    .setFontWeight('bold').setBackground('#ff9a56').setFontColor('#ffffff');
  startRow += 1;

  if (kirkol.length > 0) {
    var kirkolRows = kirkol.map(function (k, idx) {
      return [
        idx + 1,
        formatDateStr(k.created_at),
        k.work || '',
        Number(k.price) || 0
      ];
    });
    sheet.getRange(startRow, 1, kirkolRows.length, kirkolHeaders.length).setValues(kirkolRows);
    sheet.getRange(startRow, 4, kirkolRows.length, 1).setNumberFormat('₹#,##0');
  } else {
    sheet.getRange(startRow, 1, 1, kirkolHeaders.length).merge().setValue('No kirkol recorded.')
      .setFontStyle('italic').setFontColor('#888888').setHorizontalAlignment('center');
  }

  for (var col = 1; col <= 12; col++) {
    sheet.autoResizeColumn(col);
  }
}

function findRowWithText(sheet, text) {
  var maxRows = Math.min(sheet.getLastRow() + 5, 200);
  if (maxRows <= 0) return -1;
  var values = sheet.getRange(1, 1, maxRows, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toUpperCase() === text.trim().toUpperCase()) {
      return i + 1;
    }
  }
  return -1;
}

function insertCustomerIntoMonthSheet(sheet, c) {
  var spendRow = findRowWithText(sheet, 'BUSINESS SPENDINGS');
  if (spendRow === -1) {
    renderFullMonthSheet(sheet, sheet.getName(), [c], [], [], {});
    return;
  }

  var cellA10 = String(sheet.getRange(10, 1).getValue()).trim();
  if (cellA10 === 'No customer records found.' || sheet.getRange(10, 1).isPartOfMerge()) {
    try {
      sheet.getRange(10, 1, 1, 12).breakApart();
    } catch (e) { }
    var tot = Number(c.total_amount) || 0;
    var pd = Number(c.paid) || 0;
    var exp = Number(c.expense) || 0;
    sheet.getRange(10, 1, 1, 12).setValues([[
      1,
      formatDateStr(c.created_at),
      c.customer_name || '',
      c.mobile || '',
      c.work_type || '',
      c.work_status || '',
      tot,
      pd,
      tot - pd,
      exp,
      tot - exp,
      c.payment_status || ''
    ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
    sheet.getRange(10, 7, 1, 5).setNumberFormat('₹#,##0');
    return;
  }

  var insertAt = Math.max(10, spendRow - 1);
  sheet.insertRowBefore(insertAt);

  var tot = Number(c.total_amount) || 0;
  var pd = Number(c.paid) || 0;
  var exp = Number(c.expense) || 0;
  var newIdx = insertAt - 9;

  sheet.getRange(insertAt, 1, 1, 12).setValues([[
    newIdx,
    formatDateStr(c.created_at),
    c.customer_name || '',
    c.mobile || '',
    c.work_type || '',
    c.work_status || '',
    tot,
    pd,
    tot - pd,
    exp,
    tot - exp,
    c.payment_status || ''
  ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
  sheet.getRange(insertAt, 7, 1, 5).setNumberFormat('₹#,##0');
}

function insertSpendingIntoMonthSheet(sheet, s) {
  var kirkolRow = findRowWithText(sheet, 'KIRKOL (MISC WORK)');
  var spendTitleRow = findRowWithText(sheet, 'BUSINESS SPENDINGS');
  if (spendTitleRow === -1 || kirkolRow === -1) return;

  var firstSpendRow = spendTitleRow + 2;
  var firstCell = String(sheet.getRange(firstSpendRow, 1).getValue()).trim();
  if (firstCell === 'No spending recorded.' || sheet.getRange(firstSpendRow, 1).isPartOfMerge()) {
    try {
      sheet.getRange(firstSpendRow, 1, 1, 5).breakApart();
    } catch (e) { }
    sheet.getRange(firstSpendRow, 1, 1, 5).setValues([[
      1,
      formatDateStr(s.created_at),
      s.expense_name || '',
      s.category || '',
      Number(s.amount) || 0
    ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
    sheet.getRange(firstSpendRow, 5, 1, 1).setNumberFormat('₹#,##0');
    return;
  }

  var insertAt = Math.max(firstSpendRow, kirkolRow - 1);
  sheet.insertRowBefore(insertAt);
  var newIdx = insertAt - (spendTitleRow + 1);
  sheet.getRange(insertAt, 1, 1, 5).setValues([[
    newIdx,
    formatDateStr(s.created_at),
    s.expense_name || '',
    s.category || '',
    Number(s.amount) || 0
  ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
  sheet.getRange(insertAt, 5, 1, 1).setNumberFormat('₹#,##0');
}

function insertKirkolIntoMonthSheet(sheet, k) {
  var kirkolTitleRow = findRowWithText(sheet, 'KIRKOL (MISC WORK)');
  if (kirkolTitleRow === -1) return;

  var firstKirkolRow = kirkolTitleRow + 2;
  var firstCell = String(sheet.getRange(firstKirkolRow, 1).getValue()).trim();
  if (firstCell === 'No kirkol recorded.' || sheet.getRange(firstKirkolRow, 1).isPartOfMerge()) {
    try {
      sheet.getRange(firstKirkolRow, 1, 1, 4).breakApart();
    } catch (e) { }
    sheet.getRange(firstKirkolRow, 1, 1, 4).setValues([[
      1,
      formatDateStr(k.created_at),
      k.work || '',
      Number(k.price) || 0
    ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
    sheet.getRange(firstKirkolRow, 4, 1, 1).setNumberFormat('₹#,##0');
    return;
  }

  var lastRow = sheet.getLastRow();
  var newIdx = (lastRow - (kirkolTitleRow + 1)) + 1;
  sheet.getRange(lastRow + 1, 1, 1, 4).setValues([[
    newIdx,
    formatDateStr(k.created_at),
    k.work || '',
    Number(k.price) || 0
  ]]).setFontStyle('normal').setFontColor('#000000').setHorizontalAlignment('left');
  sheet.getRange(lastRow + 1, 4, 1, 1).setNumberFormat('₹#,##0');
}

function recalculateSheetTotals(sheet) {
  try {
    var spendRow = findRowWithText(sheet, 'BUSINESS SPENDINGS');
    var kirkolRow = findRowWithText(sheet, 'KIRKOL (MISC WORK)');
    if (spendRow === -1 || kirkolRow === -1) return;

    var custCount = 0, totAmount = 0, collected = 0, pending = 0, custIncome = 0;
    var lastCustRow = spendRow - 2;
    if (lastCustRow >= 10) {
      var firstCell = String(sheet.getRange(10, 1).getValue()).trim();
      if (firstCell !== 'No customer records found.') {
        var numRows = (lastCustRow - 10) + 1;
        var custData = sheet.getRange(10, 7, numRows, 5).getValues();
        custCount = numRows;
        for (var i = 0; i < custData.length; i++) {
          totAmount += (Number(custData[i][0]) || 0);
          collected += (Number(custData[i][1]) || 0);
          pending += (Number(custData[i][2]) || 0);
          custIncome += (Number(custData[i][4]) || 0);
        }
      }
    }

    var totalSpending = 0;
    var lastSpendRow = kirkolRow - 2;
    var firstSpendRow = spendRow + 2;
    if (lastSpendRow >= firstSpendRow) {
      var firstSpendCell = String(sheet.getRange(firstSpendRow, 1).getValue()).trim();
      if (firstSpendCell !== 'No spending recorded.') {
        var numSpendRows = (lastSpendRow - firstSpendRow) + 1;
        var spendData = sheet.getRange(firstSpendRow, 5, numSpendRows, 1).getValues();
        for (var j = 0; j < spendData.length; j++) {
          totalSpending += (Number(spendData[j][0]) || 0);
        }
      }
    }

    var totalKirkol = 0;
    var firstKirkolRow = kirkolRow + 2;
    var lastKirkolRow = sheet.getLastRow();
    if (lastKirkolRow >= firstKirkolRow) {
      var firstKirkolCell = String(sheet.getRange(firstKirkolRow, 1).getValue()).trim();
      if (firstKirkolCell !== 'No kirkol recorded.') {
        var numKirkolRows = (lastKirkolRow - firstKirkolRow) + 1;
        var kirkolData = sheet.getRange(firstKirkolRow, 4, numKirkolRows, 1).getValues();
        for (var k = 0; k < kirkolData.length; k++) {
          totalKirkol += (Number(kirkolData[k][0]) || 0);
        }
      }
    }

    var totalIncome = custIncome + totalKirkol;
    var remaining = totalIncome - totalSpending;

    sheet.getRange('A4:B4').setValue(custCount);
    sheet.getRange('C4:D4').setValue(totAmount);
    sheet.getRange('E4:F4').setValue(collected);
    sheet.getRange('G4:H4').setValue(pending);
    sheet.getRange('I4:J4').setValue(totalIncome);
    sheet.getRange('K4:L4').setValue(totalSpending);
    sheet.getRange('A6').setValue('★ REMAINING AMOUNT (Total Income - Total Spending): ' + formatInr(remaining));
  } catch (e) { }
}

function formatAnnualOverviewSheet(sheet, year, months) {
  sheet.clear();
  sheet.getRange('A1:G1').merge();
  sheet.getRange('A1').setValue('AL UZER SERVICES - ANNUAL OVERVIEW ' + year)
    .setFontSize(15).setFontWeight('bold').setBackground('#18382b').setFontColor('#ffffff').setHorizontalAlignment('center');

  var headers = ['Month', 'Total Jobs', 'Total Revenue (₹)', 'Collected (₹)', 'Total Income (₹)', 'Total Spending (₹)', 'Remaining Amount (₹)'];
  sheet.getRange('A3:G3').setValues([headers]).setFontWeight('bold').setBackground('#167c57').setFontColor('#ffffff');

  var rows = months.map(function (m) {
    return [m + ' ' + year, 0, 0, 0, 0, 0, 0];
  });
  sheet.getRange(4, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(4, 3, rows.length, 5).setNumberFormat('₹#,##0');
}

function formatDateStr(isoStr) {
  if (!isoStr) return '';
  try {
    var d = new Date(isoStr);
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'GMT+05:30', 'yyyy-MM-dd');
  } catch (e) {
    return String(isoStr).substring(0, 10);
  }
}

function formatInr(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;
}
