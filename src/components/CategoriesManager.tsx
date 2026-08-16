'use client';

// Categories manager. Rendered:
//   • as the whole /dashboard/categories page on mobile (reached from More)
//   • inline in the Settings page on desktop
// Manages the expense + income category taxonomy. Two side-by-side columns
// on desktop, stacked on mobile. Delete is guarded by a transaction-usage
// check because the FK has no ON DELETE action and a raw Postgres
// foreign-key error is not user-friendly.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

export default function CategoriesManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [expenseCats, setExpenseCats] = useState<Category[]>([]);
  const [incomeCats, setIncomeCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newExpense, setNewExpense] = useState('');
  const [newIncome, setNewIncome] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);
        const { data } = await supabase.from('categories').select('*');
        setExpenseCats((data || []).filter((c: Category) => c.type === 'expense'));
        setIncomeCats((data || []).filter((c: Category) => c.type === 'income'));
        setLoading(false);
      } catch (err) {
        console.error('Categories load failed:', err);
        setLoading(false);
      }
    })();
  }, []);

  const handleAdd = async (type: 'expense' | 'income') => {
    const name = (type === 'expense' ? newExpense : newIncome).trim();
    if (!name) return;
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ type, name, is_default: false, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      if (type === 'expense') { setExpenseCats([...expenseCats, data]); setNewExpense(''); }
      else                    { setIncomeCats([...incomeCats, data]);   setNewIncome(''); }
      logAction({
        action: 'create',
        table_name: 'categories',
        record_id: data.id,
        description: `Added ${type} category: ${name}`,
        new_values: { type, name },
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: number, type: 'expense' | 'income') => {
    const list = type === 'expense' ? expenseCats : incomeCats;
    const prev = list.find((c) => c.id === id);
    // Check for referencing transactions first — the FK has no ON DELETE
    // action so a raw error would leak Postgres jargon at the user.
    try {
      const { count, error: countErr } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);
      if (countErr) throw countErr;
      if ((count ?? 0) > 0) {
        alert(
          `Can't delete "${prev?.name}" — ${count} transaction${count === 1 ? '' : 's'} still use this category. Move them to another category first, then try again.`
        );
        return;
      }
    } catch (err: any) {
      alert(`Error checking category usage: ${err.message}`);
      return;
    }
    if (!confirm(`Delete "${prev?.name}"?`)) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      if (type === 'expense') setExpenseCats(expenseCats.filter((c) => c.id !== id));
      else                    setIncomeCats(incomeCats.filter((c) => c.id !== id));
      logAction({
        action: 'delete',
        table_name: 'categories',
        record_id: id,
        description: `Deleted ${type} category: ${prev?.name || id}`,
        old_values: prev as any,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };
  const handleUpdate = async (id: number, type: 'expense' | 'income') => {
    const name = editingName.trim();
    if (!name) return;
    const list = type === 'expense' ? expenseCats : incomeCats;
    const prev = list.find((c) => c.id === id);
    if (prev && prev.name === name) { cancelEdit(); return; }
    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const updater = (arr: Category[]) => arr.map((c) => (c.id === id ? (data as Category) : c));
      if (type === 'expense') setExpenseCats(updater(expenseCats));
      else                    setIncomeCats(updater(incomeCats));
      logAction({
        action: 'update',
        table_name: 'categories',
        record_id: id,
        description: `Renamed ${type} category: ${prev?.name || id} → ${name}`,
        old_values: prev as any,
        new_values: { name },
      });
      cancelEdit();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page identity comes from the More tab — H1 dropped for space. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(
          [
            {
              type: 'expense' as const,
              title: 'Expense categories',
              items: expenseCats,
              value: newExpense,
              setValue: setNewExpense,
            },
            {
              type: 'income' as const,
              title: 'Income categories',
              items: incomeCats,
              value: newIncome,
              setValue: setNewIncome,
            },
          ]
        ).map(({ type, title, items, value, setValue }) => (
          <div key={type} className="bg-18-surface border border-18-border rounded-2xl p-4">
            <h2 className="text-base font-bold text-white mb-3">{title}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdd(type);
              }}
              className="flex gap-2 mb-3"
            >
              <input
                type="text"
                className="form-input flex-1"
                placeholder={`New ${type} category`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button
                type="submit"
                disabled={!value.trim()}
                className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-18-orange border border-18-orange rounded-full px-3 py-1.5 hover:brightness-110 disabled:opacity-40 transition-all"
              >
                <Plus size={14} />
                Add
              </button>
            </form>
            {items.length > 0 ? (
              <ul className="divide-y divide-18-border">
                {items.map((c) => {
                  const isEditing = editingId === c.id;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            className="form-input flex-1 !py-1.5 text-sm"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')  { e.preventDefault(); handleUpdate(c.id, type); }
                              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                            }}
                            autoFocus
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleUpdate(c.id, type)}
                              disabled={!editingName.trim()}
                              className="text-xs font-semibold text-18-orange hover:text-orange-400 px-2 disabled:opacity-40"
                              title="Save"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-white/50 hover:text-white p-1"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-white min-w-0 truncate">
                            {c.name}
                            {c.is_default && (
                              <span className="ml-2 text-[10px] text-white/40 uppercase tracking-wide">
                                default
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(c)}
                              className="text-white/60 hover:text-18-orange p-1.5"
                              title="Rename category"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id, type)}
                              className="text-red-400 hover:text-red-300 p-1.5"
                              title="Delete category"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-white/50 text-center py-4 text-sm">No categories yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
