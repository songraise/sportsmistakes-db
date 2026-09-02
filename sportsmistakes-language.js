/*
  SportsMistakes Language System
  ==================================
  EN / FR language selector

  PRIVACY:
  - No geolocation
  - No IP lookup
  - No language cookie
  - First visit follows the browser's PRIMARY language
  - French browser => FR
  - Otherwise => EN
  - Manual choice stores ONLY "fr" or "en" in localStorage
*/

(() => {

  const STORAGE_KEY = "sportsmistakes_language";
  const VALID_LANGUAGES = new Set(["en", "fr"]);


  // ============================================================
  // 1. LANGUAGE PREFERENCE
  // ============================================================

  function getSavedLanguage() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);

      if (VALID_LANGUAGES.has(value)) {
        return value;
      }

      return null;

    } catch (error) {
      return null;
    }
  }


  function getBrowserLanguage() {

    const primary = String(
      (
        Array.isArray(navigator.languages) &&
        navigator.languages[0]
      ) ||
      navigator.language ||
      "en"
    ).toLowerCase();

    return primary.startsWith("fr") ? "fr" : "en";
  }


  function getLanguage() {
    return getSavedLanguage() || getBrowserLanguage();
  }


  function setLanguage(language) {

    if (!VALID_LANGUAGES.has(language)) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      // If localStorage is unavailable,
      // the site can still function for this visit.
    }

    document.documentElement.lang = language;

    /*
      Reload the page so all Supabase content is rendered
      using the newly selected language.
    */
    window.location.reload();
  }


  // ============================================================
  // 2. DATABASE FIELD SELECTOR
  // ============================================================

  /*
    Example:

    SMLanguage.field(mistake, "title")

    EN:
      returns mistake.title

    FR:
      returns mistake.title_fr

    If the French field is unexpectedly empty,
    it safely falls back to English.
  */

  function field(record, baseName) {

    if (!record) {
      return "";
    }

    const language = getLanguage();

    if (language === "fr") {

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
  // 3. STATIC INTERFACE TRANSLATIONS
  // ============================================================

  const textMap = {

    "Home":
      "Accueil",

    "Rankings":
      "Classements",

    "Collections":
      "Collections",

    "Hall of Fame":
      "Temple de la renommée",

    "Nominate":
      "Proposer",

    "Submit":
      "Proposer",

    "Nominate It":
      "Proposer",

    "Read the Story":
      "Lire l’histoire",

    "Read the Story ›":
      "Lire l’histoire ›",

    "Read →":
      "Lire →",

    "Read Story →":
      "Lire l’histoire →",

    "Next Mistake →":
      "Erreur suivante →",

    "All Sports":
      "Tous les sports",

    "Search the Record":
      "Rechercher dans le registre",

    "Find a Sports Mistake":
      "Trouver une erreur sportive",

    "Back to Database":
      "Retour à la base de données",

    "Loading mistake...":
      "Chargement de l’erreur...",

    "No mistake ID provided.":
      "Aucun identifiant d’erreur fourni.",

    "Mistake not found.":
      "Erreur introuvable.",

    "Controversy Score":
      "Indice de controverse",

    "Fan Verdict":
      "Verdict des partisans",

    "Yes — Mistake":
      "Oui — Erreur",

    "No — Not Really":
      "Non — Pas vraiment",

    "Share":
      "Partager",

    "The Story":
      "L’histoire",

    "Why This Changed Sports":
      "Pourquoi ce moment a compté",

    "Related Mistakes":
      "Erreurs connexes",

    "Sources":
      "Sources",

    "Report":
      "Signaler",

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

    "No related mistakes yet.":
      "Aucune erreur connexe pour le moment.",

    "Could not load related mistakes.":
      "Impossible de charger les erreurs connexes."
  };


  // ============================================================
  // 4. PLACEHOLDER TRANSLATIONS
  // ============================================================

  const placeholderMap = {

    'Search mistakes, people, teams, or lessons like "leadership"...':
      'Rechercher des erreurs, personnes, équipes ou leçons comme « leadership »...',

    "e.g. Buckner lets ball pass through his legs":
      "ex. : Buckner laisse la balle passer entre ses jambes"
  };


  // ============================================================
  // 5. TRANSLATE STATIC PAGE TEXT
  // ============================================================

  function translateSimpleText(root = document) {

    if (getLanguage() !== "fr") {
      return;
    }

    const target = root.body || root;

    if (!target) {
      return;
    }

    const walker = document.createTreeWalker(
      target,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {

          const parent = node.parentElement;

          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          /*
            Never alter JavaScript, CSS or noscript contents.
          */
          if (
            ["SCRIPT", "STYLE", "NOSCRIPT"].includes(
              parent.tagName
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );


    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }


    nodes.forEach(node => {

      const rawText = node.nodeValue || "";
      const trimmedText = rawText.trim();

      if (textMap[trimmedText]) {

        node.nodeValue = rawText.replace(
          trimmedText,
          textMap[trimmedText]
        );
      }

    });


    // ----------------------------------------------------------
    // Translate form placeholders
    // ----------------------------------------------------------

    document
      .querySelectorAll(
        "input[placeholder], textarea[placeholder]"
      )
      .forEach(element => {

        const placeholder =
          element.getAttribute("placeholder");

        if (placeholderMap[placeholder]) {

          element.setAttribute(
            "placeholder",
            placeholderMap[placeholder]
          );
        }

      });


    // ==========================================================
    // 6. HOMEPAGE-SPECIFIC TRANSLATIONS
    // ==========================================================

    const kicker =
      document.querySelector(
        ".home-fast-intro .museum-kicker"
      );

    if (
      kicker &&
      kicker.textContent !==
        "LE REGISTRE PARTICIPATIF DES ERREURS SPORTIVES"
    ) {

      kicker.textContent =
        "LE REGISTRE PARTICIPATIF DES ERREURS SPORTIVES";
    }


    const homeHeadline =
      document.querySelector(
        ".home-fast-intro h1"
      );

    const frenchHomeHeadline =
      'Apprendre des plus grandes <span>erreurs sportives</span> de l’histoire';

    if (
      homeHeadline &&
      homeHeadline.innerHTML !== frenchHomeHeadline
    ) {

      homeHeadline.innerHTML =
        frenchHomeHeadline;
    }


    // ----------------------------------------------------------
    // Nomination box
    // ----------------------------------------------------------

    const nominationTitle =
      document.querySelector(
        ".homepage-nominate-card h2"
      );

    if (
      nominationTitle &&
      nominationTitle.textContent !==
        "Proposer une erreur sportive"
    ) {

      nominationTitle.textContent =
        "Proposer une erreur sportive";
    }


    const nominationCopy =
      document.querySelector(
        ".homepage-nominate-card .nominate-title-row p"
      );

    if (
      nominationCopy &&
      nominationCopy.textContent !==
        "Quelle erreur mérite sa place dans le registre?"
    ) {

      nominationCopy.textContent =
        "Quelle erreur mérite sa place dans le registre?";
    }


    // ----------------------------------------------------------
    // Search area
    // ----------------------------------------------------------

    const searchKicker =
      document.querySelector(
        ".top-search .engage-kicker"
      );

    if (
      searchKicker &&
      searchKicker.textContent !==
        "RECHERCHER DANS LE REGISTRE"
    ) {

      searchKicker.textContent =
        "RECHERCHER DANS LE REGISTRE";
    }


    const searchTitle =
      document.querySelector(
        ".top-search h2"
      );

    if (
      searchTitle &&
      searchTitle.textContent !==
        "Trouver une erreur sportive"
    ) {

      searchTitle.textContent =
        "Trouver une erreur sportive";
    }


    const searchCopy =
      document.querySelector(
        ".top-search .search-topline p"
      );

    if (
      searchCopy &&
      searchCopy.textContent !==
        "Recherchez par moment, athlète, équipe, sport, année ou leçon."
    ) {

      searchCopy.textContent =
        "Recherchez par moment, athlète, équipe, sport, année ou leçon.";
    }


    // ----------------------------------------------------------
    // Logo tagline
    // ----------------------------------------------------------

    const brandTag =
      document.querySelector(".brand-tag");

    if (brandTag) {

      brandTag.innerHTML =
        "La base de données Internet<br>des erreurs sportives";
    }

  }


  // ============================================================
  // 7. EN / FR SELECTOR
  // ============================================================

  function mountSelector() {

    /*
      Try the normal SportsMistakes navigation containers.
    */

    const navigation =
      document.querySelector(".nav-links") ||
      document.querySelector(".top-nav");


    if (!navigation) {
      return;
    }


    /*
      Prevent duplicate selectors.
    */

    if (
      document.getElementById(
        "smLanguageSwitch"
      )
    ) {
      return;
    }


    const currentLanguage =
      getLanguage();


    const wrapper =
      document.createElement("div");


    wrapper.id =
      "smLanguageSwitch";


    wrapper.className =
      "sm-language-switch";


    wrapper.setAttribute(
      "aria-label",
      currentLanguage === "fr"
        ? "Choix de langue"
        : "Language selection"
    );


    /*
      IMPORTANT:
      EN first, then FR.
    */

    wrapper.innerHTML = `
      <button
        type="button"
        data-lang="en"
        class="${currentLanguage === "en" ? "active" : ""}"
        aria-pressed="${currentLanguage === "en"}"
      >
        EN
      </button>

      <span aria-hidden="true">/</span>

      <button
        type="button"
        data-lang="fr"
        class="${currentLanguage === "fr" ? "active" : ""}"
        aria-pressed="${currentLanguage === "fr"}"
      >
        FR
      </button>
    `;


    wrapper
      .querySelectorAll("button")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const selectedLanguage =
              button.dataset.lang;

            setLanguage(
              selectedLanguage
            );
          }
        );

      });


    navigation.appendChild(wrapper);
  }


  // ============================================================
  // 8. SELECTOR STYLING
  // ============================================================

  function installStyles() {

    /*
      Don't install styles twice.
    */

    if (
      document.getElementById(
        "smLanguageStyles"
      )
    ) {
      return;
    }


    const style =
      document.createElement("style");


    style.id =
      "smLanguageStyles";


    style.textContent = `

      .sm-language-switch {

        display: inline-flex;

        align-items: center;

        gap: 5px;

        margin-left: 4px;

        padding: 5px 8px;

        border:
          1px solid
          rgba(255,255,255,.18);

        border-radius: 999px;

        background:
          rgba(255,255,255,.04);

        color: #a8b3c1;

        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 12px;

        font-weight: 900;

        letter-spacing: .5px;

        white-space: nowrap;

      }


      .sm-language-switch button {

        appearance: none;

        border: 0;

        background: transparent;

        color: #a8b3c1;

        padding: 3px 4px;

        margin: 0;

        cursor: pointer;

        font: inherit;

        line-height: 1;

      }


      .sm-language-switch button.active {

        color: #ffffff;

      }


      .sm-language-switch button:hover {

        color: #ff6464;

      }


      @media (max-width: 760px) {

        .sm-language-switch {

          margin-left: 0;

        }

      }

    `;


    document.head.appendChild(style);
  }


  // ============================================================
  // 9. MAKE LANGUAGE FUNCTIONS AVAILABLE TO OTHER FILES
  // ============================================================

  window.SMLanguage = {

    /*
      Get current language:
      SMLanguage.get()
    */

    get: getLanguage,


    /*
      Change language:
      SMLanguage.set("fr")
      SMLanguage.set("en")
    */

    set: setLanguage,


    /*
      Retrieve translated database field:
      SMLanguage.field(record, "title")
    */

    field: field,


    /*
      Expose storage key for debugging if necessary.
    */

    storageKey: STORAGE_KEY

  };


  // ============================================================
  // 10. SET HTML LANGUAGE IMMEDIATELY
  // ============================================================

  document.documentElement.lang =
    getLanguage();


  // ============================================================
  // 11. START AFTER PAGE LOADS
  // ============================================================

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      installStyles();

      mountSelector();

      translateSimpleText();


      /*
        SportsMistakes loads some material dynamically
        from Supabase.

        Watch for newly inserted page elements so static
        interface labels added later can also become French.

        This DOES NOT make any network request.
      */

      const observer =
        new MutationObserver(
          () => {

            if (
              getLanguage() === "fr"
            ) {

              translateSimpleText();
            }

          }
        );


      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

    }
  );

})();
