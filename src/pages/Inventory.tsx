import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Minus, Truck, Tag, Edit2, Trash2, RotateCcw, Check, X, Search, AlertCircle } from 'lucide-react';
import { get, post, put, del } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal, Field, Empty, LoadError, SkeletonRows, SectionHead, Meter, AlertBanner } from '../components/ui';
import { INITIAL_INVENTORY_CATEGORIES, CATEGORY_COLOR_MAP, type InventoryCategory } from '../lib/inventoryCategories';

export default function Inventory() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>(INITIAL_INVENTORY_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  // Modals state
  const [showNew, setShowNew] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<any | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);

  // Forms state
  const [form, setForm] = useState({
    item_name: '',
    category: 'Consumables',
    stock_quantity: '',
    reorder_level: '20',
    unit: 'pcs',
    supplier: '',
    expiry_date: ''
  });

  const [editForm, setEditForm] = useState({
    id: 0,
    item_name: '',
    category: 'Consumables',
    stock_quantity: '',
    reorder_level: '20',
    unit: 'pcs',
    supplier: '',
    expiry_date: ''
  });

  // Category management form states
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<InventoryCategory | null>(null);

  // Inline category quick add state in Add/Edit item modal
  const [inlineCatMode, setInlineCatMode] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');

  const canManage = ['Admin', 'Pharmacist', 'Accountant'].includes(user?.role || '');
  const isAdmin = user?.role === 'Admin';

  const loadData = async () => {
    setLoading(true);
    setErr('');
    try {
      const [invData, catData] = await Promise.all([
        get('/api/inventory'),
        get('/api/inventory-categories').catch(() => INITIAL_INVENTORY_CATEGORIES)
      ]);
      setRows(Array.isArray(invData) ? invData : []);
      if (Array.isArray(catData) && catData.length > 0) {
        setCategories(catData);
      }
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const low = rows.filter((r) => Number(r.stock_quantity) <= Number(r.reorder_level));

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!cat || r.category === cat) &&
          (!q.trim() || r.item_name.toLowerCase().includes(q.trim().toLowerCase()) || (r.supplier && r.supplier.toLowerCase().includes(q.trim().toLowerCase())))
      ),
    [rows, cat, q]
  );

  // Calculate dynamic item counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (r.category) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
    }
    return counts;
  }, [rows]);

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const term = catSearch.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.description && c.description.toLowerCase().includes(term))
    );
  }, [categories, catSearch]);

  /* ---------------- Stock Adjustment ---------------- */
  const adjust = async (r: any, delta: number) => {
    try {
      const newQty = Math.max(0, Number(r.stock_quantity) + delta);
      await put('/api/inventory', { id: r.id, stock_quantity: newQty });
      toast({ kind: 'success', title: delta > 0 ? 'Stock received (+25)' : 'Stock issued (-5)', desc: `${r.item_name} now: ${newQty} ${r.unit || ''}` });
      loadData();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to adjust stock', desc: e.message });
    }
  };

  /* ---------------- Add Item ---------------- */
  const addItem = async () => {
    if (!form.item_name.trim()) return toast({ kind: 'error', title: 'Item name is required' });
    try {
      await post('/api/inventory', {
        ...form,
        stock_quantity: Number(form.stock_quantity) || 0,
        reorder_level: Number(form.reorder_level) || 0,
        expiry_date: form.expiry_date || null
      });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Added inventory item ${form.item_name} (${form.category})`,
        module: 'Inventory'
      });
      toast({ kind: 'success', title: 'Item added to inventory', desc: form.item_name });
      setShowNew(false);
      setForm({ item_name: '', category: categories[0]?.name || 'Consumables', stock_quantity: '', reorder_level: '20', unit: 'pcs', supplier: '', expiry_date: '' });
      loadData();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to add item', desc: e.message });
    }
  };

  /* ---------------- Edit Item ---------------- */
  const startEditItem = (r: any) => {
    setEditItem(r);
    setEditForm({
      id: r.id,
      item_name: r.item_name || '',
      category: r.category || categories[0]?.name || 'Consumables',
      stock_quantity: String(r.stock_quantity ?? ''),
      reorder_level: String(r.reorder_level ?? '20'),
      unit: r.unit || 'pcs',
      supplier: r.supplier || '',
      expiry_date: r.expiry_date ? String(r.expiry_date).slice(0, 10) : ''
    });
  };

  const saveEditItem = async () => {
    if (!editForm.item_name.trim()) return toast({ kind: 'error', title: 'Item name is required' });
    try {
      await put('/api/inventory', {
        id: editForm.id,
        item_name: editForm.item_name.trim(),
        category: editForm.category,
        stock_quantity: Number(editForm.stock_quantity) || 0,
        reorder_level: Number(editForm.reorder_level) || 0,
        unit: editForm.unit,
        supplier: editForm.supplier.trim() || null,
        expiry_date: editForm.expiry_date || null
      });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Updated inventory item ${editForm.item_name}`,
        module: 'Inventory'
      });
      toast({ kind: 'success', title: 'Item updated successfully', desc: editForm.item_name });
      setEditItem(null);
      loadData();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update item', desc: e.message });
    }
  };

  /* ---------------- Delete Item ---------------- */
  const deleteItem = async () => {
    if (!deleteItemConfirm) return;
    try {
      await del('/api/inventory', { id: deleteItemConfirm.id });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Deleted inventory item ${deleteItemConfirm.item_name}`,
        module: 'Inventory'
      });
      toast({ kind: 'success', title: 'Item deleted', desc: deleteItemConfirm.item_name });
      setDeleteItemConfirm(null);
      loadData();
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to delete item', desc: e.message });
    }
  };

  /* ---------------- Category Management Handlers ---------------- */
  const addCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return toast({ kind: 'error', title: 'Category name is required' });
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return toast({ kind: 'error', title: 'Category already exists', desc: `A category named "${trimmed}" already exists.` });
    }

    try {
      const res = await post('/api/inventory-categories', {
        name: trimmed,
        description: newCatDesc.trim()
      });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Created inventory category "${trimmed}"`,
        module: 'Inventory'
      });
      toast({ kind: 'success', title: 'Category added', desc: trimmed });
      setNewCatName('');
      setNewCatDesc('');
      if (res && res.id) {
        setCategories((prev) => [...prev, res]);
      } else {
        const catRes = await get('/api/inventory-categories');
        if (Array.isArray(catRes)) setCategories(catRes);
      }
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to add category', desc: e.message });
    }
  };

  const startEditCat = (catObj: InventoryCategory) => {
    setEditingCatId(catObj.id || catObj.name);
    setEditCatName(catObj.name);
    setEditCatDesc(catObj.description || '');
  };

  const cancelEditCat = () => {
    setEditingCatId(null);
    setEditCatName('');
    setEditCatDesc('');
  };

  const saveEditCat = async (origCat: InventoryCategory) => {
    const trimmed = editCatName.trim();
    if (!trimmed) return toast({ kind: 'error', title: 'Category name cannot be empty' });

    try {
      await put('/api/inventory-categories', {
        id: origCat.id,
        name: trimmed,
        old_name: origCat.name,
        description: editCatDesc.trim()
      });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Renamed inventory category "${origCat.name}" to "${trimmed}"`,
        module: 'Inventory'
      });
      toast({ kind: 'success', title: 'Category updated', desc: trimmed });
      setEditingCatId(null);

      // Refresh both categories and inventory items to reflect cascaded rename
      const [newCats, newItems] = await Promise.all([
        get('/api/inventory-categories'),
        get('/api/inventory')
      ]);
      if (Array.isArray(newCats)) setCategories(newCats);
      if (Array.isArray(newItems)) setRows(newItems);
      if (cat === origCat.name) setCat(trimmed);
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to update category', desc: e.message });
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCatConfirm) return;
    try {
      await del('/api/inventory-categories', {
        id: deleteCatConfirm.id,
        name: deleteCatConfirm.name,
        reassignTo: 'General'
      });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: `Deleted inventory category "${deleteCatConfirm.name}" (reassigned items to General)`,
        module: 'Inventory'
      });
      toast({ kind: 'success', title: 'Category deleted', desc: `${deleteCatConfirm.name} removed. Items reassigned to General.` });
      const delName = deleteCatConfirm.name;
      setDeleteCatConfirm(null);

      // Refresh categories & items
      const [newCats, newItems] = await Promise.all([
        get('/api/inventory-categories'),
        get('/api/inventory')
      ]);
      if (Array.isArray(newCats)) setCategories(newCats);
      if (Array.isArray(newItems)) setRows(newItems);
      if (cat === delName) setCat('');
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to delete category', desc: e.message });
    }
  };

  const resetToDefaultCategories = async () => {
    if (!window.confirm('Reset categories to the 15 standard hospital categories? Custom categories will be replaced.')) return;
    try {
      const res = await post('/api/inventory-categories', { reset: true });
      await post('/api/audit', {
        user_name: user!.name,
        user_role: user!.role,
        action: 'Reset inventory categories to standard hospital defaults',
        module: 'Inventory'
      });
      toast({ kind: 'success', title: 'Categories reset to standard hospital defaults' });
      if (Array.isArray(res)) setCategories(res);
      else {
        const catRes = await get('/api/inventory-categories');
        if (Array.isArray(catRes)) setCategories(catRes);
      }
    } catch (e: any) {
      toast({ kind: 'error', title: 'Failed to reset categories', desc: e.message });
    }
  };

  /* ---------------- Inline Quick Category Add ---------------- */
  const handleQuickAddCat = async (forTarget: 'add' | 'edit') => {
    const trimmed = inlineCatName.trim();
    if (!trimmed) return;
    try {
      const res = await post('/api/inventory-categories', { name: trimmed, description: '' });
      toast({ kind: 'success', title: 'Category created', desc: trimmed });
      const newCatObj = res && res.name ? res : { name: trimmed };
      setCategories((prev) => [...prev, newCatObj]);
      if (forTarget === 'add') setForm((f) => ({ ...f, category: trimmed }));
      else setEditForm((f) => ({ ...f, category: trimmed }));
      setInlineCatMode(false);
      setInlineCatName('');
    } catch (e: any) {
      toast({ kind: 'error', title: 'Could not create category', desc: e.message });
    }
  };

  return (
    <div>
      <SectionHead
        title="Inventory"
        desc={`${rows.length} items tracked · ${low.length} below reorder level · ${categories.length} categories`}
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                className="btn btn-secondary btn-sm flex items-center gap-1.5"
                onClick={() => setShowCatModal(true)}
                title="Manage inventory categories"
              >
                <Tag size={14} className="text-teal-600 dark:text-teal-400" />
                <span>Categories ({categories.length})</span>
              </button>
            )}
            {canManage && (
              <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => setShowNew(true)}>
                <Plus size={15} />
                <span>Add item</span>
              </button>
            )}
          </div>
        }
      />

      {low.length > 0 && (
        <div className="mb-4">
          <AlertBanner
            level="warning"
            text={`${low.length} item${low.length > 1 ? 's' : ''} need reordering — raise purchase orders with suppliers before stock runs out.`}
          />
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <input
            className="input w-full pl-9"
            placeholder="Search items, supplier..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100 p-1"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <select className="input sm:w-64" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All Categories ({rows.length})</option>
          {categories.map((c) => {
            const count = categoryCounts[c.name] || 0;
            return (
              <option key={c.name} value={c.name}>
                {c.name} {count > 0 ? `(${count})` : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Category Pills Quick Select */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-2 no-scrollbar text-xs">
          <button
            onClick={() => setCat('')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition ${
              cat === ''
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            All ({rows.length})
          </button>
          {categories.map((c) => {
            const count = categoryCounts[c.name] || 0;
            const isSelected = cat === c.name;
            return (
              <button
                key={c.name}
                onClick={() => setCat(isSelected ? '' : c.name)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
                title={c.description || c.name}
              >
                <span>{c.name}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Table & Content */}
      {loading ? (
        <div className="card p-4">
          <SkeletonRows rows={8} />
        </div>
      ) : err ? (
        <div className="card">
          <LoadError message={err} onRetry={loadData} />
        </div>
      ) : shown.length === 0 ? (
        <div className="card">
          <Empty
            title={q || cat ? 'No items match your filter' : 'No inventory items found'}
            desc={
              q || cat
                ? `No items found under "${cat || 'All'}" matching "${q}". Try clearing filters.`
                : 'Get started by adding medical supplies, pharmaceuticals, surgical gear, or equipment.'
            }
            action={
              q || cat ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setQ('');
                    setCat('');
                  }}
                >
                  Clear filters
                </button>
              ) : canManage ? (
                <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                  <Plus size={15} /> Add first item
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Level</th>
                <th>Supplier</th>
                <th>Expiry</th>
                {canManage && <th className="!text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const isLow = Number(r.stock_quantity) <= Number(r.reorder_level);
                const badgeColor = CATEGORY_COLOR_MAP[r.category] || 'b-slate';
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Package size={15} className="opacity-50 shrink-0" />
                        <div>
                          <span className="font-semibold">{r.item_name}</span>
                          {isLow && <span className="ml-2 badge b-amber text-[10px] py-0.5">Reorder</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${badgeColor}`}>{r.category || 'General'}</span>
                    </td>
                    <td className="font-bold">
                      {r.stock_quantity}{' '}
                      <span className="font-normal opacity-50 text-xs">
                        {r.unit} / min {r.reorder_level}
                      </span>
                    </td>
                    <td className="w-36">
                      <Meter
                        value={Number(r.stock_quantity)}
                        max={Math.max(Number(r.reorder_level) * 3, 10)}
                        color={isLow ? '#d99a0b' : '#0d9488'}
                      />
                    </td>
                    <td className="text-[13px]">{r.supplier || '—'}</td>
                    <td className="text-[13px]">
                      {r.expiry_date
                        ? new Date(r.expiry_date).toLocaleDateString('en-IN', {
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—'}
                    </td>
                    {canManage && (
                      <td className="!text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            className="btn btn-ghost btn-sm !px-1.5"
                            onClick={() => adjust(r, -5)}
                            title="Issue 5 items"
                            aria-label="Issue 5"
                          >
                            <Minus size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm !px-1.5"
                            onClick={() => adjust(r, 25)}
                            title="Receive 25 items"
                            aria-label="Receive 25"
                          >
                            <Truck size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm !px-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            onClick={() => startEditItem(r)}
                            title="Edit item details"
                            aria-label="Edit item"
                          >
                            <Edit2 size={13} />
                          </button>
                          {isAdmin && (
                            <button
                              className="btn btn-ghost btn-sm !px-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => setDeleteItemConfirm(r)}
                              title="Delete item"
                              aria-label="Delete item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================== */}
      {/* ADD ITEM MODAL */}
      {/* ============================================================== */}
      {showNew && (
        <Modal title="Add inventory item" onClose={() => setShowNew(false)}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Item name" required>
                <input
                  className="input"
                  value={form.item_name}
                  onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                  placeholder="e.g. Sterile latex surgical gloves (Box of 100)"
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="block text-[13px] font-semibold">Category *</span>
                {isAdmin && !inlineCatMode && (
                  <button
                    type="button"
                    onClick={() => setInlineCatMode(true)}
                    className="text-xs text-teal-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Plus size={12} /> New category
                  </button>
                )}
              </div>

              {inlineCatMode ? (
                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border hairline">
                  <input
                    className="input flex-1 text-sm py-1.5"
                    placeholder="Enter new category name..."
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm !py-1.5"
                    onClick={() => handleQuickAddCat('add')}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm !py-1.5"
                    onClick={() => {
                      setInlineCatMode(false);
                      setInlineCatName('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  className="input w-full"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} {c.description ? `— ${c.description.slice(0, 45)}...` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Field label="Unit">
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option>pcs</option>
                <option>boxes</option>
                <option>bottles</option>
                <option>vials</option>
                <option>ampoules</option>
                <option>rolls</option>
                <option>kits</option>
                <option>packs</option>
                <option>cylinders</option>
              </select>
            </Field>

            <Field label="Opening stock">
              <input
                type="number"
                min="0"
                className="input"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                placeholder="0"
              />
            </Field>

            <Field label="Reorder level (Min stock alert)">
              <input
                type="number"
                min="0"
                className="input"
                value={form.reorder_level}
                onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                placeholder="20"
              />
            </Field>

            <Field label="Supplier / Vendor">
              <input
                className="input"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="e.g. MedPlus Logistics"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Expiry date">
                <input
                  type="date"
                  className="input"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={addItem}>
              Add item
            </button>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* EDIT ITEM MODAL */}
      {/* ============================================================== */}
      {editItem && (
        <Modal title="Edit inventory item" subtitle={`ID #${editItem.id}`} onClose={() => setEditItem(null)}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Item name" required>
                <input
                  className="input"
                  value={editForm.item_name}
                  onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="block text-[13px] font-semibold">Category *</span>
                {isAdmin && !inlineCatMode && (
                  <button
                    type="button"
                    onClick={() => setInlineCatMode(true)}
                    className="text-xs text-teal-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Plus size={12} /> New category
                  </button>
                )}
              </div>

              {inlineCatMode ? (
                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border hairline">
                  <input
                    className="input flex-1 text-sm py-1.5"
                    placeholder="Enter new category name..."
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm !py-1.5"
                    onClick={() => handleQuickAddCat('edit')}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm !py-1.5"
                    onClick={() => {
                      setInlineCatMode(false);
                      setInlineCatName('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  className="input w-full"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} {c.description ? `— ${c.description.slice(0, 45)}...` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Field label="Unit">
              <select
                className="input"
                value={editForm.unit}
                onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
              >
                <option>pcs</option>
                <option>boxes</option>
                <option>bottles</option>
                <option>vials</option>
                <option>ampoules</option>
                <option>rolls</option>
                <option>kits</option>
                <option>packs</option>
                <option>cylinders</option>
              </select>
            </Field>

            <Field label="Stock quantity">
              <input
                type="number"
                min="0"
                className="input"
                value={editForm.stock_quantity}
                onChange={(e) => setEditForm({ ...editForm, stock_quantity: e.target.value })}
              />
            </Field>

            <Field label="Reorder level">
              <input
                type="number"
                min="0"
                className="input"
                value={editForm.reorder_level}
                onChange={(e) => setEditForm({ ...editForm, reorder_level: e.target.value })}
              />
            </Field>

            <Field label="Supplier / Vendor">
              <input
                className="input"
                value={editForm.supplier}
                onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Expiry date">
                <input
                  type="date"
                  className="input"
                  value={editForm.expiry_date}
                  onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setEditItem(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveEditItem}>
              Save changes
            </button>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* DELETE ITEM CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {deleteItemConfirm && (
        <Modal title="Delete inventory item" onClose={() => setDeleteItemConfirm(null)}>
          <div className="py-2">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to delete <strong className="font-semibold">{deleteItemConfirm.item_name}</strong> ({deleteItemConfirm.category})?
            </p>
            <p className="text-xs text-red-500 mt-2">
              This action will remove the item and its current stock history ({deleteItemConfirm.stock_quantity} {deleteItemConfirm.unit}).
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setDeleteItemConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={deleteItem}>
              Delete item
            </button>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* CATEGORY MANAGEMENT MODAL (ADMIN) */}
      {/* ============================================================== */}
      {showCatModal && (
        <Modal
          title="Inventory Categories"
          subtitle={`Admin Category Manager · ${categories.length} categories active`}
          wide
          onClose={() => {
            setShowCatModal(false);
            cancelEditCat();
          }}
        >
          <div className="space-y-5">
            {/* Add New Category Box */}
            <div className="card p-4 bg-slate-50/70 dark:bg-slate-800/40 border hairline">
              <div className="text-sm font-semibold mb-2.5 flex items-center gap-1.5">
                <Plus size={16} className="text-teal-600" />
                <span>Add new inventory category</span>
              </div>
              <div className="grid sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-4">
                  <input
                    className="input w-full text-sm"
                    placeholder="Category name (e.g. Orthotics)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  />
                </div>
                <div className="sm:col-span-6">
                  <input
                    className="input w-full text-sm"
                    placeholder="Description / hint (e.g. Braces, splints, supports)"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    className="btn btn-primary btn-sm w-full h-[38px] justify-center"
                    onClick={addCategory}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Search and Table */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <input
                  className="input w-full text-xs pl-8 py-1.5"
                  placeholder="Filter categories..."
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                />
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
              </div>

              <button
                type="button"
                onClick={resetToDefaultCategories}
                className="btn btn-ghost btn-sm text-xs flex items-center gap-1.5 opacity-70 hover:opacity-100"
                title="Reset to 15 standard hospital categories"
              >
                <RotateCcw size={12} />
                <span>Restore standard 15</span>
              </button>
            </div>

            {/* Categories List Table */}
            <div className="border hairline rounded-lg overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="grid-table text-sm">
                <thead>
                  <tr>
                    <th className="w-1/3">Category Name</th>
                    <th>Description</th>
                    <th className="w-20 text-center">Items</th>
                    <th className="w-24 !text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((c) => {
                    const isEditing = editingCatId === c.id || editingCatId === c.name;
                    const count = categoryCounts[c.name] || 0;
                    const badgeColor = CATEGORY_COLOR_MAP[c.name] || 'b-slate';

                    if (isEditing) {
                      return (
                        <tr key={c.id || c.name} className="bg-teal-50/40 dark:bg-teal-950/20">
                          <td>
                            <input
                              className="input text-xs w-full py-1"
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              autoFocus
                            />
                          </td>
                          <td>
                            <input
                              className="input text-xs w-full py-1"
                              value={editCatDesc}
                              onChange={(e) => setEditCatDesc(e.target.value)}
                              placeholder="Description..."
                            />
                          </td>
                          <td className="text-center font-bold text-xs">{count}</td>
                          <td className="!text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                className="btn btn-primary btn-sm !px-2 !py-1"
                                onClick={() => saveEditCat(c)}
                                title="Save category"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm !px-2 !py-1"
                                onClick={cancelEditCat}
                                title="Cancel edit"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={c.id || c.name}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${badgeColor} font-semibold text-xs`}>{c.name}</span>
                          </div>
                        </td>
                        <td className="text-xs opacity-75">
                          {c.description || <span className="opacity-40 italic">No description</span>}
                        </td>
                        <td className="text-center">
                          <span
                            className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                              count > 0
                                ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {count}
                          </span>
                        </td>
                        <td className="!text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              className="btn btn-ghost btn-sm !px-2 !py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              onClick={() => startEditCat(c)}
                              title={`Edit ${c.name}`}
                              aria-label="Edit category"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm !px-2 !py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => setDeleteCatConfirm(c)}
                              title={`Delete ${c.name}`}
                              aria-label="Delete category"
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
            </div>

            <div className="flex justify-between items-center text-xs opacity-60 pt-2 border-t hairline">
              <span>* Renaming a category automatically updates all associated inventory items.</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCatModal(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* DELETE CATEGORY CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {deleteCatConfirm && (
        <Modal title="Delete category" onClose={() => setDeleteCatConfirm(null)}>
          <div className="py-2 space-y-3">
            <p className="text-sm">
              Are you sure you want to delete category{' '}
              <strong className="font-semibold text-red-600">"{deleteCatConfirm.name}"</strong>?
            </p>

            {(categoryCounts[deleteCatConfirm.name] || 0) > 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  <AlertCircle size={14} />
                  <span>{categoryCounts[deleteCatConfirm.name]} item(s) currently in this category</span>
                </div>
                Deleting this category will automatically reassign those items to the <strong>General</strong> category so no inventory stock is lost.
              </div>
            ) : (
              <p className="text-xs opacity-65">
                No inventory items are currently in this category. It can be safely deleted.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn btn-ghost" onClick={() => setDeleteCatConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDeleteCategory}>
              Confirm Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
