'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';
import { logAction } from '@/lib/auditLog';
import { Plus, X } from 'lucide-react';

interface Props {
  type: 'expense' | 'income';
  categories: Category[];
  value: number;
  onChange: (id: number) => void;
  onCategoryCreated: (c: Category) => void;
  currentUserId?: string | null;
}

export default function CategorySelect({
  type,
  categories,
  value,
  onChange,
  onCategoryCreated,
  currentUserId,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ type, name, is_default: false, created_by: currentUserId ?? null })
        .select()
        .single();
      if (error) throw error;
      logAction({
        action: 'create',
        table_name: 'categories',
        record_id: data.id,
        description: `Added ${type} category: ${name} (from ${type} form)`,
        new_values: { type, name },
      });
      onCategoryCreated(data);
      onChange(data.id);
      setNewName('');
      setAdding(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          className="form-input flex-1"
          placeholder={`New ${type} category`}
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || !newName.trim()}
          className="btn btn-primary"
        >
          {saving ? 'Adding…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setNewName('');
          }}
          className="btn btn-secondary"
          title="Cancel"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        className="form-select flex-1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        required
      >
        <option value="">Select Category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="btn btn-outline"
        title="Add new category"
      >
        <Plus size={16} />
        New
      </button>
    </div>
  );
}
