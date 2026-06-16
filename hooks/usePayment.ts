"use client";
import { useState, useCallback } from "react";

export type PaymentState = "idle" | "requesting" | "signing" | "settling" | "done" | "error";

interface UsePaymentOptions {
  agentId: number;
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
}

export function usePayment({ agentId, onSuccess, onError }: UsePaymentOptions) {
  const [state, setState] = useState<PaymentState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [paymentResponse, setPaymentResponse] = useState<unknown>(null);

  const call = useCallback(
    async (body: unknown) => {
      setState("requesting");
      setError(null);

      try {
        const res = await fetch(`/api/agents/${agentId}/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const prHeader = res.headers.get("PAYMENT-REQUIRED");

        if (res.status === 402 && prHeader) {
          setState("signing");
          setResult(null);
          const requirements = JSON.parse(atob(prHeader));
          setPaymentResponse({ status: 402, requirements });
          setError("Payment required — use GatewayClient to sign and retry.");
          onError?.("Payment required");
          return;
        }

        const prResponseHeader = res.headers.get("PAYMENT-RESPONSE");
        if (prResponseHeader) {
          setPaymentResponse(JSON.parse(atob(prResponseHeader)));
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        setState("settling");
        const data = await res.json();
        setState("done");
        setResult(data);
        onSuccess?.(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setState("error");
        setError(msg);
        onError?.(msg);
      }
    },
    [agentId, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setResult(null);
    setPaymentResponse(null);
  }, []);

  return { state, error, result, paymentResponse, call, reset };
}
