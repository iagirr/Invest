"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardData } from "@/lib/portfolio";

const PIE_COLORS = ["#61f6ff", "#ff44c8", "#ffb347", "#8b5cf6", "#34d399", "#f97316"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function tooltipCurrency(value: number | string | ReadonlyArray<number | string> | undefined) {
  const base = Array.isArray(value) ? value[0] : value;
  return formatCurrency(Number(base ?? 0));
}

type Props = {
  data: DashboardData;
};

export function DashboardCharts({ data }: Props) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="panel scanline rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">Evolución</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Valor de cartera</h3>
          </div>
          <p className="text-xs text-muted">snapshots por refresco</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.performanceSeries}>
              <defs>
                <linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#61f6ff" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#61f6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(156,149,187,0.15)" vertical={false} />
              <XAxis dataKey="label" stroke="#9c95bb" tickLine={false} axisLine={false} />
              <YAxis
                stroke="#9c95bb"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,8,18,0.94)",
                  border: "1px solid rgba(97,246,255,0.22)",
                  borderRadius: 12,
                  color: "#f6f2ff",
                }}
                formatter={(value) => tooltipCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="portfolioValue"
                stroke="#61f6ff"
                strokeWidth={2.5}
                fill="url(#portfolioFill)"
              />
              <Line type="monotone" dataKey="totalCost" stroke="#ffb347" strokeWidth={1.4} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel scanline rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/80">Distribución</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Pesos por activo</h3>
          </div>
          <p className="text-xs text-muted">{data.holdings.length} posiciones</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.allocation}
                dataKey="value"
                nameKey="symbol"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={3}
              >
                {data.allocation.map((entry, index) => (
                  <Cell key={entry.symbol} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "rgba(10,8,18,0.94)",
                  border: "1px solid rgba(255,68,200,0.22)",
                  borderRadius: 12,
                  color: "#f6f2ff",
                }}
                formatter={(value) => tooltipCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {data.allocation.slice(0, 6).map((entry, index) => (
            <div key={entry.symbol} className="flex items-center justify-between rounded-md border border-white/8 bg-white/3 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <span className="text-sm text-white">{entry.symbol}</span>
              </div>
              <span className="text-sm text-muted">{entry.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel scanline rounded-lg p-5 xl:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">Benchmark</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Cartera vs {data.settings.benchmarkSymbol}</h3>
          </div>
          <p className="text-xs text-muted">índice base 100</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.performanceSeries}>
              <CartesianGrid stroke="rgba(156,149,187,0.15)" vertical={false} />
              <XAxis dataKey="label" stroke="#9c95bb" tickLine={false} axisLine={false} />
              <YAxis stroke="#9c95bb" tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,8,18,0.94)",
                  border: "1px solid rgba(255,179,71,0.22)",
                  borderRadius: 12,
                  color: "#f6f2ff",
                }}
              />
              <Line type="monotone" dataKey="portfolioIndex" stroke="#61f6ff" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="benchmarkIndex" stroke="#ff44c8" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
