import { formatRate } from "@/lib/crm/money";
import { RateForm, type RateInfo } from "./rate-form";
import { Card, CardHeader } from "./ui";

/**
 * Today's BCV rate, for the members who take payments. Inicio and Agenda
 * show the same card: it fetches the rate from the BCV or takes it by hand.
 */
export function TodayRateCard({
  today,
  rate,
  recentRates,
}: {
  today: string;
  rate: RateInfo | null;
  /** The latest rates (getRecentRates): the one before today is the hint. */
  recentRates: { rate_date: string; bs_per_usd: number }[];
}) {
  return (
    <Card>
      <CardHeader
        title="Tasa BCV de hoy"
        hint={rate ? `Bs. ${formatRate(rate.bs_per_usd)} por dólar` : "Sin cargar: hace falta para cobrar"}
      />
      <div className="px-5 py-4">
        <RateForm
          day={today}
          current={rate}
          suggestion={recentRates.find((r) => r.rate_date !== today)?.bs_per_usd ?? null}
          hasPayments
          canFetch
        />
      </div>
    </Card>
  );
}
