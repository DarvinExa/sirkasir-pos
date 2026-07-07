import { create } from 'zustand';

export const useCart = create((set, get) => ({
  items: [], // { menu_item_id, name, price, qty, notes, discount }
  discount: 0,
  customerName: '',

  add: (menu) =>
    set((s) => {
      const idx = s.items.findIndex((i) => i.menu_item_id === menu.id && !i.notes);
      if (idx !== -1) {
        const items = s.items.slice();
        items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
        return { items };
      }
      return {
        items: [
          ...s.items,
          { menu_item_id: menu.id, name: menu.name, price: menu.price, qty: 1, notes: '', discount: 0 },
        ],
      };
    }),

  inc: (idx) =>
    set((s) => ({ items: s.items.map((i, x) => (x === idx ? { ...i, qty: i.qty + 1 } : i)) })),

  dec: (idx) =>
    set((s) => ({
      items: s.items.flatMap((i, x) =>
        x === idx ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]
      ),
    })),

  setNotes: (idx, notes) =>
    set((s) => ({ items: s.items.map((i, x) => (x === idx ? { ...i, notes } : i)) })),

  remove: (idx) => set((s) => ({ items: s.items.filter((_, x) => x !== idx) })),

  setDiscount: (v) => set({ discount: Math.max(0, Number(v) || 0) }),
  setCustomer: (v) => set({ customerName: v }),
  clear: () => set({ items: [], discount: 0, customerName: '' }),

  count: () => get().items.reduce((s, i) => s + i.qty, 0),
  subtotal: () => get().items.reduce((s, i) => s + i.price * i.qty - (i.discount || 0), 0),
}));
