"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: (count, error) =>
              !(error instanceof ApiError && error.status < 500) && count < 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(() => {
    const expired = () => {
      client.clear();
      router.replace("/login?expired=1");
      router.refresh();
    };
    window.addEventListener("gymflow:session-expired", expired);
    return () => window.removeEventListener("gymflow:session-expired", expired);
  }, [client, router]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
