import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Spinner size="lg" />
    </div>
  );
}
