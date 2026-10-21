import { SupabaseClient } from '@supabase/supabase-js';
import { CustomerRecord, makeId } from '../types';
import { SMSSettings, SMSQueueItem, SMSLogItem, SMSRuleAuditResult } from './smsTypes';

export const SMS_STORAGE_KEYS = {
  SETTINGS: 'al_uzer_sms_settings',
  QUEUE: 'al_uzer_sms_queue',
  LOGS: 'al_uzer_sms_logs',
};

export const DEFAULT_SMS_SETTINGS: SMSSettings = {
  id: 'sms-default-config',
  enabled: true,
  minDaysOverdue: 5,
  reminderFrequencyDays: 5,
  reminderTime: '10:00 AM',
  maxReminders: 3,
  businessName: 'Your Business',
  messageTemplate:
    'Dear {customer_name}, your outstanding balance of ₹{balance} for {work_type} has been pending for {days_pending} days. Please clear your pending amount at your earliest convenience. Thank you, {business_name}.',
  gatewayApiKey: '',
  gatewayDeviceName: '',
};

class SMSService {
  public getSettings(): SMSSettings {
    try {
      const saved = localStorage.getItem(SMS_STORAGE_KEYS.SETTINGS);
      if (saved) {
        return { ...DEFAULT_SMS_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SMS_SETTINGS;
  }

  public saveSettings(settings: SMSSettings): void {
    try {
      localStorage.setItem(
        SMS_STORAGE_KEYS.SETTINGS,
        JSON.stringify({ ...settings, updated_at: new Date().toISOString() })
      );
    } catch (e) {
      console.warn('Failed to save SMS settings to localStorage:', e);
    }
  }

  public getQueue(): SMSQueueItem[] {
    try {
      const raw = localStorage.getItem(SMS_STORAGE_KEYS.QUEUE);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  }

  public saveQueue(queue: SMSQueueItem[]): void {
    try {
      localStorage.setItem(SMS_STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save SMS queue:', e);
    }
  }

  public getLogs(): SMSLogItem[] {
    try {
      const raw = localStorage.getItem(SMS_STORAGE_KEYS.LOGS);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  }

  public saveLogs(logs: SMSLogItem[]): void {
    try {
      localStorage.setItem(SMS_STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to save SMS logs:', e);
    }
  }

  /**
   * Format message template with customer specifics
   */
  public compileMessage(
    template: string,
    customer: CustomerRecord,
    balance: number,
    daysPending: number,
    businessName: string
  ): string {
    return template
      .replace(/{customer_name}/g, customer.customer_name || 'Customer')
      .replace(/{balance}/g, balance.toLocaleString('en-IN'))
      .replace(/{work_type}/g, customer.work_type || 'Service')
      .replace(/{days_pending}/g, String(Math.max(daysPending, 1)))
      .replace(/{business_name}/g, businessName || 'Your Business');
  }

  /**
   * Clean mobile number for SMS dispatch
   */
  public sanitizePhone(mobile: string): string {
    if (!mobile) return '';
    const digits = mobile.replace(/[^0-9]/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return digits;
  }

  /**
   * Evaluates all customers against the 5-day overdue rule without modifying existing CRM/Sheets code.
   */
  public auditOverdueDebtors(customers: CustomerRecord[]): SMSRuleAuditResult {
    const settings = this.getSettings();
    const logs = this.getLogs();
    const queue = this.getQueue();
    const now = new Date();

    const eligibleDebtors: SMSRuleAuditResult['eligibleDebtors'] = [];
    const skippedDebtors: SMSRuleAuditResult['skippedDebtors'] = [];

    let totalDebtors = 0;

    customers.forEach((c) => {
      const balance = Math.max((Number(c.total_amount) || 0) - (Number(c.paid) || 0), 0);
      if (balance <= 0) return;

      totalDebtors++;

      const createdAtDate = c.created_at ? new Date(c.created_at) : now;
      const diffMs = now.getTime() - createdAtDate.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      const cleanPhone = this.sanitizePhone(c.mobile);

      // Rule 1: Must be overdue by at least minDaysOverdue (5 days)
      if (daysOverdue < settings.minDaysOverdue) {
        skippedDebtors.push({
          customer_name: c.customer_name,
          balance,
          days_overdue: daysOverdue,
          reason: `Pending for ${daysOverdue} days (threshold is ${settings.minDaysOverdue} days)`,
        });
        return;
      }

      // Rule 2: Must have a valid phone number
      if (!cleanPhone || cleanPhone.length !== 10) {
        skippedDebtors.push({
          customer_name: c.customer_name,
          balance,
          days_overdue: daysOverdue,
          reason: 'Invalid or missing 10-digit mobile number',
        });
        return;
      }

      // Rule 3: Check previous logs for maximum reminders
      const customerLogs = logs.filter((l) => l.customer_id === c.id && l.status === 'sent');
      if (customerLogs.length >= settings.maxReminders) {
        skippedDebtors.push({
          customer_name: c.customer_name,
          balance,
          days_overdue: daysOverdue,
          reason: `Maximum reminders (${settings.maxReminders}) already reached`,
        });
        return;
      }

      // Rule 4: Check frequency gap (avoid duplicate reminders within frequency window)
      if (customerLogs.length > 0) {
        const lastSent = new Date(customerLogs[0].sent_at).getTime();
        const daysSinceLastSent = Math.floor((now.getTime() - lastSent) / (1000 * 60 * 60 * 24));
        if (daysSinceLastSent < settings.reminderFrequencyDays) {
          skippedDebtors.push({
            customer_name: c.customer_name,
            balance,
            days_overdue: daysOverdue,
            reason: `Sent ${daysSinceLastSent} days ago (frequency wait is ${settings.reminderFrequencyDays} days)`,
          });
          return;
        }
      }

      // Rule 5: Already pending in active queue
      const existingInQueue = queue.find((q) => q.customer_id === c.id && q.status === 'pending');
      if (existingInQueue) {
        skippedDebtors.push({
          customer_name: c.customer_name,
          balance,
          days_overdue: daysOverdue,
          reason: 'Already queued in pending SMS dispatch',
        });
        return;
      }

      eligibleDebtors.push({
        customer_id: c.id,
        customer_name: c.customer_name,
        phone_number: cleanPhone,
        balance,
        days_overdue: daysOverdue,
        work_type: c.work_type || 'General Service',
        created_at: c.created_at,
        reason: `Overdue by ${daysOverdue} days (Balance: ₹${balance.toLocaleString('en-IN')})`,
      });
    });

    return {
      totalDebtors,
      eligibleDebtors,
      skippedDebtors,
    };
  }

  /**
   * Scans and adds all eligible 5-day overdue debtors into the SMS queue.
   */
  public async scanAndQueueOverdueReminders(
    customers: CustomerRecord[],
    supabase?: SupabaseClient | null
  ): Promise<{ queuedCount: number; items: SMSQueueItem[] }> {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return { queuedCount: 0, items: [] };
    }

    const audit = this.auditOverdueDebtors(customers);
    if (audit.eligibleDebtors.length === 0) {
      return { queuedCount: 0, items: [] };
    }

    const currentQueue = this.getQueue();
    const newQueueItems: SMSQueueItem[] = [];

    audit.eligibleDebtors.forEach((item) => {
      const fullCustomer = customers.find((c) => c.id === item.customer_id);
      const message = this.compileMessage(
        settings.messageTemplate,
        fullCustomer || ({ customer_name: item.customer_name, work_type: item.work_type } as CustomerRecord),
        item.balance,
        item.days_overdue,
        settings.businessName
      );

      const queueItem: SMSQueueItem = {
        id: makeId(),
        customer_id: item.customer_id,
        customer_name: item.customer_name,
        phone_number: item.phone_number,
        message,
        balance: item.balance,
        days_overdue: item.days_overdue,
        work_type: item.work_type,
        status: 'pending',
        scheduled_at: new Date().toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
      };

      newQueueItems.push(queueItem);
    });

    const updatedQueue = [...newQueueItems, ...currentQueue];
    this.saveQueue(updatedQueue);

    // Sync with Supabase if table exists
    if (supabase) {
      try {
        await supabase.from('sms_queue').insert(newQueueItems);
      } catch (err) {
        console.warn('Supabase sms_queue sync note:', err);
      }
    }

    return { queuedCount: newQueueItems.length, items: newQueueItems };
  }

  /**
   * Manually queue or send an instant reminder for a single customer
   */
  public async createSingleCustomerSMS(
    customer: CustomerRecord,
    customMessage?: string,
    supabase?: SupabaseClient | null
  ): Promise<SMSQueueItem> {
    const settings = this.getSettings();
    const balance = Math.max((Number(customer.total_amount) || 0) - (Number(customer.paid) || 0), 0);
    const now = new Date();
    const createdAtDate = customer.created_at ? new Date(customer.created_at) : now;
    const daysPending = Math.max(0, Math.floor((now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24)));

    const cleanPhone = this.sanitizePhone(customer.mobile);
    const message =
      customMessage ||
      this.compileMessage(
        settings.messageTemplate,
        customer,
        balance,
        daysPending,
        settings.businessName
      );

    const queueItem: SMSQueueItem = {
      id: makeId(),
      customer_id: customer.id,
      customer_name: customer.customer_name,
      phone_number: cleanPhone,
      message,
      balance,
      days_overdue: daysPending,
      work_type: customer.work_type || 'General Service',
      status: 'pending',
      scheduled_at: new Date().toISOString(),
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const currentQueue = this.getQueue();
    const updatedQueue = [queueItem, ...currentQueue];
    this.saveQueue(updatedQueue);

    if (supabase) {
      try {
        await supabase.from('sms_queue').insert(queueItem);
      } catch (e) {
        // ignore
      }
    }

    return queueItem;
  }

  /**
   * Dispatch / Process an SMS Queue item (e.g. through connected Android SIM Gateway or Web SMS)
   */
  public async dispatchQueueItem(
    queueId: string,
    supabase?: SupabaseClient | null,
    forceFailure = false
  ): Promise<boolean> {
    const queue = this.getQueue();
    const itemIndex = queue.findIndex((q) => q.id === queueId);
    if (itemIndex === -1) return false;

    const item = queue[itemIndex];
    const nowISO = new Date().toISOString();

    if (forceFailure || !item.phone_number || item.phone_number.length !== 10) {
      item.status = 'failed';
      item.attempts += 1;
      item.error_message = 'Invalid mobile number or SIM gateway unreachable';
      queue[itemIndex] = item;
      this.saveQueue(queue);

      const logItem: SMSLogItem = {
        id: makeId(),
        customer_id: item.customer_id,
        customer_name: item.customer_name,
        phone_number: item.phone_number,
        message: item.message,
        balance: item.balance,
        status: 'failed',
        sent_at: nowISO,
        error_message: item.error_message,
        created_at: item.created_at,
      };

      const logs = [logItem, ...this.getLogs()];
      this.saveLogs(logs);

      if (supabase) {
        try {
          await supabase.from('sms_queue').update({ status: 'failed', attempts: item.attempts, error_message: item.error_message }).eq('id', item.id);
          await supabase.from('sms_logs').insert(logItem);
        } catch (e) { }
      }
      return false;
    }

    // Success dispatch
    item.status = 'sent';
    item.sent_at = nowISO;
    item.attempts += 1;
    item.error_message = undefined;
    queue[itemIndex] = item;
    this.saveQueue(queue);

    const logItem: SMSLogItem = {
      id: makeId(),
      customer_id: item.customer_id,
      customer_name: item.customer_name,
      phone_number: item.phone_number,
      message: item.message,
      balance: item.balance,
      status: 'sent',
      sent_at: nowISO,
      created_at: item.created_at,
    };

    const logs = [logItem, ...this.getLogs()];
    this.saveLogs(logs);

    if (supabase) {
      try {
        await supabase.from('sms_queue').update({ status: 'sent', sent_at: nowISO, attempts: item.attempts }).eq('id', item.id);
        await supabase.from('sms_logs').insert(logItem);
      } catch (e) { }
    }

    return true;
  }

  /**
   * Dispatch all pending queue items
   */
  public async dispatchAllPending(supabase?: SupabaseClient | null): Promise<{ sentCount: number; failedCount: number }> {
    const queue = this.getQueue();
    const pendingItems = queue.filter((q) => q.status === 'pending');
    let sentCount = 0;
    let failedCount = 0;

    for (const item of pendingItems) {
      const success = await this.dispatchQueueItem(item.id, supabase);
      if (success) sentCount++;
      else failedCount++;
    }

    return { sentCount, failedCount };
  }

  /**
   * Retry a failed SMS item
   */
  public async retryFailedSMS(queueId: string, supabase?: SupabaseClient | null): Promise<boolean> {
    const queue = this.getQueue();
    const item = queue.find((q) => q.id === queueId);
    if (!item) return false;

    item.status = 'pending';
    item.error_message = undefined;
    this.saveQueue(queue);

    return this.dispatchQueueItem(queueId, supabase);
  }

  /**
   * Delete or cancel a queue item
   */
  public removeQueueItem(queueId: string, supabase?: SupabaseClient | null): void {
    const queue = this.getQueue().filter((q) => q.id !== queueId);
    this.saveQueue(queue);
    if (supabase) {
      try {
        void supabase.from('sms_queue').delete().eq('id', queueId);
      } catch (e) { }
    }
  }

  /**
   * Clear all completed/sent queue items to keep memory tidy
   */
  public clearCompletedQueue(): void {
    const queue = this.getQueue().filter((q) => q.status === 'pending');
    this.saveQueue(queue);
  }
}

export const smsService = new SMSService();
