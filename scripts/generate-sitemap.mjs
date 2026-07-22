const SUPABASE_URL =
  "https://scwjlljurircxuufhqih.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2psbGp1cmlyY3h1dWZocWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjUyMjcsImV4cCI6MjA5Njg0MTIyN30.WF0HRRb9mAkuOySjabTd8CZXVZRqF0MhMl0N2mafnns";

const SITE_URL = "https://sportsmistakes.com";
const PAGE_SIZE = 1000;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fetchAllMistakes() {
  const allMistakes = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const end = start + PAGE_SIZE - 1;

    const endpoint =
      `${SUPABASE_URL}/rest/v1/mistakes` +
      `?select=id` +
      `&order=id.asc`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${start}-${end}`,
        Prefer: "count=exact"
      }
    });

    if (!response.ok) {
      const responseText = await response.text();

      throw new Error(
        `Supabase request failed with status ${response.status}: ${responseText}`
      );
    }

    const page = await response.json();

    allMistakes.push(...page);

    console.log(
      `Fetched ${page.length} mistake records starting at row ${start}.`
    );

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return allMistakes;
}

function createUrlEntry(location, options = {}) {
  const lines = [
    "  <url>",
    `    <loc>${escapeXml(location)}</loc>`
  ];

  if (options.lastmod) {
    lines.push(
      `    <lastmod>${escapeXml(options.lastmod)}</lastmod>`
    );
  }

  if (options.changefreq) {
    lines.push(
      `    <changefreq>${escapeXml(options.changefreq)}</changefreq>`
    );
  }

  if (options.priority) {
    lines.push(
      `    <priority>${escapeXml(options.priority)}</priority>`
    );
  }

  lines.push("  </url>");

  return lines.join("\n");
}

async function generateSitemap() {
  const mistakes = await fetchAllMistakes();
  const today = new Date().toISOString().slice(0, 10);

  const mainPageEntries = [
    createUrlEntry(`${SITE_URL}/`, {
      lastmod: today,
      changefreq: "daily",
      priority: "1.0"
    }),

    createUrlEntry(`${SITE_URL}/rankings.html`, {
      lastmod: today,
      changefreq: "daily",
      priority: "0.9"
    }),

    createUrlEntry(`${SITE_URL}/collections.html`, {
      lastmod: today,
      changefreq: "weekly",
      priority: "0.9"
    }),

    createUrlEntry(`${SITE_URL}/hall-of-fame.html`, {
      lastmod: today,
      changefreq: "weekly",
      priority: "0.8"
    }),

    createUrlEntry(`${SITE_URL}/submit.html`, {
      lastmod: today,
      changefreq: "monthly",
      priority: "0.5"
    })
  ];

  const mistakeEntries = mistakes.map((mistake) => {
    const mistakeUrl =
      `${SITE_URL}/mistake.html?id=${encodeURIComponent(mistake.id)}`;

    return createUrlEntry(mistakeUrl, {
      changefreq: "monthly",
      priority: "0.8"
    });
  });

  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...mainPageEntries,
    ...mistakeEntries,
    "</urlset>",
    ""
  ].join("\n");

  const { writeFile } = await import("node:fs/promises");

  await writeFile("sitemap.xml", sitemapXml, "utf8");

  console.log("");
  console.log("Sitemap generation complete.");
  console.log(`Main pages included: ${mainPageEntries.length}`);
  console.log(`Mistake pages included: ${mistakeEntries.length}`);
  console.log(
    `Total sitemap URLs: ${mainPageEntries.length + mistakeEntries.length}`
  );
}

generateSitemap().catch((error) => {
  console.error("Sitemap generation failed.");
  console.error(error);
  process.exit(1);
});
