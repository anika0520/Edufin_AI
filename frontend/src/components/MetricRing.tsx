import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface MetricRingProps {
  value: number; // 0-100
  size?: number;
  label: string;
  hint?: string;
  color?: "primary" | "accent" | "warning" | "danger" | "success";
  suffix?: string;
  icon?: ReactNode;
}

const colorMap = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  warning: "hsl(var(--warning))",
  danger: "hsl(var(--danger))",
  success: "hsl(var(--success))",
};

export function MetricRing({
  value,
  size = 140,
  label,
  hint,
  color = "primary",
  suffix = "",
  icon,
}: MetricRingProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const stroke1 = colorMap[color];

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            stroke="hsl(var(--muted))"
            fill="transparent"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            stroke={stroke1}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ filter: `drop-shadow(0 0 12px ${stroke1})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <div className={cn("mb-1", `text-[${color}]`)}>{icon}</div>}
          <div className="font-display text-3xl font-bold">
            {Math.round(value)}
            <span className="text-base text-muted-foreground">{suffix}</span>
          </div>
          {hint && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{hint}</div>}
        </div>
      </div>
      <div className="mt-3 text-sm font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
