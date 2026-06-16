export function formatUSDCDisplay(amount: number | string): string {
  const val = parseFloat(String(amount));
  if (isNaN(val)) return "$0.00";
  if (val < 0.001) return `$${val.toFixed(6)}`;
  if (val < 0.01) return `$${val.toFixed(4)}`;
  if (val < 1) return `$${val.toFixed(3)}`;
  return `$${val.toFixed(2)}`;
}

export function truncateAddress(addr: string, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function categoryColor(category: string): string {
  const map: Record<string, string> = {
    NLP: "bg-blue-500/20 text-blue-300",
    CODE: "bg-emerald-500/20 text-emerald-300",
    DATA: "bg-amber-500/20 text-amber-300",
    IMAGE: "bg-pink-500/20 text-pink-300",
    AUDIO: "bg-purple-500/20 text-purple-300",
    CUSTOM: "bg-neutral-500/20 text-neutral-300",
  };
  return map[category] ?? map.CUSTOM;
}

export function priceAtomicToUSDC(atomicUnits: number | string): number {
  return parseFloat(String(atomicUnits)) / 1_000_000;
}

export function usdcToPriceAtomic(usdc: number | string): number {
  return Math.round(parseFloat(String(usdc)) * 1_000_000);
}
