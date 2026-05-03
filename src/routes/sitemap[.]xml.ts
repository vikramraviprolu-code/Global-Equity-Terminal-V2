import { createFileRoute } from "@tanstack/react-router";
import { UNIVERSE } from "@/server/universe";

const SITE = "https://rankaisolutions.tech";
const STATIC_PATHS = [
  "/",
  "/terminal",
  "/compare",
  "/watchlist",
  "/events",
  "/data-quality",
  "/sources",
  "/settings",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        // Use the static UNIVERSE constant — never hit a paid API on a public,
        // crawler-indexed endpoint (security: SERVER_ROUTE_PAID_API_NO_AUTH).
        const symbols = UNIVERSE.map((u) => u.symbol).filter(Boolean);

        const urls: string[] = [];
        for (const p of STATIC_PATHS) {
          urls.push(
            `<url><loc>${SITE}${p === "/" ? "" : p}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${p === "/" ? "1.0" : "0.7"}</priority></url>`,
          );
        }
        for (const sym of symbols) {
          const safe = encodeURIComponent(sym);
          urls.push(
            `<url><loc>${SITE}/terminal/${safe}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`,
          );
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
