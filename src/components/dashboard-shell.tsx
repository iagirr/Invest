"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  CircleAlert,
  Download,
  Gauge,
  HardDriveDownload,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";

import { DashboardCharts } from "@/components/dashboard-charts";
import type { DashboardData } from "@/lib/portfolio";

type Props = {
  initialData: DashboardData;
};

type AssetSearchResult = {
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "fund";
  exchange: string;
};

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return formatter.format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toInputDate() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardShell({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [trackingForm, setTrackingForm] = useState({
    symbol: "",
    name: "",
    assetType: "fund" as "stock" | "etf" | "fund",
    startDate: toInputDate(),
    startDatePrecision: "estimated" as "exact" | "estimated",
    endDate: "",
    initialAmountEur: "",
    currentAmountEur: "",
    totalReturnPercent: "",
    isActive: true,
    returnPrecision: "estimated" as "exact" | "estimated",
  });
  const [contributionForm, setContributionForm] = useState({
    trackedInstrumentId: initialData.holdings.find((item) => item.status === "active")?.id?.toString() ?? "",
    flowType: "contribution" as "contribution" | "withdrawal",
    amountEur: "",
    flowDate: toInputDate(),
  });
  const [assetQuery, setAssetQuery] = useState("");
  const [assetResults, setAssetResults] = useState<AssetSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState(initialData.settings.benchmarkSymbol);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!assetQuery.trim() || assetQuery === `${trackingForm.symbol} - ${trackingForm.name}`) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await fetch(`/api/search-assets?q=${encodeURIComponent(assetQuery)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { results?: AssetSearchResult[] };
        setAssetResults(payload.results ?? []);
      } catch {
        setAssetResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [assetQuery, trackingForm.name, trackingForm.symbol]);

  const metrics = useMemo(
    () => [
      {
        label: "Valor total",
        value: formatCurrency(data.summary.totalValueEur),
        icon: Wallet,
        tone: "text-cyan-200",
      },
      {
        label: "P/L total",
        value: `${formatCurrency(data.summary.totalPlEur)} | ${formatPercent(data.summary.totalPlPercent)}`,
        icon: Activity,
        tone: data.summary.totalPlEur >= 0 ? "text-emerald-300" : "text-rose-300",
      },
      {
        label: "Aportaciones futuras",
        value: formatCurrency(data.summary.totalFutureFlowsEur),
        icon: Plus,
        tone: data.summary.totalFutureFlowsEur >= 0 ? "text-amber-200" : "text-rose-300",
      },
      {
        label: "Activos / cerrados",
        value: `${data.summary.activePositions} / ${data.summary.inactivePositions}`,
        icon: BarChart3,
        tone: "text-fuchsia-300",
      },
    ],
    [data.summary],
  );

  const periodMetrics = useMemo(
    () => [
      { label: "Diario", value: data.summary.periodReturns.day },
      { label: "Semanal", value: data.summary.periodReturns.week },
      { label: "Mensual", value: data.summary.periodReturns.month },
      { label: "Anual", value: data.summary.periodReturns.year },
      { label: "Desde base", value: data.summary.periodReturns.sinceStart },
    ],
    [data.summary.periodReturns],
  );

  async function reloadDashboard(nextMessage?: string) {
    const response = await fetch("/api/dashboard", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("No se pudo recargar el dashboard.");
    }

    const dashboard = (await response.json()) as DashboardData;
    setData(dashboard);
    setBenchmarkSymbol(dashboard.settings.benchmarkSymbol);
    setContributionForm((current) => ({
      ...current,
      trackedInstrumentId:
        current.trackedInstrumentId || dashboard.holdings.find((item) => item.status === "active")?.id?.toString() || "",
    }));
    setMessage(nextMessage ?? null);
  }

  async function handleRefresh() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/refresh-market", { method: "POST" });
        const payload = (await response.json()) as { failedSymbols?: string[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "El refresco ha fallado.");
        }

        await reloadDashboard(
          payload.failedSymbols && payload.failedSymbols.length > 0
            ? `Refresco completado con incidencias: ${payload.failedSymbols.join(", ")}`
            : "Mercado actualizado.",
        );
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : "No se pudo refrescar el mercado.");
      }
    });
  }

  async function handleTrackingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/seed-position", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...trackingForm,
            initialAmountEur: Number(trackingForm.initialAmountEur),
            currentAmountEur: Number(trackingForm.currentAmountEur),
            totalReturnPercent: Number(trackingForm.totalReturnPercent),
            endDate: trackingForm.isActive ? "" : trackingForm.endDate,
          }),
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo registrar el seguimiento inicial.");
        }

        await reloadDashboard("Instrumento de seguimiento guardado.");
        setTrackingForm({
          symbol: "",
          name: "",
          assetType: "fund",
          startDate: toInputDate(),
          startDatePrecision: "estimated",
          endDate: "",
          initialAmountEur: "",
          currentAmountEur: "",
          totalReturnPercent: "",
          isActive: true,
          returnPrecision: "estimated",
        });
        setAssetQuery("");
        setAssetResults([]);
      } catch (trackingError) {
        setError(
          trackingError instanceof Error ? trackingError.message : "No se pudo registrar el seguimiento inicial.",
        );
      }
    });
  }

  async function handleContributionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/contributions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackedInstrumentId: Number(contributionForm.trackedInstrumentId),
            flowType: contributionForm.flowType,
            amountEur: Number(contributionForm.amountEur),
            flowDate: contributionForm.flowDate,
          }),
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo registrar la aportacion.");
        }

        await reloadDashboard(
          contributionForm.flowType === "contribution" ? "Aportacion registrada." : "Retirada registrada.",
        );
        setContributionForm((current) => ({
          ...current,
          amountEur: "",
          flowDate: toInputDate(),
        }));
      } catch (contributionError) {
        setError(
          contributionError instanceof Error ? contributionError.message : "No se pudo registrar la aportacion.",
        );
      }
    });
  }

  async function handleSettingsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ benchmarkSymbol }),
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo actualizar el benchmark.");
        }

        await reloadDashboard("Benchmark actualizado.");
      } catch (settingsError) {
        setError(settingsError instanceof Error ? settingsError.message : "No se pudo actualizar el benchmark.");
      }
    });
  }

  async function handleBackup() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/backup", { method: "POST" });
        const payload = (await response.json()) as { path?: string; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo crear el backup.");
        }

        setMessage(`Backup creado en ${payload.path}`);
      } catch (backupError) {
        setError(backupError instanceof Error ? backupError.message : "No se pudo crear el backup.");
      }
    });
  }

  function handleExport(format: "json" | "csv") {
    setError(null);
    setMessage(`Exportando ${format.toUpperCase()}...`);
    window.location.href = `/api/export?format=${format}`;
  }

  function selectAsset(asset: AssetSearchResult) {
    setTrackingForm((current) => ({
      ...current,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
    }));
    setAssetQuery(`${asset.symbol} - ${asset.name}`);
    setAssetResults([]);
  }

  const activeHoldings = data.holdings.filter((item) => item.status === "active");

  return (
    <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8">
      <section className="panel scanline rounded-lg px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/80">Neon Ledger</p>
            <h1 className="neon-text mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Foto inicial cerrada. Aportaciones futuras reales.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              El pasado se resume en una carga flexible coherente. Desde hoy, cada aportacion o retirada mensual queda
              registrada como movimiento real y se incorpora al seguimiento.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[480px]">
            <div className="panel-muted rounded-md px-4 py-3">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Base</p>
              <p className="mt-2 text-lg font-semibold text-white">{data.settings.baseCurrency}</p>
            </div>
            <div className="panel-muted rounded-md px-4 py-3">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Benchmark</p>
              <p className="mt-2 text-lg font-semibold text-white">{data.settings.benchmarkSymbol}</p>
            </div>
            <div className="panel-muted rounded-md px-4 py-3">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Ultimo refresh</p>
              <p className="mt-2 text-sm font-medium text-white">{data.summary.lastUpdatedHuman}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center gap-3">
            {message ? <p className="text-sm text-cyan-200">{message}</p> : null}
            {error ? (
              <p className="flex items-center gap-2 text-sm text-rose-300">
                <CircleAlert className="h-4 w-4" />
                {error}
              </p>
            ) : null}
            {!message && !error && data.staleSymbols.length > 0 ? (
              <p className="text-sm text-amber-200">Sin refresco real todavia: {data.staleSymbols.join(", ")}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport("json")}
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/8 disabled:opacity-70"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/8 disabled:opacity-70"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleBackup}
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-medium text-amber-100 transition hover:bg-amber-300/16 disabled:opacity-70"
            >
              <HardDriveDownload className="h-4 w-4" />
              Crear backup
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              className="shadow-neon inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/16 disabled:opacity-70"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
              Refrescar mercado
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="panel rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted">{metric.label}</p>
                  <p className={`mt-3 text-2xl font-semibold ${metric.tone}`}>{metric.value}</p>
                </div>
                <div className="rounded-md border border-white/8 bg-white/4 p-2">
                  <Icon className={`h-5 w-5 ${metric.tone}`} />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {periodMetrics.map((metric) => (
          <article key={metric.label} className="panel-muted rounded-lg px-4 py-3">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{metric.label}</p>
            <p
              className={`mt-2 text-lg font-semibold ${
                metric.value === null ? "text-white" : metric.value >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {formatPercent(metric.value)}
            </p>
            <p className="mt-1 text-xs text-muted">se afina con cada refresh y cada nueva aportacion real</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
        <div className="space-y-6">
          <DashboardCharts data={data} />

          <section className="panel rounded-lg p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">Seguimiento</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Instrumentos cargados</h2>
              </div>
              <p className="text-xs text-muted">foto historica + movimientos futuros</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.24em] text-muted">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Activo</th>
                    <th className="pb-3 pr-4 font-medium">Estado</th>
                    <th className="pb-3 pr-4 font-medium">Inicio</th>
                    <th className="pb-3 pr-4 font-medium">Inicial</th>
                    <th className="pb-3 pr-4 font-medium">Actual / cierre</th>
                    <th className="pb-3 pr-4 font-medium">Base acumulada</th>
                    <th className="pb-3 pr-4 font-medium">Aport. futuras</th>
                    <th className="pb-3 pr-4 font-medium">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm text-muted">
                        Todavia no has cargado instrumentos. Empieza con tu foto inicial.
                      </td>
                    </tr>
                  ) : (
                    data.holdings.map((holding) => (
                      <tr key={holding.id} className="border-t border-white/6">
                        <td className="py-4 pr-4 align-top">
                          <div className="flex flex-col">
                            <span className="font-medium text-white">{holding.symbol}</span>
                            <span className="text-xs text-muted">{holding.name}</span>
                            <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200">
                              {holding.assetType}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 align-top">
                          <span
                            className={`rounded-full px-2 py-1 text-xs uppercase tracking-[0.2em] ${
                              holding.status === "active"
                                ? "bg-cyan-300/12 text-cyan-200"
                                : "bg-white/10 text-white"
                            }`}
                          >
                            {holding.status === "active" ? "Activo" : "Cerrado"}
                          </span>
                        </td>
                        <td className="py-4 pr-4 align-top text-white">
                          <div className="flex flex-col">
                            <span>{holding.startDate}</span>
                            <span className="text-xs text-muted">
                              {holding.startDatePrecision === "exact" ? "fecha exacta" : "fecha estimada"}
                            </span>
                            {holding.endDate ? <span className="text-xs text-muted">fin: {holding.endDate}</span> : null}
                          </div>
                        </td>
                        <td className="py-4 pr-4 align-top text-white">{formatCurrency(holding.initialAmountEur)}</td>
                        <td className="py-4 pr-4 align-top text-white">{formatCurrency(holding.currentAmountEur)}</td>
                        <td className="py-4 pr-4 align-top text-white">{formatCurrency(holding.basisAmountEur)}</td>
                        <td className="py-4 pr-4 align-top">
                          <div className="flex flex-col">
                            <span className={holding.futureNetFlowsEur >= 0 ? "text-cyan-200" : "text-rose-300"}>
                              {formatCurrency(holding.futureNetFlowsEur)}
                            </span>
                            <span className="text-xs text-muted">
                              hist.: {formatCurrency(holding.historicalEstimatedContributionsEur)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 align-top">
                          <div className="flex flex-col">
                            <span className={holding.plEur >= 0 ? "text-emerald-300" : "text-rose-300"}>
                              {formatCurrency(holding.plEur)}
                            </span>
                            <span className="text-xs text-muted">{formatPercent(holding.plPercent)}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="panel rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md border border-white/8 bg-white/4 p-2">
                <Sparkles className="h-4 w-4 text-cyan-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted">Carga flexible</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Foto inicial</h2>
              </div>
            </div>

            <form className="grid gap-3" onSubmit={handleTrackingSubmit}>
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Buscar fondo, ETF o accion</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    value={assetQuery}
                    onChange={(event) => {
                      setAssetQuery(event.target.value);
                      setAssetResults([]);
                      if (!event.target.value.trim()) {
                        setTrackingForm((current) => ({ ...current, symbol: "", name: "" }));
                      }
                    }}
                    className="w-full rounded-md border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
                    placeholder="Vanguard, Amundi, SPY, VWCE..."
                  />
                </div>
              </label>

              {isSearching ? <p className="text-xs text-muted">Buscando activos...</p> : null}

              {assetResults.length > 0 ? (
                <div className="rounded-md border border-white/10 bg-[#100b1d]">
                  {assetResults.map((asset) => (
                    <button
                      key={`${asset.symbol}-${asset.exchange}`}
                      type="button"
                      onClick={() => selectAsset(asset)}
                      className="flex w-full items-center justify-between border-b border-white/6 px-3 py-3 text-left last:border-b-0 hover:bg-white/5"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{asset.symbol}</p>
                        <p className="text-xs text-muted">{asset.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">{asset.assetType}</p>
                        <p className="text-xs text-muted">{asset.exchange}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Capital inicial EUR</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={trackingForm.initialAmountEur}
                    onChange={(event) =>
                      setTrackingForm((current) => ({ ...current, initialAmountEur: event.target.value }))
                    }
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                    placeholder="10000"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">
                    {trackingForm.isActive ? "Capital actual EUR" : "Capital de salida EUR"}
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={trackingForm.currentAmountEur}
                    onChange={(event) =>
                      setTrackingForm((current) => ({ ...current, currentAmountEur: event.target.value }))
                    }
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                    placeholder="12850"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Fecha inicial</span>
                  <input
                    type="date"
                    value={trackingForm.startDate}
                    onChange={(event) => setTrackingForm((current) => ({ ...current, startDate: event.target.value }))}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Precision fecha</span>
                  <select
                    value={trackingForm.startDatePrecision}
                    onChange={(event) =>
                      setTrackingForm((current) => ({
                        ...current,
                        startDatePrecision: event.target.value as "exact" | "estimated",
                      }))
                    }
                    className="rounded-md border border-white/10 bg-[#130e22] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                  >
                    <option value="estimated">Aproximada</option>
                    <option value="exact">Exacta</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Rentabilidad total %</span>
                  <input
                    required
                    type="number"
                    min="-99.99"
                    step="0.01"
                    value={trackingForm.totalReturnPercent}
                    onChange={(event) =>
                      setTrackingForm((current) => ({ ...current, totalReturnPercent: event.target.value }))
                    }
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                    placeholder="18.5"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Precision rentabilidad</span>
                  <select
                    value={trackingForm.returnPrecision}
                    onChange={(event) =>
                      setTrackingForm((current) => ({
                        ...current,
                        returnPrecision: event.target.value as "exact" | "estimated",
                      }))
                    }
                    className="rounded-md border border-white/10 bg-[#130e22] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                  >
                    <option value="estimated">Estimado</option>
                    <option value="exact">Exacto</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Estado</span>
                  <select
                    value={trackingForm.isActive ? "active" : "inactive"}
                    onChange={(event) =>
                      setTrackingForm((current) => ({
                        ...current,
                        isActive: event.target.value === "active",
                        endDate: event.target.value === "active" ? "" : current.endDate,
                      }))
                    }
                    className="rounded-md border border-white/10 bg-[#130e22] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Cerrado / ya no lo tengo</option>
                  </select>
                </label>
                {!trackingForm.isActive ? (
                  <label className="grid gap-1.5">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted">Fecha de cierre</span>
                    <input
                      type="date"
                      value={trackingForm.endDate}
                      onChange={(event) => setTrackingForm((current) => ({ ...current, endDate: event.target.value }))}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
                    />
                  </label>
                ) : null}
              </div>

              <p className="text-xs leading-5 text-muted">
                Esto cierra el pasado. La app deduce una base invertida historica coherente y deja las aportaciones
                futuras como movimientos reales separados.
              </p>

              <button
                type="submit"
                disabled={isPending || !trackingForm.symbol}
                className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Guardar foto inicial
              </button>
            </form>
          </section>

          <section className="panel rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md border border-white/8 bg-white/4 p-2">
                <ArrowUpDown className="h-4 w-4 text-fuchsia-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted">Futuro real</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Aportacion mensual</h2>
              </div>
            </div>

            <form className="grid gap-3" onSubmit={handleContributionSubmit}>
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Instrumento</span>
                <select
                  value={contributionForm.trackedInstrumentId}
                  onChange={(event) =>
                    setContributionForm((current) => ({ ...current, trackedInstrumentId: event.target.value }))
                  }
                  className="rounded-md border border-white/10 bg-[#130e22] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300/40"
                >
                  <option value="">Selecciona un activo activo</option>
                  {activeHoldings.map((holding) => (
                    <option key={holding.id} value={holding.id}>
                      {holding.symbol} - {holding.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Movimiento</span>
                  <select
                    value={contributionForm.flowType}
                    onChange={(event) =>
                      setContributionForm((current) => ({
                        ...current,
                        flowType: event.target.value as "contribution" | "withdrawal",
                      }))
                    }
                    className="rounded-md border border-white/10 bg-[#130e22] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300/40"
                  >
                    <option value="contribution">Aportacion</option>
                    <option value="withdrawal">Retirada</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">Fecha</span>
                  <input
                    type="date"
                    value={contributionForm.flowDate}
                    onChange={(event) =>
                      setContributionForm((current) => ({ ...current, flowDate: event.target.value }))
                    }
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300/40"
                  />
                </label>
              </div>
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Importe EUR</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={contributionForm.amountEur}
                  onChange={(event) =>
                    setContributionForm((current) => ({ ...current, amountEur: event.target.value }))
                  }
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-300/40"
                  placeholder="500"
                />
              </label>
              <button
                type="submit"
                disabled={isPending || !contributionForm.trackedInstrumentId}
                className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-fuchsia-300/30 bg-fuchsia-300/10 px-4 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-300/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Registrar movimiento
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {data.latestFlows.length === 0 ? (
                <p className="text-sm text-muted">Todavia no hay aportaciones futuras registradas.</p>
              ) : (
                data.latestFlows.map((flow) => (
                  <div key={flow.id} className="rounded-md border border-white/8 bg-white/4 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{flow.symbol}</p>
                        <p className="text-xs text-muted">{flow.flowDate}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs uppercase tracking-[0.24em] ${
                          flow.flowType === "contribution"
                            ? "bg-cyan-300/12 text-cyan-200"
                            : "bg-rose-300/12 text-rose-200"
                        }`}
                      >
                        {flow.flowType === "contribution" ? "Aportacion" : "Retirada"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{formatCurrency(flow.amountEur)}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md border border-white/8 bg-white/4 p-2">
                <Gauge className="h-4 w-4 text-amber-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted">Ajustes</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Benchmark</h2>
              </div>
            </div>

            <div className="mb-4 rounded-md border border-white/8 bg-white/4 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Base local</p>
              <p className="mt-2 break-all font-mono text-xs text-white">data/portfolio.db</p>
            </div>

            <form className="grid gap-3" onSubmit={handleSettingsSubmit}>
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-[0.2em] text-muted">Simbolo benchmark</span>
                <input
                  value={benchmarkSymbol}
                  onChange={(event) => setBenchmarkSymbol(event.target.value.toUpperCase())}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/40"
                  placeholder="SPY"
                />
              </label>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-medium text-amber-100 transition hover:bg-amber-300/16 disabled:opacity-70"
              >
                <Save className="h-4 w-4" />
                Guardar benchmark
              </button>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );
}
