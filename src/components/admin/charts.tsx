"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/utils";

const axis = { stroke: "#6B7280", fontSize: 12, tickLine: false, axisLine: false } as const;
const tip = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12, color: "#1F2937" };

export function RevenueChart({ data }: { data: { day: string; revenue: number; orders: number }[] }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#EEF0F2" vertical={false} />
          <XAxis dataKey="day" {...axis} />
          <YAxis {...axis} width={56} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
          <Tooltip contentStyle={tip} cursor={{ stroke: "#CBD5E1" }} formatter={(v: number, k: string) => (k === "revenue" ? [formatINR(v), "Revenue"] : [v, "Orders"])} />
          <Line type="monotone" dataKey="revenue" stroke="#1B365D" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data }: { data: { label: string; count: number }[] }) {
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid stroke="#EEF0F2" horizontal={false} />
          <XAxis type="number" {...axis} allowDecimals={false} />
          <YAxis type="category" dataKey="label" {...axis} width={120} />
          <Tooltip contentStyle={tip} cursor={{ fill: "#F3F4F6" }} formatter={(v: number) => [v, "Searches"]} />
          <Bar dataKey="count" fill="#2D4A3E" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
