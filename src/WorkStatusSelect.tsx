import React, { useState } from 'react';
import { ChevronDown, CheckCircle2, Clock, AlertTriangle, FileText, XCircle, Ban, Send } from 'lucide-react';
import { WorkStatus } from './types';

interface WorkStatusSelectProps {
  currentStatus: string;
  workStatuses?: WorkStatus[];
  customerId: string;
  customerName: string;
  onStatusChange: (newStatus: string, customerId: string) => Promise<void> | void;
  disabled?: boolean;
}

const DEFAULT_STATUS_LIST = [
  'Pending',
  'In Progress',
  'Payment Pending',
  'Document Required',
  'Completed',
  'Delivered',
  'Rejected',
  'Cancelled',
];

export function getStatusStyle(status: string) {
  const norm = (status || '').toLowerCase().trim();
  switch (norm) {
    case 'completed':
    case 'complete':
    case 'compleated':
    case 'done':
    case 'work done':
      return {
        color: '#047857',
        background: '#ecfdf5',
        borderColor: '#a7f3d0',
        dotColor: '#10b981',
      };
    case 'delivered':
    case 'deliver':
      return {
        color: '#6d28d9',
        background: '#f5f3ff',
        borderColor: '#ddd6fe',
        dotColor: '#8b5cf6',
      };
    case 'in progress':
    case 'inprogress':
    case 'progress':
    case 'processing':
      return {
        color: '#0369a1',
        background: '#f0f9ff',
        borderColor: '#bae6fd',
        dotColor: '#0ea5e9',
      };
    case 'payment pending':
    case 'pay required':
    case 'payment required':
    case 'pay pending':
      return {
        color: '#c2410c',
        background: '#fff7ed',
        borderColor: '#fed7aa',
        dotColor: '#f97316',
      };
    case 'document required':
    case 'docs required':
    case 'doc required':
    case 'documents required':
      return {
        color: '#a16207',
        background: '#fefce8',
        borderColor: '#fef08a',
        dotColor: '#eab308',
      };
    case 'rejected':
    case 'reject':
      return {
        color: '#b91c1c',
        background: '#fef2f2',
        borderColor: '#fecaca',
        dotColor: '#ef4444',
      };
    case 'cancelled':
    case 'canceled':
    case 'cancel':
      return {
        color: '#475569',
        background: '#f8fafc',
        borderColor: '#cbd5e1',
        dotColor: '#94a3b8',
      };
    case 'pending':
    default:
      return {
        color: '#b45309',
        background: '#fffbeb',
        borderColor: '#fde68a',
        dotColor: '#f59e0b',
      };
  }
}

export function WorkStatusSelect({
  currentStatus,
  workStatuses = [],
  customerId,
  customerName,
  onStatusChange,
  disabled = false,
}: WorkStatusSelectProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Combine default and custom statuses
  const statusOptions = Array.from(
    new Set([
      ...DEFAULT_STATUS_LIST,
      ...workStatuses.map((ws) => ws.name),
      currentStatus,
    ].filter(Boolean))
  );

  const style = getStatusStyle(currentStatus);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;

    setIsUpdating(true);
    try {
      await onStatusChange(newStatus, customerId);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
      }}
      title={`Current Status: ${currentStatus}. Click to change work status.`}
    >
      <div
        style={{
          position: 'absolute',
          left: '8px',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: style.dotColor,
          pointerEvents: 'none',
          boxShadow: `0 0 6px ${style.dotColor}`,
          zIndex: 1,
        }}
      />
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={disabled || isUpdating}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          backgroundColor: style.background,
          color: style.color,
          border: `1px solid ${style.borderColor}`,
          borderRadius: '20px',
          padding: '4px 22px 4px 20px',
          fontSize: '11.5px',
          fontWeight: 700,
          cursor: disabled || isUpdating ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease-in-out',
          opacity: isUpdating ? 0.6 : 1,
          lineHeight: 1.4,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {statusOptions.map((opt) => (
          <option key={opt} value={opt} style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>
            {opt}
          </option>
        ))}
      </select>
      <div
        style={{
          position: 'absolute',
          right: '7px',
          pointerEvents: 'none',
          color: style.color,
          display: 'flex',
          alignItems: 'center',
          opacity: 0.75,
        }}
      >
        <ChevronDown size={12} strokeWidth={2.5} />
      </div>
    </div>
  );
}
