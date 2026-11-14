"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface TrendDataPoint {
  date: string;
  passRate: number;
  failRate: number;
  total: number;
  [key: string]: any;
}

interface TrendChartProps {
  data: TrendDataPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
        Loading trend chart...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
        No execution trend data available yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
          <XAxis
            dataKey="date"
            stroke="#888888"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
            tickFormatter={(val) => {
              if (typeof val === "string" && val.length >= 10) {
                return val.slice(5); // e.g. "11-13"
              }
              return val;
            }}
          />
          <YAxis
            stroke="#888888"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
            domain={[0, 100]}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(18, 18, 23, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#ffffff", fontWeight: 600, marginBottom: "4px" }}
            formatter={(value: any, name: any) => {
              if (name === "passRate") return [`${value}%`, "Pass Rate"];
              if (name === "failRate") return [`${value}%`, "Fail Rate"];
              return [value, name];
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", paddingBottom: "8px" }}
            formatter={(val) => (val === "passRate" ? "Pass Rate (%)" : "Fail Rate (%)")}
          />
          <Line
            type="monotone"
            dataKey="passRate"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#10b981", strokeWidth: 1, stroke: "#064e3b" }}
            activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="failRate"
            stroke="#f43f5e"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#f43f5e", strokeWidth: 1, stroke: "#881337" }}
            activeDot={{ r: 6, stroke: "#f43f5e", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

