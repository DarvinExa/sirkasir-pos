import { useState, useEffect } from 'react';
import { X, Banknote, QrCode, Check, Star, TicketPercent } from 'lucide-react';
import { rupiah } from '../lib/format';
import { api } from '../api/client';
import CustomerPicker from './CustomerPicker';

export default function CheckoutModal({ total, items, onClose, onConfirm, loading, loyalty }) {
  const [method, setMethod] = useState('cash');
  const [cash, setCash] = useState(0);
  const [customer, setCustomer] = useState(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [voucher, setVoucher] = useState('');
  const [promoInfo, setPromoInfo] = useState({ applied: [], totalDiscount: 0 });

  const cfg = loyalty || {};
  const loyaltyOn = cfg.enabled !== false && !!Number(cfg.point_value);
  const pointValue = Number(cfg.point_value) || 100;
  const earnPer = Number(cfg.earn_per) || 1000;

  const rawSubtotal = (items || []).reduce((s, it) => s + it.price * it.qty, 0) || total;

  useEffect(() => {
    let alive = true;
    api
      .post('/promos/evaluate', {
        items: items || [],
        subtotal: rawSubtotal,
        customer_id: customer ? customer.id : null,
        code: voucher,
      })
      .then((res) => {
        if (alive) setPromoInfo(res.data);
      })
      .catch(() => {
        if (alive) setPromoInfo({ applied: [], totalDiscount: 0 });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, customer, voucher]);

  const promoDiscount = Math.min(promoInfo.totalDiscount || 0, total);
  const baseAfterPromo = Math.max(0, total - promoDiscount);
  const maxRedeem = Math.min(
    customer ? customer.points || 0 : 0,
    Math.floor(baseAfterPromo / pointValue)
  );
  const redeemPts = Math.max(0, Math.min(parseInt(redeemInput, 10) || 0, maxRedeem));
  const redeemValue = redeemPts * pointValue;
  const netTotal = Math.max(0, baseAfterPromo - redeemValue);
  const earnPreview = loyaltyOn && customer ? Math.floor(netTotal / earnPer) : 0;

  const denoms = [netTotal, 20000, 50000, 100000, 150000, 200000];
  const quick = [...new Set(denoms.filter((v) => v > 0))].sort((a, b) => a - b);
  const change = Math.max(0, cash - netTotal);
  const canPay = method === 'qris' || cash >= netTotal;

  function confirm() {
    if (!canPay) return;
    onConfirm({
      method,
      amount: method === 'qris' ? netTotal : cash,
      customer_id: customer ? customer.id : null,
      redeem_points: redeemPts,
      promo_code: voucher,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-3xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold">Pembayaran</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loyaltyOn && (
            <div className="mb-4">
              <CustomerPicker
                selected={customer}
                onSelect={(c) => {
                  setCustomer(c);
                  setRedeemInput('');
                }}
              />
              {customer && customer.points > 0 && (
                <div className="mt-2 rounded-xl border border-slate-200 p-3">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Star size={14} className="fill-amber-400 text-amber-400" /> Tukar poin
                    </span>
                    <span className="text-xs text-slate-400">maks {maxRedeem} poin</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={redeemInput}
                      onChange={(e) => setRedeemInput(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-brand"
                    />
                    <button
                      onClick={() => setRedeemInput(String(maxRedeem))}
                      className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Pakai semua
                    </button>
                  </div>
                  {redeemPts > 0 && (
                    <div className="mt-1 text-right text-xs text-emerald-600">
                      Potongan {rupiah(redeemValue)} ({redeemPts} poin)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600">
              <TicketPercent size={15} /> Kode voucher (opsional)
            </label>
            <input
              value={voucher}
              onChange={(e) => setVoucher(e.target.value.toUpperCase())}
              placeholder="mis. HEMAT15"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 uppercase outline-none focus:border-brand"
            />
            {promoInfo.applied.length > 0 && (
              <div className="mt-2 space-y-1">
                {promoInfo.applied.map((p) => (
                  <div key={p.id} className="flex justify-between rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                    <span>{p.name}</span>
                    <span className="tabular-nums">-{rupiah(p.discount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4 rounded-2xl bg-brand-50 p-4 text-center">
            <div className="text-sm text-brand-700">Total Tagihan</div>
            <div className="text-3xl font-bold text-brand-600 tabular-nums">{rupiah(netTotal)}</div>
            {(redeemValue > 0 || promoDiscount > 0) && (
              <div className="mt-1 text-xs text-slate-500 line-through tabular-nums">{rupiah(total)}</div>
            )}
            {earnPreview > 0 && (
              <div className="mt-1 text-xs text-brand-700">+{earnPreview} poin untuk {customer.name}</div>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMethod('cash')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3 font-medium ${
                method === 'cash' ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-200'
              }`}
            >
              <Banknote size={18} /> Tunai
            </button>
            <button
              onClick={() => setMethod('qris')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3 font-medium ${
                method === 'qris' ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-200'
              }`}
            >
              <QrCode size={18} /> QRIS
            </button>
          </div>

          {method === 'cash' ? (
            <div>
              <input
                type="number"
                value={cash || ''}
                onChange={(e) => setCash(Number(e.target.value))}
                placeholder="Uang diterima"
                className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg tabular-nums outline-none focus:border-brand"
              />
              <div className="mb-4 grid grid-cols-3 gap-2">
                {quick.map((v) => (
                  <button
                    key={v}
                    onClick={() => setCash(v)}
                    className="rounded-xl bg-slate-100 py-2 text-sm font-medium hover:bg-slate-200 tabular-nums"
                  >
                    {v === netTotal ? 'Uang Pas' : rupiah(v)}
                  </button>
                ))}
              </div>
              <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-slate-500">Kembalian</span>
                <span className="font-bold tabular-nums">{rupiah(change)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 p-6">
              <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-slate-100">
                <QrCode size={96} className="text-slate-700" />
              </div>
              <p className="mt-3 text-center text-sm text-slate-500">
                Pelanggan scan QRIS lalu tekan <b>Konfirmasi Lunas</b>.
                <br />
                (Simulasi pembayaran QRIS)
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-5">
          <button
            onClick={confirm}
            disabled={!canPay || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            <Check size={18} />
            {loading ? 'Memproses...' : method === 'qris' ? 'Konfirmasi Lunas' : 'Bayar & Cetak Struk'}
          </button>
        </div>
      </div>
    </div>
  );
}
