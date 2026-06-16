"use client";

const COLORS: Record<string, string> = {
  ALL: "#3b82f6",
  NLP: "#3b82f6",
  CODE: "#059669",
  DATA: "#d97706",
  IMAGE: "#db2777",
  AUDIO: "#7c3aed",
  CUSTOM: "#6b7280",
};

interface CategoryFilterProps {
  categories: string[];
  selected: string;
  onChange: (c: string) => void;
}

export function CategoryFilter({ categories, selected, onChange }: CategoryFilterProps) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {categories.map((cat) => {
        const active = selected === cat;
        const color = COLORS[cat] ?? COLORS.CUSTOM;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              padding: "5px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              border: `1px solid ${active ? color : "var(--color-border)"}`,
              background: active ? `${color}18` : "var(--color-surface)",
              color: active ? color : "var(--color-text-secondary)",
              transition: "all 0.15s",
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
