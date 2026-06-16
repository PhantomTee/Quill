"use client";
import { useEffect, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search agents..." }: SearchBarProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(t);
  }, [local, onChange]);

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="2"
        style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        className="input"
        style={{ paddingLeft: 36 }}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
