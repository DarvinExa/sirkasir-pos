import { rupiah, formatDateTime } from '../lib/format';

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-sm font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default function Receipt({ tx, settings }) {
  if (!tx) return null;
  const dash = <div className="my-2 border-t border-dashed border-black" />;
  return (
    <div id="receipt-print" className="mx-auto w-[280px] bg-white p-4 text-[12px] leading-tight text-black">
      <div className="text-center">
        <div className="text-base font-bold">{settings?.store_name || 'Sirkasir'}</div>
        {settings?.address && <div>{settings.address}</div>}
        {settings?.phone && <div>{settings.phone}</div>}
      </div>
      {dash}
      <div className="flex justify-between">
        <span>{tx.invoice_no}</span>
        <span>{tx.cashier_name}</span>
      </div>
      <div>{formatDateTime(tx.created_at)}</div>
      {tx.table_name && <div>Meja: {tx.table_name}</div>}
      {tx.customer_name && <div>Pelanggan: {tx.customer_name}</div>}
      {dash}
      {tx.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div>{it.name}</div>
          {it.modifiers?.length > 0 && (
            <div className="pl-2 text-[11px]">{it.modifiers.map((m) => m.name).join(', ')}</div>
          )}
          <div className="flex justify-between">
            <span>
              {it.qty} x {rupiah(it.price)}
            </span>
            <span className="tabular-nums">{rupiah(it.price * it.qty)}</span>
          </div>
          {it.discount > 0 && (
            <div className="flex justify-between">
              <span>&nbsp;&nbsp;Diskon item</span>
              <span>-{rupiah(it.discount)}</span>
            </div>
          )}
          {it.notes && <div className="italic">* {it.notes}</div>}
        </div>
      ))}
      {dash}
      <Row label="Subtotal" value={rupiah(tx.subtotal)} />
      {tx.discount > 0 && <Row label="Diskon" value={'-' + rupiah(tx.discount)} />}
      {tx.promo_discount > 0 && <Row label="Promo" value={'-' + rupiah(tx.promo_discount)} />}
      {tx.loyalty?.redeem_value > 0 && (
        <Row label={`Tukar ${tx.loyalty.redeemed_points} poin`} value={'-' + rupiah(tx.loyalty.redeem_value)} />
      )}
      {tx.tax > 0 && <Row label="Pajak" value={rupiah(tx.tax)} />}
      {tx.service_charge > 0 && <Row label="Servis" value={rupiah(tx.service_charge)} />}
      <Row label="TOTAL" value={rupiah(tx.total)} bold />
      {dash}
      {tx.payments.map((p, i) => (
        <Row key={i} label={p.method.toUpperCase()} value={rupiah(p.amount)} />
      ))}
      <Row label="Kembali" value={rupiah(tx.change)} />
      {tx.loyalty?.customer_id && (
        <>
          {dash}
          <div className="text-center">Member: {tx.loyalty.customer_name || tx.customer_name}</div>
          <div className="text-center">
            Poin didapat: +{tx.loyalty.earned_points} · Saldo: {tx.loyalty.points_after}
          </div>
        </>
      )}
      {dash}
      <div className="text-center">{settings?.footer_note || 'Terima kasih'}</div>
    </div>
  );
}
