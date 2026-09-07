import { supabase } from './supabase';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'export'
  | 'deactivate'
  | 'reactivate'
  | 'mark_paid';

interface LogArgs {
  action: AuditAction;
  table_name: string;
  record_id?: number | null;
  description: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
}

// Fire-and-forget so callers aren't blocked. Errors go to console only —
// we don't want a broken log to break an actual save.
export const logAction = async (args: LogArgs) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('audit_log').insert({
      user_id: user?.id ?? null,
      action: args.action,
      table_name: args.table_name,
      record_id: args.record_id ?? null,
      description: args.description,
      old_values: args.old_values ?? null,
      new_values: args.new_values ?? null,
    });
    if (error) console.error('audit log failed:', error.message);
  } catch (err) {
    console.error('audit log threw:', err);
  }
};
