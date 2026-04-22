"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardData } from "@/lib/portfolio";

const DIESEL_COLORS = ["#d9c27a", "#c86b3c", "#8fa07a", "#b24a3a", "#6f7f87", "#8a5f52"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function tooltipCurrency(value: number | string | ReadonlyArray<number | string> | undefined) {
  const base = Array.isArray(value) ? value[0] : value;
  return formatCurrency(Number(base ?? 0));
}

function tooltipPercent(value: number | string | ReadonlyArray<number | string> | undefined) {
  const base = Array.isArray(value) ? value[0] : value;
  return formatPercent(Number(base ?? 0));
}

type Props = {
  data: DashboardData;
};

export function DashboardCharts({ data }: Props) {
  const highlightedHoldings = data.holdings.slice(0, 5);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="panel panel-diesel rounded-lg p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">Valor actual</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Valor de mercado frente a base acumulada</h3>
          </div>
          <p className="text-xs text-muted">euros estimados desde la fecha inicial</p>
        </div>
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#d9c27a]" />
            valor de mercado
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#8a5f52]" />
            base acumulada
          </span>
        </div>
        <div className="h-64 sm:h-72">
          <AreaChart
            data={data.performanceSeries}
            responsive
            style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 240 }}
          >
            <defs>
              <linearGradient id="dieselFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#d9c27a" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#d9c27a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(201, 151, 104, 0.14)" vertical={false} />
            <XAxis dataKey="label" stroke="#8f8777" tickLine={false} axisLine={false} />
            <YAxis stroke="#8f8777" tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip
              contentStyle={{
                background: "rgba(19,15,13,0.96)",
                border: "1px solid rgba(217,194,122,0.22)",
                borderRadius: 10,
                color: "#f4ead7",
              }}
              formatter={(value) => tooltipCurrency(value)}
            />
            <Area type="monotone" dataKey="portfolioValue" stroke="#d9c27a" strokeWidth={2.5} fill="url(#dieselFill)" />
            <Line type="monotone" dataKey="totalCost" stroke="#8a5f52" strokeWidth={1.8} dot={false} />
          </AreaChart>
        </div>
      </section>

      <section className="panel panel-diesel rounded-lg p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#c86b3c]">Distribucion</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Peso de cada instrumento</h3>
          </div>
          <p className="text-xs text-muted">{data.holdings.length} instrumentos</p>
        </div>
        <div className="h-64 sm:h-72">
          <PieChart responsive style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 240 }}>
            <Pie
              data={data.allocation}
              dataKey="value"
              nameKey="symbol"
              innerRadius={62}
              outerRadius={94}
              paddingAngle={2}
            >
              {data.allocation.map((entry, index) => (
                <Cell key={entry.symbol} fill={DIESEL_COLORS[index % DIESEL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(19,15,13,0.96)",
                border: "1px solid rgba(200,107,60,0.24)",
                borderRadius: 10,
                color: "#f4ead7",
              }}
              formatter={(value) => tooltipCurrency(value)}
            />
          </PieChart>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {data.allocation.slice(0, 6).map((entry, index) => (
            <div key={entry.symbol} className="flex items-center justify-between rounded-md border border-white/8 bg-black/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DIESEL_COLORS[index % DIESEL_COLORS.length] }} />
                <span className="text-sm text-white">{entry.symbol}</span>
              </div>
              <span className="text-sm text-muted">{entry.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel-diesel rounded-lg p-5 xl:col-span-2">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#8fa07a]">Comparativa</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Rentabilidad acumulada frente a {data.settings.benchmarkSymbol}</h3>
          </div>
          <p className="text-xs text-muted">porcentaje acumulado desde la fecha de arranque</p>
        </div>
        <div className="h-64 sm:h-72">
          <LineChart
            data={data.performanceSeries}
            responsive
            style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 240 }}
          >
            <CartesianGrid stroke="rgba(143, 160, 122, 0.14)" vertical={false} />
            <XAxis dataKey="label" stroke="#8f8777" tickLine={false} axisLine={false} />
            <YAxis
              stroke="#8f8777"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatPercent(Number(value) - 100)}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(19,15,13,0.96)",
                border: "1px solid rgba(143,160,122,0.24)",
                borderRadius: 10,
                color: "#f4ead7",
              }}
              formatter={(value) => tooltipPercent(Number(value) - 100)}
            />
            <Line type="monotone" dataKey="portfolioIndex" name="cartera" stroke="#d9c27a" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="benchmarkIndex" name={data.settings.benchmarkSymbol} stroke="#8fa07a" strokeWidth={2.2} dot={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </LineChart>
        </div>
      </section>

      <section className="panel panel-diesel rounded-lg p-5 xl:col-span-2">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#b24a3a]">Trayectoria</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Evolucion estimada de cada instrumento</h3>
          </div>
          <p className="text-xs text-muted">valor estimado en euros desde su fecha inicial</p>
        </div>
        <div className="h-72 sm:h-80">
          <LineChart
            data={data.holdingPerformanceSeries}
            responsive
            style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 240 }}
          >
            <CartesianGrid stroke="rgba(178, 74, 58, 0.12)" vertical={false} />
            <XAxis dataKey="label" stroke="#8f8777" tickLine={false} axisLine={false} />
            <YAxis stroke="#8f8777" tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(Number(value))} />
            <Tooltip
              contentStyle={{
                background: "rgba(19,15,13,0.96)",
                border: "1px solid rgba(178,74,58,0.24)",
                borderRadius: 10,
                color: "#f4ead7",
              }}
              formatter={(value) => tooltipCurrency(value)}
            />
            {highlightedHoldings.map((holding, index) => (
              <Line
                key={holding.symbol}
                type="monotone"
                dataKey={holding.symbol}
                name={holding.symbol}
                stroke={DIESEL_COLORS[index % DIESEL_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </LineChart>
        </div>
      </section>
    </div>
  );
}
