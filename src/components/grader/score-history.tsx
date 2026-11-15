"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { ArrowDownRight, ArrowUpRight, LineChart, Minus } from "lucide-react";
import type { GradePoint } from "./types";

type Point = { i: number; score: number; short: string; full: string; label: string };

const targetLabel = (key: string) => (key === "general" ? "General review" : key.startsWith("role:") ? key.slice(5) : "Job match");
const short = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const p = payload?.[0]?.payload as Point | undefined;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-white shadow-lift">
      <p className="font-display text-[15px] leading-none font-extrabold tabular-nums">{p.score}/100</p>
      <p className="mt-1 text-[11.5px] text-white/70">{p.label}</p>
      <p className="text-[11.5px] text-white/50">{p.full}</p>
    </div>
  );
}

export function ScoreHistory({ history, cvId }: { history: GradePoint[]; cvId: string }) {
  const gid = useId().replace(/:/g, "");
  const points: Point[] = history
    .filter((g) => g.cvId === cvId)
    .map((g, i) => {
      const d = new Date(g.createdAt);
      return {
        i,
        score: g.score,
        short: short(d),
        full: d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        label: targetLabel(g.target),
      };
    });

  if (points.length === 0) return null;

  const first = points[0].score;
  const last = points[points.length - 1].score;
  const delta = last - first;
  const best = Math.max(...points.map((p) => p.score));
  const Trend = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;

  return (
    <section className="rounded-[28px] bg-paper p-5 shadow-soft ring-1 ring-line sm:p-7" aria-label="Score history">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint text-forest-deep">
            <LineChart size={18} aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">Score history</h2>
            <p className="mt-0.5 text-[13.5px] text-muted">
              {points.length > 1 ? `${points.length} grades of this CV` : "Edit your CV and grade again to track your progress."}
            </p>
          </div>
        </div>
        {points.length > 1 && (
          <div className="flex items-center gap-2 text-[12.5px] font-bold tabular-nums">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-line">Best {best}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
                delta > 0 ? "bg-mint text-forest-deep" : delta < 0 ? "bg-coral/12 text-[#b4391f]" : "bg-ink/[0.06] text-muted"
              }`}
            >
              <Trend size={14} aria-hidden />
              {delta > 0 ? "+" : ""}
              {delta} since first
            </span>
          </div>
        )}
      </div>

      {points.length > 1 && (
        <div className="mt-5 h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 190 }}>
            <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0e7a5f" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0e7a5f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(15,26,23,0.08)" strokeDasharray="3 5" />
              <XAxis
                dataKey="i"
                tickFormatter={(i: number) => points[i]?.short ?? ""}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11.5, fill: "#4d5a55" }}
                interval="preserveStartEnd"
                padding={{ left: 28, right: 28 }}
              />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "#4d5a55" }} width={40} />
              <Tooltip content={ChartTooltip} cursor={{ stroke: "#0e7a5f", strokeOpacity: 0.25, strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#0e7a5f"
                strokeWidth={2.5}
                fill={`url(#${gid})`}
                dot={{ r: 4, fill: "#fbf8f2", stroke: "#0e7a5f", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#0e7a5f", stroke: "#fbf8f2", strokeWidth: 2 }}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
