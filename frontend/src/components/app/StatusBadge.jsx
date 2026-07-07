import React from "react";

const styles = {
  green: "bg-[#D1FAE5] text-[#065F46] border-[#34D399]",
  yellow: "bg-[#FEF3C7] text-[#92400E] border-[#FBBF24]",
  red: "bg-[#FEE2E2] text-[#991B1B] border-[#F87171]",
  neutral: "bg-stone-100 text-stone-700 border-stone-300",
};

export default function StatusBadge({ tone = "neutral", children, testId }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${styles[tone] || styles.neutral}`}
    >
      {children}
    </span>
  );
}
