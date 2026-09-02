/*
  SportsMistakes EN/FR Language System — V2
  ==========================================
  ONE centralized public-site language file.

  PRIVACY
  -------
  • No geolocation
  • No IP lookup
  • No language cookie
  • First visit uses browser PRIMARY language:
      fr-* => French
      everything else => English
  • A manual choice stores ONLY:
      sportsmistakes_language = "en" or "fr"
    in localStorage.

  DATABASE CONTENT
  ----------------
  When French is selected:
    title              -> title_fr
    summary            -> summary_fr
    why_it_matters     -> why_it_matters_fr
    lessons_learned    -> lessons_learned_fr

  English is always the fallback.
*/

(() => {
  "use strict";

  const STORAGE_KEY = "sportsmistakes_language";
  const VALID_LANGUAGES = new Set(["en", "fr"]);

  // ============================================================
  // 1. LANGUAGE PREFERENCE
  // ============================================================

  function getSavedLanguage() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return VALID_LANGUAGES.has(value) ? value : null;
    } catch {
      return null;
    }
  }

  function getBrowserLanguage() {
    const primary = String(
      (Array.isArray(navigator.languages) && navigator.languages[0]) ||
      navigator.language ||
      "en"
    ).toLowerCase();

    return primary.startsWith("fr") ? "fr" : "en";
  }

  function getLanguage() {
    return getSavedLanguage() || getBrowserLanguage();
  }

  function setLanguage(language) {
    if (!VALID_LANGUAGES.has(language)) return;

    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}

    document.documentElement.lang = language;
    window.location.reload();
  }

  // ============================================================
  // 2. DATABASE FIELD SELECTOR
  // ============================================================

  function field(record, baseName) {
    if (!record) return "";

    if (getLanguage() === "fr") {
      const frenchValue = record[`${baseName}_fr`];

      if (
        frenchValue !== null &&
        frenchValue !== undefined &&
        String(frenchValue).trim() !== ""
      ) {
        return frenchValue;
      }
    }

    return record[baseName] ?? "";
  }

  // ============================================================
  // 3. CENTRAL UI DICTIONARY
  // ============================================================

  const FR = {
    "Home": "Accueil",
    "Rankings": "Classements",
    "Collections": "Collections",
    "Hall of Fame": "Temple de la renommée",
    "Nominate": "Proposer",
    "Submit": "Proposer",

    "Nominate a Sports Mistake": "Proposer une erreur sportive",
    "What mistake belongs in the record?":
      "Quelle erreur mérite sa place dans le registre?",
    "Nominate It": "Proposer",
    "SEARCH THE RECORD": "RECHERCHER DANS LE REGISTRE",
    "Search the Record": "Rechercher dans le registre",
    "Find a Sports Mistake": "Trouver une erreur sportive",
    "Search by moment, athlete, team, sport, year or lesson.":
      "Recherchez par moment, athlète, équipe, sport, année ou leçon.",
    "Search": "Rechercher",
    "SEARCH": "RECHERCHER",
    "Search Results": "Résultats de recherche",
    "Popular searches:": "Recherches populaires :",
    "Learn from mistakes:": "Apprendre des erreurs :",
    "TODAY'S ARTWORK": "ŒUVRE DU JOUR",

    "Leadership": "Leadership",
    "Preparation": "Préparation",
    "Pressure": "Pression",
    "Communication": "Communication",
    "Decision-making": "Prise de décision",
    "Risk": "Risque",
    "Teamwork": "Travail d’équipe",

    "🔥 TODAY'S 5": "🔥 LES 5 DU JOUR",
    "Judge today's mistakes": "Jugez les erreurs du jour",
    "Five moments. Make your call. Compare with other fans.":
      "Cinq moments. Rendez votre verdict. Comparez-le à celui des autres partisans.",
    "Start judging →": "Commencer à juger →",

    "📊 RANKINGS": "📊 CLASSEMENTS",
    "How mistakes stack up": "Le classement des erreurs",
    "View all →": "Tout voir →",
    "🏆 HALL OF FAME": "🏆 TEMPLE DE LA RENOMMÉE",
    "The mistakes the community remembers":
      "Les erreurs dont la communauté se souvient",
    "A visual gallery of the most debated moments in the record.":
      "Une galerie visuelle des moments les plus débattus du registre.",
    "View Hall of Fame →": "Voir le Temple de la renommée →",

    "🏆 Today's Sports Mistake": "🏆 L’erreur sportive du jour",
    "Loading...": "Chargement...",
    "Loading today's featured mistake.":
      "Chargement de l’erreur vedette du jour.",
    "Think we're missing a famous sports mistake?":
      "Vous pensez qu’il manque une erreur sportive célèbre?",
    "Help preserve sports history.":
      "Aidez-nous à préserver l’histoire du sport.",
    "Submit Your Own Sports Mistake":
      "Proposer une erreur sportive",
    "Explore the Database":
      "Explorer la base de données",
    "🔥 Trending Now":
      "🔥 Tendances",
    "💀 Most Controversial":
      "💀 Les plus controversées",
    "👁 Most Viewed":
      "👁 Les plus consultées",
    "🕘 Recently Added":
      "🕘 Ajoutées récemment",
    "All Mistakes":
      "Toutes les erreurs",
    "Loading mistakes...":
      "Chargement des erreurs...",
    "Load More Mistakes":
      "Afficher plus d’erreurs",

    "Read the Story":
      "Lire l’histoire",
    "Read the Story ›":
      "Lire l’histoire ›",
    "Read Story →":
      "Lire l’histoire →",
    "Read →":
      "Lire →",
    "Next Mistake →":
      "Erreur suivante →",
    "View Mistake":
      "Voir l’erreur",

    "← Back to Database":
      "← Retour à la base de données",
    "Back to Database":
      "Retour à la base de données",
    "Loading mistake...":
      "Chargement de l’erreur...",
    "No mistake ID provided.":
      "Aucun identifiant d’erreur fourni.",
    "Mistake not found.":
      "Erreur introuvable.",
    "The Story":
      "L’histoire",
    "Why This Changed Sports":
      "Pourquoi ce moment a compté",
    "Why It Matters":
      "Pourquoi c’est important",
    "Learn from this mistake":
      "Apprendre de cette erreur",
    "Related Mistakes":
      "Erreurs connexes",
    "Sources":
      "Sources",
    "Report":
      "Signaler",
    "Share":
      "Partager",
    "Controversy Score":
      "Indice de controverse",
    "Fan Verdict":
      "Verdict des partisans",
    "Judge":
      "Juger",
    "Learn":
      "Apprendre",
    "Debate":
      "Débattre",
    "YES":
      "OUI",
    "NO":
      "NON",
    "Yes":
      "Oui",
    "No":
      "Non",
    "Yes — Mistake":
      "Oui — Erreur",
    "No — Not Really":
      "Non — Pas vraiment",
    "No related mistakes yet.":
      "Aucune erreur connexe pour le moment.",
    "Could not load related mistakes.":
      "Impossible de charger les erreurs connexes.",

    "About":
      "À propos",
    "How It Works":
      "Comment ça fonctionne",
    "Contact":
      "Contact",
    "Privacy":
      "Confidentialité",
    "Terms":
      "Conditions d’utilisation"
  };

  const PLACEHOLDERS_FR = {
    'Search mistakes, people, teams, or lessons like "leadership"...':
      'Rechercher des erreurs, personnes, équipes ou leçons comme « leadership »...',

    "e.g. Buckner lets ball pass through his legs":
      "ex. : Buckner laisse la balle passer entre ses jambes",

    "e.g. Seahawks pass at the goal line":
      "ex. : la passe des Seahawks près de la ligne des buts"
  };

  // ============================================================
  // 4. DROPDOWN TRANSLATIONS
  //
  // We change only what the visitor SEES.
  // Option values remain unchanged so the existing filters work.
  // ============================================================

  const SPORT_FR = {
    "All Sports": "Tous les sports",
    "Soccer": "Soccer",
    "Olympics": "Jeux olympiques",
    "Tennis": "Tennis",
    "Golf": "Golf",
    "Boxing": "Boxe",
    "Horse Racing": "Courses hippiques",
    "Curling": "Curling",
    "Lacrosse": "Crosse",
    "Sailing": "Voile",
    "Paralympics": "Jeux paralympiques",
    "Track": "Athlétisme",
    "Track & Field": "Athlétisme",
    "Cycling": "Cyclisme",
    "Running": "Course",
    "Rugby": "Rugby",
    "Cricket": "Cricket",
    "Wrestling": "Lutte",
    "Alpine Skiing": "Ski alpin",
    "American Football": "Football américain",
    "Archery": "Tir à l’arc",
    "Artistic Swimming": "Natation artistique",
    "Australian Rules Football": "Football australien",
    "Badminton": "Badminton",
    "Baseball": "Baseball",
    "Basketball": "Basketball",
    "Beach Soccer": "Soccer de plage",
    "Beach Volleyball": "Volleyball de plage",
    "Biathlon": "Biathlon",
    "Billiards / Pool": "Billard",
    "BMX": "BMX",
    "Bobsleigh": "Bobsleigh",
    "Bowling": "Quilles",
    "Brazilian Jiu-Jitsu": "Jiu-jitsu brésilien",
    "Canoe / Kayak": "Canoë / Kayak",
    "Cheerleading": "Cheerleading",
    "Chess": "Échecs",
    "Climbing": "Escalade",
    "Cross-Country Skiing": "Ski de fond",
    "CrossFit": "CrossFit",
    "Darts": "Fléchettes",
    "Disc Golf": "Disc golf",
    "Diving": "Plongeon",
    "Drag Racing": "Course d’accélération",
    "Equestrian": "Sports équestres",
    "Esports": "Sports électroniques",
    "Fencing": "Escrime",
    "Field Hockey": "Hockey sur gazon",
    "Figure Skating": "Patinage artistique",
    "Formula E": "Formule E",
    "Freestyle Skiing": "Ski acrobatique",
    "Gaelic Football": "Football gaélique",
    "Gymnastics": "Gymnastique",
    "Handball": "Handball",
    "Harness Racing": "Courses sous harnais",
    "High Diving": "Plongeon de haut vol",
    "Ice Hockey": "Hockey sur glace",
    "IndyCar": "IndyCar",
    "Judo": "Judo",
    "Karate": "Karaté",
    "Karting": "Karting",
    "Kickboxing": "Kickboxing",
    "Kitesurfing": "Kitesurf",
    "Luge": "Luge",
    "Marathon": "Marathon",
    "Mixed Martial Arts": "Arts martiaux mixtes",
    "Modern Pentathlon": "Pentathlon moderne",
    "MotoGP": "MotoGP",
    "Motocross": "Motocross",
    "Mountain Biking": "Vélo de montagne",
    "Muay Thai": "Muay-thaï",
    "NASCAR": "NASCAR",
    "Netball": "Netball",
    "Open Water Swimming": "Natation en eau libre",
    "Padel": "Padel",
    "Parkour": "Parkour",
    "Pickleball": "Pickleball",
    "Polo": "Polo",
    "Powerlifting": "Force athlétique",
    "Racquetball": "Racquetball",
    "Rally Racing": "Rallye automobile",
    "Rhythmic Gymnastics": "Gymnastique rythmique",
    "Road Cycling": "Cyclisme sur route",
    "Rodeo": "Rodéo",
    "Roller Derby": "Roller derby",
    "Rowing": "Aviron",
    "Shooting": "Tir sportif",
    "Short Track Speed Skating":
      "Patinage de vitesse sur courte piste",
    "Skeleton": "Skeleton",
    "Ski Jumping": "Saut à ski",
    "Skateboarding": "Planche à roulettes",
    "Snooker": "Snooker",
    "Snowboarding": "Planche à neige",
    "Softball": "Softball",
    "Speed Skating": "Patinage de vitesse",
    "Sport Climbing": "Escalade sportive",
    "Squash": "Squash",
    "Strongman": "Homme fort",
    "Surfing": "Surf",
    "Swimming": "Natation",
    "Synchronized Swimming": "Natation synchronisée",
    "Table Tennis": "Tennis de table",
    "Taekwondo": "Taekwondo",
    "Triathlon": "Triathlon",
    "Trampoline": "Trampoline",
    "Volleyball": "Volleyball",
    "Wakeboarding": "Wakeboard",
    "Water Polo": "Water-polo",
    "Waterskiing": "Ski nautique",
    "Weightlifting": "Haltérophilie",
    "Windsurfing": "Planche à voile",
    "World Rally Championship":
      "Championnat du monde des rallyes",
    "Other": "Autre"
  };

  const CATEGORY_FR = {
    "All Categories":
      "Toutes les catégories",
    "Coaching Mistake":
      "Erreur d’entraîneur",
    "Referee Mistake":
      "Erreur d’arbitrage",
    "Player Mistake":
      "Erreur de joueur",
    "Front Office Mistake":
      "Erreur de direction",
    "Ownership Mistake":
      "Erreur de propriétaire",
    "League Mistake":
      "Erreur de ligue",
    "Fan Interference":
      "Interférence d’un partisan"
  };

  const GENERIC_OPTION_FR = {
    "All Leagues":
      "Toutes les ligues",
    "All Teams":
      "Toutes les équipes",
    "All Years":
      "Toutes les années",
    "All Categories":
      "Toutes les catégories",
    "All Sports":
      "Tous les sports"
  };

  // ============================================================
  // 5. SAFE TRANSLATION HELPERS
  // ============================================================

  function setText(selector, frenchText) {
    const el = document.querySelector(selector);

    if (
      el &&
      el.textContent !== frenchText
    ) {
      el.textContent = frenchText;
    }
  }

  function setHTML(selector, frenchHTML) {
    const el = document.querySelector(selector);

    if (
      el &&
      el.innerHTML !== frenchHTML
    ) {
      el.innerHTML = frenchHTML;
    }
  }

  function translateExactTextNodes() {
    if (
      !document.body ||
      getLanguage() !== "fr"
    ) {
      return;
    }

    const walker =
      document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent =
              node.parentElement;

            if (!parent) {
              return NodeFilter.FILTER_REJECT;
            }

            if (
              [
                "SCRIPT",
                "STYLE",
                "NOSCRIPT",
                "OPTION"
              ].includes(parent.tagName)
            ) {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(
        walker.currentNode
      );
    }

    for (const node of nodes) {
      const raw =
        node.nodeValue || "";

      const trimmed =
        raw.trim();

      if (FR[trimmed]) {
        node.nodeValue =
          raw.replace(
            trimmed,
            FR[trimmed]
          );

        continue;
      }

      let match =
        trimmed.match(
          /^Fan Verdict:\s*(\d+)% say YES this was a mistake$/i
        );

      if (match) {
        node.nodeValue =
          raw.replace(
            trimmed,
            `Verdict des partisans : ${match[1]} % disent OUI, c’était une erreur`
          );

        continue;
      }

      if (
        /^Fan Verdict:\s*No votes yet$/i.test(trimmed)
      ) {
        node.nodeValue =
          raw.replace(
            trimmed,
            "Verdict des partisans : aucun vote pour le moment"
          );

        continue;
      }

      if (
        /^Fan Verdict:\s*Loading in background$/i.test(trimmed)
      ) {
        node.nodeValue =
          raw.replace(
            trimmed,
            "Verdict des partisans : chargement en arrière-plan"
          );
      }
    }
  }

  function translatePlaceholders() {
    if (getLanguage() !== "fr") return;

    document
      .querySelectorAll(
        "input[placeholder], textarea[placeholder]"
      )
      .forEach(el => {
        const original =
          el.getAttribute("placeholder");

        if (
          PLACEHOLDERS_FR[original]
        ) {
          el.setAttribute(
            "placeholder",
            PLACEHOLDERS_FR[original]
          );
        }
      });
  }

  function translateSelectOptions() {
    if (getLanguage() !== "fr") return;

    // ----------------------------------------------------------
    // SPORT FILTER
    // ----------------------------------------------------------

    const sportSelect =
      document.getElementById("sportFilter");

    if (sportSelect) {
      [...sportSelect.options]
        .forEach(option => {
          const englishLabel =
            option.dataset.enLabel ||
            option.textContent.trim();

          if (!option.dataset.enLabel) {
            option.dataset.enLabel =
              englishLabel;
          }

          option.textContent =
            SPORT_FR[englishLabel] ||
            GENERIC_OPTION_FR[englishLabel] ||
            englishLabel;
        });
    }

    // ----------------------------------------------------------
    // CATEGORY FILTER
    // ----------------------------------------------------------

    const categorySelect =
      document.getElementById("categoryFilter");

    if (categorySelect) {
      [...categorySelect.options]
        .forEach(option => {
          const englishLabel =
            option.dataset.enLabel ||
            option.textContent.trim();

          if (!option.dataset.enLabel) {
            option.dataset.enLabel =
              englishLabel;
          }

          option.textContent =
            CATEGORY_FR[englishLabel] ||
            GENERIC_OPTION_FR[englishLabel] ||
            englishLabel;
        });
    }

    // ----------------------------------------------------------
    // LEAGUE / TEAM / YEAR FILTERS
    // ----------------------------------------------------------

    [
      "leagueFilter",
      "teamFilter",
      "yearFilter"
    ].forEach(id => {
      const select =
        document.getElementById(id);

      if (!select) return;

      [...select.options]
        .forEach(
          (option, index) => {
            const englishLabel =
              option.dataset.enLabel ||
              option.textContent.trim();

            if (!option.dataset.enLabel) {
              option.dataset.enLabel =
                englishLabel;
            }

            /*
              Proper names and years remain unchanged.

              Only generic options such as
              "All Teams" are translated.
            */

            if (
              index === 0 ||
              GENERIC_OPTION_FR[englishLabel]
            ) {
              option.textContent =
                GENERIC_OPTION_FR[englishLabel] ||
                englishLabel;
            }
          }
        );
    });
  }

  // ============================================================
  // 6. HOMEPAGE-SPECIFIC UI
  // ============================================================

  function translateHomepage() {
    if (getLanguage() !== "fr") return;

    setText(
      ".home-fast-intro .museum-kicker",
      "LE REGISTRE PARTICIPATIF DES ERREURS SPORTIVES"
    );

    setHTML(
      ".home-fast-intro h1",
      'Apprendre des plus grandes <span>erreurs sportives</span> de l’histoire'
    );

    setText(
      ".homepage-nominate-card h2",
      "Proposer une erreur sportive"
    );

    setText(
      ".homepage-nominate-card .nominate-title-row p",
      "Quelle erreur mérite sa place dans le registre?"
    );

    setText(
      ".top-search .engage-kicker",
      "RECHERCHER DANS LE REGISTRE"
    );

    setText(
      ".top-search h2",
      "Trouver une erreur sportive"
    );

    setText(
      ".top-search .search-topline p",
      "Recherchez par moment, athlète, équipe, sport, année ou leçon."
    );

    setText(
      ".daily-art-kicker",
      "ŒUVRE DU JOUR"
    );

    // ----------------------------------------------------------
    // POPULAR SEARCH / LEARN LABELS
    // ----------------------------------------------------------

    document
      .querySelectorAll(".popular")
      .forEach(el => {
        for (
          const node of [...el.childNodes]
        ) {
          if (
            node.nodeType !==
            Node.TEXT_NODE
          ) {
            continue;
          }

          const raw =
            node.nodeValue || "";

          const trimmed =
            raw.trim();

          if (
            trimmed ===
            "Popular searches:"
          ) {
            node.nodeValue =
              raw.replace(
                trimmed,
                "Recherches populaires :"
              );
          }

          if (
            trimmed ===
            "Learn from mistakes:"
          ) {
            node.nodeValue =
              raw.replace(
                trimmed,
                "Apprendre des erreurs :"
              );
          }
        }
      });

    // ----------------------------------------------------------
    // LESSON BUTTONS
    // ----------------------------------------------------------

    const lessonLabels = {
      "Leadership":
        "Leadership",
      "Preparation":
        "Préparation",
      "Pressure":
        "Pression",
      "Communication":
        "Communication",
      "Decision-making":
        "Prise de décision",
      "Risk":
        "Risque",
      "Teamwork":
        "Travail d’équipe"
    };

    document
      .querySelectorAll(
        ".learn-searches button"
      )
      .forEach(button => {
        const english =
          button.dataset.enLabel ||
          button.textContent.trim();

        if (!button.dataset.enLabel) {
          button.dataset.enLabel =
            english;
        }

        if (
          lessonLabels[english]
        ) {
          button.textContent =
            lessonLabels[english];
        }
      });

    // ----------------------------------------------------------
    // FOOTER
    // ----------------------------------------------------------

    const footerMap = {
      "about.html":
        "À propos",
      "how-it-works.html":
        "Comment ça fonctionne",
      "contact.html":
        "Contact",
      "privacy.html":
        "Confidentialité",
      "terms.html":
        "Conditions d’utilisation"
    };

    document
      .querySelectorAll("footer a")
      .forEach(link => {
        const href =
          link.getAttribute("href") ||
          "";

        if (footerMap[href]) {
          link.textContent =
            footerMap[href];
        }
      });
  }

  // ============================================================
  // 7. SHARED BRAND UI
  // ============================================================

  function translateSharedUI() {
    if (getLanguage() !== "fr") return;

    const brandTag =
      document.querySelector(
        ".brand-tag"
      );

    if (brandTag) {
      brandTag.innerHTML =
        "La base de données Internet<br>des erreurs sportives";
    }
  }

  // ============================================================
  // 8. APPLY EVERYTHING
  // ============================================================

  function applyFrenchUI() {
    if (getLanguage() !== "fr") {
      return;
    }

    translateExactTextNodes();

    translatePlaceholders();

    translateSelectOptions();

    translateHomepage();

    translateSharedUI();
  }

  // ============================================================
  // 9. EN / FR SELECTOR
  // ============================================================

  function mountSelector() {
    const navigation =
      document.querySelector(
        ".nav-links"
      ) ||
      document.querySelector(
        ".top-nav"
      );

    if (!navigation) return;

    if (
      document.getElementById(
        "smLanguageSwitch"
      )
    ) {
      return;
    }

    const current =
      getLanguage();

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.id =
      "smLanguageSwitch";

    wrapper.className =
      "sm-language-switch";

    wrapper.setAttribute(
      "aria-label",
      current === "fr"
        ? "Choix de langue"
        : "Language selection"
    );

    wrapper.innerHTML = `

      <button
        type="button"
        data-lang="en"
        class="${
          current === "en"
            ? "active"
            : ""
        }"
        aria-pressed="${
          current === "en"
        }"
        title="English"
      >
        EN
      </button>

      <span aria-hidden="true">
        /
      </span>

      <button
        type="button"
        data-lang="fr"
        class="${
          current === "fr"
            ? "active"
            : ""
        }"
        aria-pressed="${
          current === "fr"
        }"
        title="Français"
      >
        FR
      </button>

    `;

    wrapper
      .querySelectorAll(
        "button"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            setLanguage(
              button.dataset.lang
            );
          }
        );
      });

    navigation.appendChild(
      wrapper
    );
  }

  // ============================================================
  // 10. SELECTOR STYLES
  // ============================================================

  function installStyles() {
    if (
      document.getElementById(
        "smLanguageStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "smLanguageStyles";

    style.textContent = `

      .sm-language-switch {

        display:inline-flex;

        align-items:center;

        gap:5px;

        margin-left:4px;

        padding:5px 8px;

        border:
          1px solid
          rgba(255,255,255,.18);

        border-radius:999px;

        background:
          rgba(255,255,255,.04);

        color:#a8b3c1;

        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size:12px;

        font-weight:900;

        letter-spacing:.5px;

        white-space:nowrap;

      }


      .sm-language-switch button {

        appearance:none;

        border:0;

        background:transparent;

        color:#a8b3c1;

        padding:3px 4px;

        margin:0;

        cursor:pointer;

        font:inherit;

        line-height:1;

      }


      .sm-language-switch button.active {

        color:#ffffff;

      }


      .sm-language-switch button:hover {

        color:#ff6464;

      }


      @media(max-width:760px) {

        .sm-language-switch {

          margin-left:0;

        }

      }

    `;

    document.head.appendChild(
      style
    );
  }

  // ============================================================
  // 11. PUBLIC API USED BY INDEX.HTML / MISTAKE.HTML
  // ============================================================

  window.SMLanguage = {

    get:
      getLanguage,

    set:
      setLanguage,

    field:
      field,

    apply:
      applyFrenchUI,

    storageKey:
      STORAGE_KEY

  };

  document.documentElement.lang =
    getLanguage();

  // ============================================================
  // 12. SAFE STARTUP
  //
  // NO MutationObserver.
  //
  // A small number of timed passes allows Supabase to finish
  // creating dynamic dropdowns/content.
  //
  // These stop automatically.
  // ============================================================

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      installStyles();

      mountSelector();

      if (
        getLanguage() !== "fr"
      ) {
        return;
      }

      applyFrenchUI();

      const delays = [
        150,
        400,
        800,
        1500,
        2500,
        4000,
        6500
      ];

      delays.forEach(
        delay => {
          setTimeout(
            applyFrenchUI,
            delay
          );
        }
      );

    }
  );

})();
