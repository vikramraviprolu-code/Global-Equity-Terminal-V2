import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/terminal")({
  validateSearch: (s: Record<string, unknown>) => z.object({ t: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Global Equity Terminal — Stock Analysis" },
      { name: "description", content: "Run value screening, momentum analysis, and an evidence-based recommendation on global stocks across US, India, Europe, and Asia-Pacific markets." },
    ],
    links: [{ rel: "canonical", href: "https://rankaisolutions.tech/terminal" }],
  }),
  component: () => <Outlet />,
});
