// SportsMistakes static SEO page generator
// Generates crawlable English/French landing pages from Supabase.
// Run by GitHub Actions. No framework or site rebuild required.

import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = "https://scwjlljurircxuufhqih.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2psbGp1cmlyY3h1dWZocWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjUyMjcsImV4cCI6MjA5Njg0MTIyM30.WF0HRRb9mAkuOySjabTd8CZXVZRqF0MhMl0N2mafnns";

const SITE = "https://sportsmistakes.com";
const OUT = path.resolve("mistakes");
const PAGE_SIZE = 1000;


// ============================================================
// BASIC HELPERS
// ============================================================

function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


function xml(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}


function strip(v = "") {
  return String(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function clip(v = "", max = 165) {
  const s = strip(v);

  if (s.length <= max) {
    return s;
  }

  return (
    s
      .slice(0, max - 1)
      .replace(/\s+\S*$/, "") + "…"
  );
}


function slugify(v = "") {
  return (
    String(v)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 88) || "sports-mistake"
  );
}


function shortId(id = "") {
  return String(id)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);
}


// ============================================================
// PAGE URLS
// ============================================================

function englishPath(m) {
  return `/mistakes/en/${slugify(m.title)}-${shortId(m.id)}.html`;
}


function frenchPath(m) {
  const title = m.title_fr || m.title;

  return `/mistakes/fr/${slugify(title)}-${shortId(m.id)}.html`;
}


function hasFrench(m) {
  return Boolean(
    String(m.title_fr || "").trim() &&
      (
        String(m.summary_fr || "").trim() ||
        String(m.why_it_matters_fr || "").trim() ||
        String(m.lessons_learned_fr || "").trim()
      )
  );
}


function field(m, name, lang) {
  if (lang === "fr") {
    const translated = m[`${name}_fr`];

    if (
      translated !== null &&
      translated !== undefined &&
      String(translated).trim()
    ) {
      return translated;
    }
  }

  return m[name] ?? "";
}


// ============================================================
// LOAD ALL SPORTSMISTAKES RECORDS FROM SUPABASE
// ============================================================

async function fetchAllMistakes() {
  const all = [];

  let offset = 0;

  while (true) {
    const select = [
      "id",
      "title",
      "title_fr",
      "sport",
      "year",
      "league",
      "category",
      "subcategory",
      "teams_people",
      "key_people",
      "summary",
      "summary_fr",
      "why_it_matters",
      "why_it_matters_fr",
      "lessons_learned",
      "lessons_learned_fr",
      "artwork_url",
      "ai_artwork_url",
      "controversy_score",
      "source_1",
      "source_2",
      "created_at",
      "updated_at"
    ].join(",");

    const url = new URL(
      `${SUPABASE_URL}/rest/v1/mistakes`
    );

    url.searchParams.set("select", select);
    url.searchParams.set(
      "order",
      "controversy_score.desc"
    );
    url.searchParams.set(
      "offset",
      String(offset)
    );
    url.searchParams.set(
      "limit",
      String(PAGE_SIZE)
    );

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) {
      throw new Error(
        `Supabase ${res.status}: ${await res.text()}`
      );
    }

    const rows = await res.json();

    all.push(...rows);

    if (rows.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return all.filter(
    (m) => m && m.id && m.title
  );
}


// ============================================================
// BUILD ONE STATIC SEO PAGE
// ============================================================

function buildPage(m, lang = "en") {
  const isFr = lang === "fr";

  const title =
    strip(field(m, "title", lang)) ||
    "Sports Mistake";

  const summary =
    strip(field(m, "summary", lang));

  const why =
    strip(field(m, "why_it_matters", lang));

  const lesson =
    strip(field(m, "lessons_learned", lang));

  const desc = clip(
    summary ||
      why ||
      lesson ||
      (
        isFr
          ? `Découvrez, jugez et apprenez de ${title} sur SportsMistakes.`
          : `Explore, judge and learn from ${title} on SportsMistakes.`
      )
  );

  const canonicalPath =
    isFr
      ? frenchPath(m)
      : englishPath(m);

  const canonical =
    `${SITE}${canonicalPath}`;

  const enUrl =
    `${SITE}${englishPath(m)}`;

  const frUrl =
    hasFrench(m)
      ? `${SITE}${frenchPath(m)}`
      : "";

  const dynamic =
    `${SITE}/mistake.html?id=${encodeURIComponent(m.id)}`;

  const artwork =
    m.artwork_url ||
    m.ai_artwork_url ||
    "";

  const meta = [
    m.year,
    m.sport,
    m.league,
    m.category,
    m.subcategory
  ]
    .filter(Boolean)
    .join(" • ");


  // ==========================================================
  // ENGLISH / FRENCH LABELS
  // ==========================================================

  const labels = isFr
    ? {
        record:
          "LE REGISTRE DE SPORTSMISTAKES",

        back:
          "Accueil",

        story:
          "L’HISTOIRE",

        why:
          "POURQUOI ÇA COMPTE",

        learn:
          "CE QU’ON PEUT APPRENDRE",

        people:
          "ÉQUIPES / PERSONNES",

        judge:
          "JUGEZ CETTE ERREUR",

        cta:
          "VOTER • CHOISIR 3 RAISONS • AJOUTER VOTRE AVIS",

        sources:
          "SOURCES",

        source:
          "Source",

        database:
          "Explorer la base de données",

        nominate:
          "Proposer"
      }
    : {
        record:
          "THE SPORTSMISTAKES RECORD",

        back:
          "Home",

        story:
          "THE STORY",

        why:
          "WHY IT MATTERS",

        learn:
          "WHAT CAN WE LEARN?",

        people:
          "TEAMS / PEOPLE",

        judge:
          "JUDGE THIS MISTAKE",

        cta:
          "VOTE • PICK 3 REASONS • ADD YOUR TAKE",

        sources:
          "SOURCES",

        source:
          "Source",

        database:
          "Explore the Database",

        nominate:
          "Nominate"
      };


  // ==========================================================
  // SOCIAL IMAGE METADATA
  // ==========================================================

  const ogImage = artwork
    ? `
  <meta property="og:image" content="${esc(artwork)}">
  <meta name="twitter:image" content="${esc(artwork)}">`
    : "";


  // ==========================================================
  // LANGUAGE ALTERNATES
  // ==========================================================

  const hreflang = `
  <link rel="alternate"
        hreflang="en"
        href="${esc(enUrl)}">

  ${
    frUrl
      ? `<link rel="alternate"
               hreflang="fr-CA"
               href="${esc(frUrl)}">`
      : ""
  }

  <link rel="alternate"
        hreflang="x-default"
        href="${esc(enUrl)}">`;


  // ==========================================================
  // STRUCTURED DATA FOR GOOGLE
  // ==========================================================

  const jsonLd = {
    "@context": "https://schema.org",

    "@type": "Article",

    headline: title,

    description: desc,

    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical
    },

    publisher: {
      "@type": "Organization",
      name: "SportsMistakes",
      url: SITE
    },

    about: [
      m.sport,
      m.league,
      m.category,
      m.subcategory,
      m.teams_people
    ].filter(Boolean),

    keywords: [
      "sports mistakes",
      m.sport,
      m.league,
      m.category,
      m.subcategory,
      m.year
    ]
      .filter(Boolean)
      .join(", ")
  };


  if (artwork) {
    jsonLd.image = [artwork];
  }


  if (m.created_at) {
    jsonLd.datePublished =
      m.created_at;
  }


  if (m.updated_at) {
    jsonLd.dateModified =
      m.updated_at;
  }


  // ==========================================================
  // COMPLETE STATIC HTML PAGE
  // ==========================================================

  return `<!doctype html>

<html lang="${isFr ? "fr-CA" : "en"}">

<head>

  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >

  <title>${esc(title)} | SportsMistakes</title>

  <meta
    name="description"
    content="${esc(desc)}"
  >

  <link
    rel="canonical"
    href="${esc(canonical)}"
  >

  ${hreflang}


  <!-- OPEN GRAPH -->

  <meta
    property="og:type"
    content="article"
  >

  <meta
    property="og:site_name"
    content="SportsMistakes"
  >

  <meta
    property="og:title"
    content="${esc(title)} | SportsMistakes"
  >

  <meta
    property="og:description"
    content="${esc(desc)}"
  >

  <meta
    property="og:url"
    content="${esc(canonical)}"
  >

  ${ogImage}


  <!-- TWITTER / X -->

  <meta
    name="twitter:card"
    content="summary_large_image"
  >

  <meta
    name="twitter:title"
    content="${esc(title)} | SportsMistakes"
  >

  <meta
    name="twitter:description"
    content="${esc(desc)}"
  >


  <!-- GOOGLE STRUCTURED DATA -->

  <script type="application/ld+json">
    ${
      JSON.stringify(jsonLd)
        .replace(/</g, "\\u003c")
    }
  </script>


  <!-- PAGE DESIGN -->

  <style>

    * {
      box-sizing: border-box;
    }


    html {
      background: #06111a;
      color: #f7f9fb;

      font-family:
        Arial,
        Helvetica,
        sans-serif;
    }


    body {
      margin: 0;

      background:
        linear-gradient(
          180deg,
          #07131f,
          #050c13 70%
        );

      min-height: 100vh;
    }


    a {
      color: inherit;
    }


    .nav {
      min-height: 64px;

      padding:
        10px 5vw;

      display: flex;

      align-items: center;

      justify-content:
        space-between;

      gap: 20px;

      background:
        #05101a;

      border-bottom:
        1px solid
        rgba(255,255,255,.09);
    }


    .brand {
      font-weight: 1000;

      line-height: .86;

      text-transform:
        uppercase;

      font-size: 18px;

      text-decoration: none;
    }


    .brand span {
      color: #e92329;
    }


    .navlinks {
      display: flex;

      align-items: center;

      gap: 22px;

      font-size: 12px;

      font-weight: 900;

      text-transform:
        uppercase;
    }


    .navlinks a {
      text-decoration: none;
    }


    .nominate {
      padding:
        12px 17px;

      border-radius:
        8px;

      background:
        #e92329;
    }


    main {
      max-width:
        1180px;

      margin:
        auto;

      padding:
        34px 22px 70px;
    }


    .kicker {
      color:
        #d7b062;

      font-size:
        11px;

      font-weight:
        1000;

      letter-spacing:
        1.2px;

      text-transform:
        uppercase;
    }


    h1 {
      font-size:
        clamp(
          36px,
          5vw,
          67px
        );

      line-height:
        .96;

      letter-spacing:
        -2px;

      margin:
        12px 0 12px;

      max-width:
        1000px;
    }


    .meta {
      color:
        #d7b062;

      font-weight:
        800;

      font-size:
        13px;

      margin-bottom:
        25px;
    }


    .layout {
      display:
        grid;

      grid-template-columns:
        minmax(0,.9fr)
        minmax(0,1.1fr);

      gap:
        28px;

      align-items:
        start;
    }


    .frame {
      padding:
        10px;

      border:
        4px solid
        #a97925;

      background:
        #17120a;

      box-shadow:
        0 18px 44px
        rgba(0,0,0,.35);
    }


    .frame img {
      display:
        block;

      width:
        100%;

      height:
        auto;
    }


    .card {
      background:
        #0e1d2a;

      border:
        1px solid
        rgba(255,255,255,.12);

      border-radius:
        14px;

      padding:
        22px;

      margin-bottom:
        15px;
    }


    h2 {
      font-size:
        15px;

      letter-spacing:
        .8px;

      margin:
        0 0 10px;

      color:
        #d7b062;
    }


    p {
      font-size:
        17px;

      line-height:
        1.58;

      color:
        #e3e9ef;

      margin:
        0;
    }


    .people {
      margin-top:
        12px;

      color:
        #b7c4d0;

      font-size:
        13px;
    }


    .cta {
      display:
        block;

      text-align:
        center;

      text-decoration:
        none;

      background:
        #e92329;

      color:
        white;

      border-radius:
        10px;

      padding:
        17px 20px;

      font-weight:
        1000;

      font-size:
        15px;

      margin:
        17px 0 7px;
    }


    .cta small {
      display:
        block;

      font-size:
        10px;

      margin-top:
        4px;

      opacity:
        .82;

      letter-spacing:
        .5px;
    }


    .source-row {
      display:
        flex;

      gap:
        10px;

      flex-wrap:
        wrap;
    }


    .source-row a {
      padding:
        9px 12px;

      border:
        1px solid
        rgba(255,255,255,.15);

      border-radius:
        8px;

      text-decoration:
        none;

      font-size:
        12px;
    }


    footer {
      max-width:
        1180px;

      margin:
        auto;

      padding:
        25px 22px 50px;

      border-top:
        1px solid
        rgba(255,255,255,.1);

      color:
        #9aabba;

      font-size:
        12px;
    }


    @media (max-width: 760px) {

      .nav {
        padding:
          10px 14px;
      }


      .navlinks a:not(.nominate) {
        display:
          none;
      }


      .layout {
        grid-template-columns:
          1fr;
      }


      .card {
        padding:
          16px;
      }


      main {
        padding:
          24px 14px 50px;
      }


      h1 {
        letter-spacing:
          -1px;
      }


      .frame {
        padding:
          7px;
      }

    }

  </style>

</head>


<body>


  <!-- NAVIGATION -->

  <nav class="nav">

    <a
      class="brand"
      href="${SITE}/"
    >
      Sports
      <br>
      <span>Mistakes</span>
    </a>


    <div class="navlinks">

      <a href="${SITE}/">
        ${labels.back}
      </a>


      <a href="${SITE}/rankings.html">
        ${
          isFr
            ? "Classements"
            : "Rankings"
        }
      </a>


      <a href="${SITE}/collections.html">
        Collections
      </a>


      <a href="${SITE}/hall-of-fame.html">
        ${
          isFr
            ? "Temple de la renommée"
            : "Hall of Fame"
        }
      </a>


      <a
        class="nominate"
        href="${SITE}/submit.html"
      >
        ${labels.nominate}
      </a>

    </div>

  </nav>


  <!-- MAIN CONTENT -->

  <main>

    <div class="kicker">
      ${labels.record}
    </div>


    <h1>
      ${esc(title)}
    </h1>


    <div class="meta">
      ${esc(meta)}
    </div>


    <div class="layout">


      <!-- ARTWORK -->

      <div>

        ${
          artwork
            ? `
              <div class="frame">

                <img
                  src="${esc(artwork)}"
                  alt="${esc(title)} — SportsMistakes artwork"
                >

              </div>
            `
            : ""
        }

      </div>


      <!-- ARTICLE CONTENT -->

      <article>


        <!-- STORY -->

        <section class="card">

          <h2>
            ${labels.story}
          </h2>

          <p>
            ${
              esc(
                summary ||
                (
                  isFr
                    ? "Le récit complet est disponible sur la fiche interactive SportsMistakes."
                    : "The full record is available on the interactive SportsMistakes page."
                )
              )
            }
          </p>


          ${
            m.teams_people
              ? `
                <div class="people">

                  <strong>
                    ${labels.people}:
                  </strong>

                  ${esc(m.teams_people)}

                </div>
              `
              : ""
          }

        </section>


        <!-- WHY IT MATTERS -->

        ${
          why
            ? `
              <section class="card">

                <h2>
                  ${labels.why}
                </h2>

                <p>
                  ${esc(why)}
                </p>

              </section>
            `
            : ""
        }


        <!-- LESSON -->

        ${
          lesson
            ? `
              <section class="card">

                <h2>
                  💡 ${labels.learn}
                </h2>

                <p>
                  ${esc(lesson)}
                </p>

              </section>
            `
            : ""
        }


        <!-- INTERACTIVE PAGE CTA -->

        <a
          class="cta"
          href="${esc(dynamic)}"
        >

          ${labels.judge}

          <small>
            ${labels.cta}
          </small>

        </a>


        <!-- SOURCES -->

        ${
          (m.source_1 || m.source_2)
            ? `
              <section class="card">

                <h2>
                  ${labels.sources}
                </h2>


                <div class="source-row">

                  ${
                    m.source_1
                      ? `
                        <a
                          href="${esc(m.source_1)}"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          ${labels.source} 1
                        </a>
                      `
                      : ""
                  }


                  ${
                    m.source_2
                      ? `
                        <a
                          href="${esc(m.source_2)}"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          ${labels.source} 2
                        </a>
                      `
                      : ""
                  }

                </div>

              </section>
            `
            : ""
        }


      </article>

    </div>

  </main>


  <!-- FOOTER -->

  <footer>

    SportsMistakes.com —

    ${
      isFr
        ? "Apprendre des erreurs qui ont changé le sport."
        : "Learn from the mistakes that changed sports."
    }

  </footer>


</body>

</html>`;
}


// ============================================================
// GENERATE EVERYTHING
// ============================================================

async function main() {

  console.log(
    "Fetching SportsMistakes records…"
  );


  const mistakes =
    await fetchAllMistakes();


  console.log(
    `Found ${mistakes.length} records.`
  );


  // Delete previous generated directory
  // so removed/renamed records don't leave stale pages.

  await fs.rm(
    OUT,
    {
      recursive: true,
      force: true
    }
  );


  // Create language directories.

  await fs.mkdir(
    path.join(OUT, "en"),
    {
      recursive: true
    }
  );


  await fs.mkdir(
    path.join(OUT, "fr"),
    {
      recursive: true
    }
  );


  const sitemap = [];

  const now =
    new Date().toISOString();


  // Main site pages

  sitemap.push({
    loc: `${SITE}/`,
    lastmod: now
  });


  sitemap.push({
    loc: `${SITE}/rankings.html`,
    lastmod: now
  });


  sitemap.push({
    loc: `${SITE}/collections.html`,
    lastmod: now
  });


  sitemap.push({
    loc: `${SITE}/hall-of-fame.html`,
    lastmod: now
  });


  let enCount = 0;

  let frCount = 0;


  // ==========================================================
  // GENERATE ENGLISH + FRENCH PAGES
  // ==========================================================

  for (const m of mistakes) {

    // English page

    const enRel =
      englishPath(m)
        .replace(/^\//, "");


    await fs.writeFile(
      path.resolve(enRel),
      buildPage(m, "en"),
      "utf8"
    );


    sitemap.push({
      loc:
        `${SITE}${englishPath(m)}`,

      lastmod:
        m.updated_at ||
        m.created_at ||
        now
    });


    enCount++;


    // French page, only when translation exists

    if (hasFrench(m)) {

      const frRel =
        frenchPath(m)
          .replace(/^\//, "");


      await fs.writeFile(
        path.resolve(frRel),
        buildPage(m, "fr"),
        "utf8"
      );


      sitemap.push({
        loc:
          `${SITE}${frenchPath(m)}`,

        lastmod:
          m.updated_at ||
          m.created_at ||
          now
      });


      frCount++;

    }

  }


  // ==========================================================
  // CREATE XML SITEMAP
  // ==========================================================

  const sitemapXml =
`<?xml version="1.0" encoding="UTF-8"?>

<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>

${
  sitemap
    .map(
      (x) =>
`  <url>

    <loc>${xml(x.loc)}</loc>

    <lastmod>${
      xml(
        String(x.lastmod)
          .slice(0, 10)
      )
    }</lastmod>

  </url>`
    )
    .join("\n")
}

</urlset>
`;


  await fs.writeFile(
    "sitemap.xml",
    sitemapXml,
    "utf8"
  );


  // ==========================================================
  // CREATE ROBOTS.TXT
  // ==========================================================

  await fs.writeFile(
    "robots.txt",

`User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`,

    "utf8"
  );


  // ==========================================================
  // REPORT
  // ==========================================================

  console.log(
    `Generated ${enCount} English pages and ${frCount} French pages.`
  );


  console.log(
    `Generated sitemap.xml with ${sitemap.length} URLs.`
  );

}


// ============================================================
// RUN
// ============================================================

main()
  .catch(
    (err) => {

      console.error(err);

      process.exit(1);

    }
  );
