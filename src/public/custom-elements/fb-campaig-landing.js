/*!
 * <sharon-start> — generic lead-entry page for Sharon Homes (powered by immopi)
 * Version 20261013-1 · vanilla Web Component, no dependencies, Shadow DOM.
 *
 * Same conventions as the existing <sharon-landing> element (#sh root, CSS vars,
 * .bar/.brand/.lang, .recog, .hello, .because, .go, .meta, .value/.vcard, .powered).
 *
 * Wix build: intent chips removed; the CTA opens the immopi widget in place.
 *
 * Usage (Wix custom element, tag name "sharon-landing" — same as the old element):
 *   <sharon-landing
 *     data-endpoint="https://api.example.com/v1/leads"   lead POST (optional; empty = skip POST)
 *     data-chat-url="/start"                             fallback redirect if the widget is missing
 *     data-required="name,email,phone"                   which fields are required
 *     data-timeout="2500"></sharon-landing>                ms to wait for the POST before continuing
 *
 * Language, first match wins:
 *   ?hl  >  ?lang  >  Wix path segment (/de/start)  >  browser language  >  <html lang>  >  data-default-lang (he)
 *   Wix 301s ?lang=en (main language) to /start and drops it, so that lands on the
 *   browser language. English ads that must stay English use ?hl=en, which Wix keeps.
 * ?intent=... is still read and sent in the lead payload, but no longer shown.
 * On submit:  [POST lead]  →  ImmopiChatbot.openFull({ name, email, phone[, message] })
 *             Fallback if the widget is not on the page: redirect to
 *             {chatUrl}?pi-mode=full&name=<first name>&lang=<lang>&pi-locale=<locale>&intent=<id>  (never email/phone).
 *
 * Hides the immopi floating launcher on this page (data-hide-launcher="false" keeps it).
 * Console:  document.querySelector('sharon-landing').debug()
 */
(function () {
  'use strict';

  var VERSION = '20261016-wix11';
  /* Used when the element has no data-* attribute set in Wix. */
  var DEFAULTS = {
    chatUrl: 'https://w.immopi.ai/',
    defaultLang: 'en',
    message: ''   /* overrides the per-language I18N message for every language; empty = use I18N */
  };
  var SUPPORTED = ['he', 'en', 'de', 'fr', 'nl'];
  var LANG_NAMES = { he: 'עברית', en: 'English', de: 'Deutsch', fr: 'Français', nl: 'Nederlands' };
  /* What goes in the fallback's ?pi-locale=. Change values here only (e.g. he: 'he-IL'). */
  var LOCALES = { he: 'he', en: 'en', de: 'de', fr: 'fr', nl: 'nl' };
  /* Intent ids used by the earlier ad URLs; still accepted so old links keep their intent. */
  var LEGACY_INTENTS = ['yield', 'sea', 'general'];
  var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600&family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap';
  var INTENT_IDS = ['family', 'investment', 'holiday', 'residency', 'retirement', 'explore'];

  /* ------------------------------------------------------------------ i18n */
  var I18N = {
    en: {
      message: 'I’m looking for a property in Cyprus to buy or rent',  /* first chat message, sent with openFull */
      eyebrow: 'Welcome to Sharon Homes',
      h1: 'We were expecting you.',
      lead: 'Tell me what you’re after and I’ll show you the properties that genuinely fit — then connect you to an advisor.',
      intentLabel: 'I’m looking for',
      intents: { family: 'A family home', investment: 'An investment', holiday: 'A holiday home', residency: 'Permanent residency', retirement: 'Retirement by the sea', explore: 'Just exploring' },
      contactLabel: 'So your advisor can reach you',
      namePh: 'Full name', emailPh: 'Email', phonePh: 'Phone or WhatsApp',
      privacy: 'Your details go only to your advisor',
      cta: 'Show me what fits', sending: 'One moment…', meta1: 'About 90 seconds',
      errName: 'Please enter your name.', errEmail: 'Please enter a valid email address.', errPhone: 'Please enter a valid phone number.',
      vt: ['Real homes, right now', 'You won’t repeat yourself', 'A call worth taking'],
      vd: ['Available properties — not a brochure or a mailing list.', 'Everything you tell me goes straight to your advisor.', 'They call already knowing your budget, area and timing.']
    },
    de: {
      message: 'Ich suche eine Immobilie auf Zypern zum Kauf oder zur Miete',  /* first chat message, sent with openFull */
      eyebrow: 'Willkommen bei Sharon Homes',
      h1: 'Wir haben Sie erwartet.',
      lead: 'Sagen Sie mir, was Sie suchen, und ich zeige Ihnen die Objekte, die wirklich passen — und verbinde Sie dann mit einem Berater.',
      intentLabel: 'Ich suche',
      intents: { family: 'Ein Zuhause für die Familie', investment: 'Eine Kapitalanlage', holiday: 'Ein Ferienhaus', residency: 'Daueraufenthalt (Residency)', retirement: 'Ruhestand am Meer', explore: 'Ich schaue mich erst um' },
      contactLabel: 'Damit Ihr Berater Sie erreicht',
      namePh: 'Vor- und Nachname', emailPh: 'E-Mail', phonePh: 'Telefon oder WhatsApp',
      privacy: 'Ihre Daten gehen nur an Ihren Berater',
      cta: 'Passende Objekte zeigen', sending: 'Einen Moment…', meta1: 'Etwa 90 Sekunden',
      errName: 'Bitte geben Sie Ihren Namen ein.', errEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', errPhone: 'Bitte geben Sie eine gültige Telefonnummer ein.',
      vt: ['Echte Objekte, sofort', 'Sie wiederholen sich nicht', 'Ein Gespräch, das sich lohnt'],
      vd: ['Verfügbare Immobilien — kein Prospekt, kein Verteiler.', 'Alles, was Sie mir sagen, geht direkt an Ihren Berater.', 'Ihr Berater kennt beim Anruf bereits Budget, Region und Zeitrahmen.']
    },
    nl: {
      message: 'Ik zoek een woning op Cyprus om te kopen of te huren',  /* first chat message, sent with openFull */
      eyebrow: 'Welkom bij Sharon Homes',
      h1: 'We verwachtten u al.',
      lead: 'Vertel wat u zoekt en ik laat u de woningen zien die echt passen — en breng u daarna in contact met een adviseur.',
      intentLabel: 'Ik zoek',
      intents: { family: 'Een gezinswoning', investment: 'Een belegging', holiday: 'Een vakantiewoning', residency: 'Permanent verblijf (residency)', retirement: 'Pensioen aan zee', explore: 'Ik kijk nog rond' },
      contactLabel: 'Zodat uw adviseur u kan bereiken',
      namePh: 'Volledige naam', emailPh: 'E-mail', phonePh: 'Telefoon of WhatsApp',
      privacy: 'Uw gegevens gaan alleen naar uw adviseur',
      cta: 'Laat zien wat past', sending: 'Een moment…', meta1: 'Ongeveer 90 seconden',
      errName: 'Vul uw naam in.', errEmail: 'Vul een geldig e-mailadres in.', errPhone: 'Vul een geldig telefoonnummer in.',
      vt: ['Echte woningen, nu meteen', 'U hoeft zich niet te herhalen', 'Een gesprek dat de moeite waard is'],
      vd: ['Beschikbare woningen — geen brochure of mailinglijst.', 'Alles wat u mij vertelt, gaat rechtstreeks naar uw adviseur.', 'Uw adviseur belt en kent al uw budget, regio en planning.']
    },
    fr: {
      message: 'Je cherche un bien immobilier à Chypre à acheter ou à louer',  /* first chat message, sent with openFull */
      eyebrow: 'Bienvenue chez Sharon Homes',
      h1: 'Nous vous attendions.',
      lead: 'Dites-moi ce que vous recherchez et je vous montre les biens qui vous correspondent vraiment — puis je vous mets en relation avec un conseiller.',
      intentLabel: 'Je cherche',
      intents: { family: 'Une maison pour la famille', investment: 'Un investissement', holiday: 'Une résidence de vacances', residency: 'La résidence permanente', retirement: 'La retraite au bord de la mer', explore: 'Je me renseigne' },
      contactLabel: 'Pour que votre conseiller puisse vous joindre',
      namePh: 'Nom complet', emailPh: 'E-mail', phonePh: 'Téléphone ou WhatsApp',
      privacy: 'Vos coordonnées vont uniquement à votre conseiller',
      cta: 'Montrez-moi ce qui correspond', sending: 'Un instant…', meta1: 'Environ 90 secondes',
      errName: 'Veuillez saisir votre nom.', errEmail: 'Veuillez saisir une adresse e-mail valide.', errPhone: 'Veuillez saisir un numéro de téléphone valide.',
      vt: ['De vrais biens, tout de suite', 'Vous ne vous répéterez pas', 'Un appel qui en vaut la peine'],
      vd: ['Des biens disponibles — ni brochure ni liste de diffusion.', 'Tout ce que vous me dites va directement à votre conseiller.', 'Votre conseiller appelle en connaissant déjà budget, secteur et calendrier.']
    },
    he: {
      message: 'אני מחפש/ת נכס בקפריסין לקנייה או להשכרה',  /* first chat message, sent with openFull */
      eyebrow: 'ברוכים הבאים ל-Sharon Homes',
      h1: 'אנחנו כבר מחכים לכם.',
      lead: 'ספרו לי מה אתם מחפשים ואראה לכם את הנכסים שבאמת מתאימים — ואז אחבר אתכם ליועץ.',
      intentLabel: 'אני מחפש/ת',
      intents: { family: 'בית למשפחה', investment: 'השקעה', holiday: 'בית נופש', residency: 'תושבות קבע בקפריסין', retirement: 'פרישה ליד הים', explore: 'רק מתעניין/ת בינתיים' },
      contactLabel: 'כדי שהיועץ יוכל ליצור איתכם קשר',
      namePh: 'שם מלא', emailPh: 'אימייל', phonePh: 'טלפון או וואטסאפ',
      privacy: 'הפרטים מגיעים רק ליועץ שלכם',
      cta: 'הראו לי מה מתאים', sending: 'רגע…', meta1: 'כ-90 שניות',
      errName: 'נא להזין שם.', errEmail: 'נא להזין כתובת אימייל תקינה.', errPhone: 'נא להזין מספר טלפון תקין.',
      vt: ['נכסים אמיתיים, עכשיו', 'לא תצטרכו לחזור על עצמכם', 'שיחה ששווה את הזמן שלכם'],
      vd: ['נכסים זמינים — לא ברושור ולא רשימת תפוצה.', 'כל מה שתספרו לי עובר ישירות ליועץ שלכם.', 'היועץ מתקשר כשהוא כבר מכיר תקציב, אזור ותזמון.']
    }
  };

  /* ------------------------------------------------------------------ icons (inline stroke SVG) */
  function svg(d, size, extra) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (extra || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"></path></svg>';
  }
  var PATHS = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    chevron: 'M6 9l6 6 6-6',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    eye: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    checkbox: 'M4.5 4.5h15v15h-15z M8.5 12.2l2.4 2.4 4.8-5.2',
    phone: 'M5.5 3.5h3.3l1.6 4.2-2.1 1.5a12 12 0 0 0 6.5 6.5l1.5-2.1 4.2 1.6v3.3a2 2 0 0 1-2 2A16 16 0 0 1 3.5 5.5a2 2 0 0 1 2-2z',
    family: 'M3.5 11.5 12 4.5l8.5 7 M5.5 10.5V20h13v-9.5 M10 20v-5.5h4V20',
    investment: 'M3.5 17l5.5-5.5 4 4 7.5-7.5 M14.5 8h6v6',
    holiday: 'M12 3.5v2 M12 18.5v2 M3.5 12h2 M18.5 12h2 M6 6l1.4 1.4 M16.6 16.6 18 18 M6 18l1.4-1.4 M16.6 7.4 18 6 M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
    residency: 'M3.5 5.5h17v13h-17z M7.5 12.5a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 0 0-4.6 0z M6.5 16.5c.8-1.6 2-2.3 3.3-2.3s2.5.7 3.3 2.3 M15 10h3 M15 13h3',
    retirement: 'M3.5 16.5h17 M7.5 13.5a4.5 4.5 0 0 1 9 0 M12 6v2 M5.5 9.5l1.4 1.4 M18.5 9.5l-1.4 1.4 M3.5 20.5c1.4-1.2 2.8-1.2 4.2 0s2.8 1.2 4.2 0 2.8-1.2 4.2 0 2.8 1.2 4.2 0',
    explore: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M15.3 8.7l-1.9 4.7-4.7 1.9 1.9-4.7z'
  };
  var VALUE_ICONS = ['eye', 'checkbox', 'phone'];
  /* Official immopi wordmark, same as <sharon-landing>. */
  var IMMOPI_MARK = '<svg viewBox="0 0 71 25" role="img" aria-label="immopi"><path d="M26.75 7.24c0-.54.44-.98 1.03-.98s1.03.44 1.03.98-.44.96-1.03.96-1.03-.4-1.03-.96m42.18 0c0-.54.44-.98 1.03-.98S71 6.7 71 7.24s-.44.96-1.03.96-1.03-.4-1.03-.96m-42 1.94h1.7v6.66h-1.7zM30.2 9.18h1.52v.96q.63-1.17 2.02-1.17c1 0 1.71.47 2.07 1.3a2.2 2.2 0 0 1 2.1-1.3c1.43 0 2.31.98 2.31 2.6v4.28h-1.69v-4q0-1.43-1.05-1.42c-.77 0-1.42.6-1.42 2.02v3.4h-1.7v-4q0-1.43-1.05-1.42c-.8 0-1.43.64-1.43 2.02v3.4h-1.69V9.18zM41.68 9.18h1.53v.96c.4-.78 1.1-1.17 2.01-1.17 1 0 1.71.47 2.07 1.3a2.2 2.2 0 0 1 2.1-1.3c1.43 0 2.31.98 2.31 2.6v4.28h-1.68v-4q0-1.43-1.06-1.42c-.76 0-1.42.6-1.42 2.02v3.4h-1.69v-4q0-1.43-1.05-1.42c-.8 0-1.44.64-1.44 2.02v3.4h-1.69zM52.82 12.51c0-2.13 1.36-3.54 3.5-3.54s3.46 1.4 3.46 3.54c0 2.13-1.36 3.55-3.47 3.55-2.1 0-3.49-1.42-3.49-3.55m5.24 0c0-1.28-.7-2.12-1.75-2.12s-1.76.84-1.76 2.12.7 2.1 1.76 2.1c1.07 0 1.75-.82 1.75-2.1M61 9.18h1.53v1a2.6 2.6 0 0 1 2.3-1.21c1.76 0 3 1.35 3 3.54s-1.24 3.54-3 3.54q-1.38-.01-2.14-1v3.43H61zm5.12 3.33c0-1.28-.67-2.1-1.71-2.1s-1.77.82-1.77 2.1.71 2.12 1.77 2.12c1.05 0 1.71-.84 1.71-2.12M69.12 9.18h1.69v6.66h-1.7zM11.15 24.93q-.7 0-1.33-.36l-8.49-4.9A2.7 2.7 0 0 1 0 17.37v-9.8c0-.95.51-1.84 1.33-2.31L9.82.36a2.7 2.7 0 0 1 2.66 0l8.49 4.9a2.7 2.7 0 0 1 1.33 2.3v9.8c0 .95-.5 1.84-1.33 2.31l-8.49 4.9q-.62.36-1.33.36zm0-23.37q-.29 0-.55.15l-8.48 4.9c-.34.2-.56.56-.56.96v9.8c0 .39.22.75.56.95l8.48 4.9c.34.2.76.2 1.1 0l8.49-4.9c.34-.2.55-.56.55-.96v-9.8c0-.39-.21-.75-.55-.95l-8.49-4.9q-.26-.15-.55-.15"></path><path d="M8.42 10.53H6.87v6.42h1.55zM16.05 15.75a1.9 1.9 0 0 1-1.9-1.9V8.72h1.75V7.17H9.43a2 2 0 0 1 0 1.56h3.16v5.11a3.47 3.47 0 0 0 3.46 3.47h.78v-1.56zM8.5 8.3a.93.93 0 1 0-1.72-.7.93.93 0 0 0 1.72.7"></path></svg>';

  /* ------------------------------------------------------------------ styles */
  var CSS = [
    ':host{display:block}',
    '#sh{--gold:#a8834f;--gold-soft:#f4ede1;--gold-line:#ece0cd;--ink:#1a1a18;--ink-25:#b5b0a6;--ink-50:#6f6b63;--ink-70:#4a4844;--line:#e8e4dd;--line-2:#f2efe9;--paper:#fffefc;--paper-2:#faf8f4;--err:#b4533a;--radius:14px;',
    "--sans:'Inter',system-ui,-apple-system,sans-serif;--serif:'Cormorant Garamond',Georgia,serif;",
    'font-family:var(--sans);color:var(--ink);background:var(--paper);min-height:100vh;font-size:15px;line-height:1.5;letter-spacing:-.005em;-webkit-font-smoothing:antialiased}',
    "#sh[dir=rtl]{--sans:'Assistant','Inter',system-ui,sans-serif;--serif:'Assistant','Inter',system-ui,sans-serif}",
    '#sh *,#sh *::before,#sh *::after{box-sizing:border-box}',
    '#sh button{font-family:inherit;cursor:pointer;color:inherit;background:none;border:none;margin:0}',
    '#sh ::selection{background:var(--ink);color:#fff}',
    '#sh :focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:8px}',
    '.sh-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    /* bar: brand + language only. No nav, no exits. */
    '#sh .bar{position:sticky;top:0;z-index:40;height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,4vw,34px);padding-top:env(safe-area-inset-top);background:rgba(255,254,252,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line-2)}',
    '#sh .brand{display:flex;flex-direction:column;align-items:center;gap:3px;user-select:none;direction:ltr}',
    "#sh .brand .b1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:19px;line-height:1;letter-spacing:.2em;padding-left:.2em;color:var(--ink)}",
    '#sh .brand .rule{display:block;align-self:stretch;height:1px;background:var(--gold)}',
    "#sh .brand .b2{font-family:'Inter',system-ui,sans-serif;font-weight:500;font-size:7.5px;line-height:1;letter-spacing:.3em;padding-left:.3em;color:var(--gold)}",
    '#sh .langwrap{position:relative;display:inline-flex;align-items:center}',
    '#sh .lang{appearance:none;-webkit-appearance:none;height:31px;padding-inline:14px 30px;border-radius:999px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer}',
    '#sh .langwrap svg{position:absolute;inset-inline-end:11px;pointer-events:none;color:var(--ink-50)}',
    /* main column */
    '#sh .w{display:flex;flex-direction:column;align-items:center;text-align:center;padding:clamp(32px,3vw,44px) 24px 44px}',
    '#sh .recog{display:inline-flex;align-items:center;gap:9px;padding:8px 16px;border-radius:999px;background:var(--gold-soft);border:1px solid var(--gold-line);color:var(--ink-70);font-size:12.5px;font-weight:600;letter-spacing:.02em;margin-bottom:20px}',
    '#sh .recog svg{color:var(--gold)}',
    '#sh .hello{margin:0 0 12px;max-width:580px;font-family:var(--serif);font-weight:500;font-size:clamp(38px,2.2vw + 24px,54px);line-height:1.08;letter-spacing:-.015em;text-wrap:balance}',
    '#sh[dir=rtl] .hello{letter-spacing:0;font-weight:600}',
    '#sh .because{margin:0 0 26px;max-width:520px;font-size:clamp(16px,.4vw + 12px,17.5px);line-height:1.55;color:var(--ink-50)}',
    /* action panel */
    '#sh .act{display:flex;flex-direction:column;align-items:center;width:100%;max-width:640px;margin:0;padding:24px clamp(18px,1.8vw,26px) 26px;border-radius:18px;background:var(--paper-2);border:1px solid var(--line-2)}',
    '#sh .lbl{font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-50);margin-bottom:12px}',
    '#sh .fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%;margin-bottom:14px}',
    '#sh .f input{width:100%;height:48px;padding:0 16px;border-radius:12px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-family:inherit;font-size:15px;outline:none;transition:border-color .18s}',
    '#sh .f input::placeholder{color:#a39e95}',
    '#sh .f input:focus{border-color:var(--ink)}',
    '#sh .f input[aria-invalid=true]{border-color:var(--err)}',
    '#sh .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}',
    '#sh .err{margin:-4px 0 12px;font-size:12.5px;line-height:1.4;color:var(--err)}',
    '#sh .err:empty{display:none}',
    '#sh .go{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:440px;padding:17px 22px;border-radius:13px;background:var(--ink);color:#fff;font-size:16px;font-weight:600;letter-spacing:-.01em;box-shadow:0 10px 26px -12px rgba(26,26,24,.5);transition:transform .18s,box-shadow .18s,opacity .18s}',
    '#sh .go:hover{transform:translateY(-1px);box-shadow:0 14px 30px -12px rgba(26,26,24,.55)}',
    '#sh .go[disabled]{opacity:.7;cursor:progress;transform:none}',
    '#sh[dir=rtl] .go svg{transform:scaleX(-1)}',
    '#sh .meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-top:12px;font-size:12.5px;color:var(--ink-50)}',
    '#sh .meta .d{width:3px;height:3px;border-radius:50%;background:var(--ink-25)}',
    /* compact value cards */
    '#sh .value{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%;max-width:640px;margin-top:22px;text-align:start}',
    '#sh .vcard{display:flex;align-items:flex-start;gap:11px;padding:14px 14px 15px;border-radius:var(--radius);background:var(--paper);border:1px solid var(--line)}',
    '#sh .vicon{display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;border-radius:9px;background:var(--paper-2);border:1px solid var(--line-2);color:var(--gold)}',
    '#sh .vtext{min-width:0}',
    '#sh .vt{font-size:13.5px;font-weight:600;letter-spacing:-.01em;line-height:1.3}',
    '#sh .vd{font-size:12.5px;line-height:1.5;color:var(--ink-50);margin-top:3px}',
    /* powered by immopi */
    "#sh .powered{display:inline-flex;align-items:center;gap:7px;margin-top:30px;direction:ltr;font-family:'Inter',system-ui,sans-serif;font-size:10.5px;letter-spacing:.06em;color:var(--ink-50);font-weight:500;user-select:none}",
    '#sh .powered .rule{width:22px;height:1px;background:var(--line)}',
    '#sh .powered .mk{display:inline-flex;align-items:center;gap:4px;color:var(--ink)}',
    '#sh .powered .mk svg{height:17px;width:auto;display:block}',
    '#sh .powered .mk-text{font-size:12px;letter-spacing:0;font-weight:600}',
    /* responsive */
    '@media(max-width:760px){#sh .fields{grid-template-columns:1fr}#sh .value{grid-template-columns:1fr}}',
    '@media(prefers-reduced-motion:reduce){#sh *{transition:none!important}#sh .go:hover{transform:none}}'
  ].join('\n');

  /* ------------------------------------------------------------------ helpers */
  /* @font-face is document-scoped: fonts must be linked in the real <head>,
     a stylesheet inside the shadow root would not load them. */
  function ensureFonts() {
    if (document.getElementById('sh-font-css')) return;
    [['preconnect', 'https://fonts.googleapis.com'], ['preconnect', 'https://fonts.gstatic.com', true], ['stylesheet', FONT_CSS]].forEach(function (a) {
      var l = document.createElement('link');
      l.rel = a[0]; l.href = a[1];
      if (a[2]) l.crossOrigin = 'anonymous';
      if (a[0] === 'stylesheet') l.id = 'sh-font-css';
      document.head.appendChild(l);
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function normalizePhone(v) { return String(v || '').replace(/[\s().-]/g, ''); }
  function validPhone(v) { var n = normalizePhone(v); return /^\+?\d{7,15}$/.test(n); }

  /* The immopi widget's floating launcher ("Ask anything" + chat bubble) is
     redundant here: our CTA opens the full chat. Page CSS cannot hide it — the
     widget pins `display: contents !important` inline on #pi-widget-root — but
     its shadow root is open, so a style injected inside it can. openFull()
     renders in a separate #pi-full-root, which this does not touch.
     The widget loads deferred, possibly after us, so keep watching until it shows. */
  function hideImmopiLauncher() {
    function apply() {
      var host = document.getElementById('pi-widget-root');
      var root = host && host.shadowRoot;
      if (!root) return false;
      if (!root.getElementById('sh-hide-launcher')) {
        var st = document.createElement('style');
        st.id = 'sh-hide-launcher';
        st.textContent = '*{display:none!important}';
        root.appendChild(st);
      }
      return true;
    }
    if (apply() || !window.MutationObserver) return;
    var mo = new MutationObserver(function () { if (apply()) mo.disconnect(); });
    mo.observe(document.body, { childList: true });
    setTimeout(function () { mo.disconnect(); }, 30000);
  }

  /* ------------------------------------------------------------------ element */
  class SharonStart extends HTMLElement {
    static get observedAttributes() { return ['data-chat-url', 'chat-url', 'data-default-lang', 'default-lang']; }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._s = { lang: 'en', intent: null, name: '', email: '', phone: '', busy: false };
    }
    get config() {
      return {
        endpoint: this.getAttribute('data-endpoint') || '',
        /* data-* names from the client's file; plain names from the old <sharon-landing>. */
        chatUrl: this.getAttribute('data-chat-url') || this.getAttribute('chat-url') || DEFAULTS.chatUrl,
        message: this.getAttribute('data-message') || DEFAULTS.message,
        defaultLang: this.getAttribute('data-default-lang') || this.getAttribute('default-lang') || DEFAULTS.defaultLang,
        timeoutMs: parseInt(this.getAttribute('data-timeout') || '2500', 10) || 2500,
        required: (this.getAttribute('data-required') || 'name,email,phone').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      };
    }
  }

  SharonStart.prototype.connectedCallback = function () {
    var p = new URLSearchParams(location.search);
    var r = this._resolveLang();
    this._s.lang = r.lang;
    this._langSource = r.source;
    var intent = p.get('intent');
    if (INTENT_IDS.indexOf(intent) >= 0 || LEGACY_INTENTS.indexOf(intent) >= 0) this._s.intent = intent;
    /* Prefill from the ad URL (?name=), as the old page used it. Control chars stripped. */
    if (!this._s.name) this._s.name = (p.get('name') || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 60);
    ensureFonts();
    if (this.getAttribute('data-hide-launcher') !== 'false') hideImmopiLauncher();
    if (!this._logged) { this._logged = true; console.info('[sharon-landing] build ' + VERSION); }
    this.setAttribute('data-version', VERSION);
    this._render();
    this._observeLang();
    this._track('view', { lang: this._s.lang, intent: this._s.intent });
  };

  /* "de", "de-DE", "DE" -> "de"; "iw" -> "he"; anything else -> null. */
  function normLang(v) {
    if (!v) return null;
    var code = String(v).toLowerCase().split(/[-_]/)[0];
    if (code === 'iw') code = 'he';
    return SUPPORTED.indexOf(code) >= 0 ? code : null;
  }
  /* Wix Multilingual turns ?lang=de into /de/start (or /site/de/start on a free URL). */
  function langFromPath(pathname) {
    var parts = String(pathname || '').split('/');
    for (var i = 0; i < parts.length; i++) {
      if (SUPPORTED.indexOf(parts[i].toLowerCase()) >= 0) return parts[i].toLowerCase();
    }
    return null;
  }

  /* First supported language in the visitor's browser preference list. */
  function browserLang() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var l = normLang(list[i]);
      if (l) return l;
    }
    return null;
  }

  SharonStart.prototype._resolveLang = function () {
    var q = new URLSearchParams(location.search);
    var signals = [
      ['hl', normLang(q.get('hl'))],
      ['lang', normLang(q.get('lang'))],
      ['path', langFromPath(location.pathname)],
      ['browser', browserLang()],
      ['html', normLang(document.documentElement.getAttribute('lang'))]
    ];
    for (var i = 0; i < signals.length; i++) {
      if (signals[i][1]) return { lang: signals[i][1], source: signals[i][0] };
    }
    return { lang: normLang(this.config.defaultLang) || 'he', source: 'default' };
  };

  /* Wix may switch language client-side and update <html lang>. Follow it,
     unless the visitor already picked a language in our own switcher. */
  SharonStart.prototype._observeLang = function () {
    if (this._langObserver || !window.MutationObserver) return;
    var self = this;
    this._langObserver = new MutationObserver(function () {
      if (self._userPickedLang) return;
      var r = self._resolveLang();
      if (r.lang === self._s.lang) return;
      self._readInputs();
      self._s.lang = r.lang;
      self._langSource = r.source;
      self._render();
    });
    this._langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  };

  SharonStart.prototype.attributeChangedCallback = function () {
    if (!this.shadowRoot.getElementById('sh') || this._userPickedLang) return;
    var r = this._resolveLang();
    if (r.source !== 'default' || r.lang === this._s.lang) return;
    this._readInputs();
    this._s.lang = r.lang;
    this._render();
  };

  SharonStart.prototype.disconnectedCallback = function () {
    if (this._langObserver) { this._langObserver.disconnect(); this._langObserver = null; }
  };

  SharonStart.prototype.debug = function () {
    return {
      version: VERSION,
      lang: this._s.lang,
      langSource: this._langSource,
      wixSignals: {
        query: location.search,
        pathLang: langFromPath(location.pathname),
        htmlLang: document.documentElement.getAttribute('lang')
      },
      widget: !!(window.ImmopiChatbot && typeof window.ImmopiChatbot.openFull === 'function'),
      config: this.config
    };
  };
  SharonStart.prototype._t = function () { return I18N[this._s.lang] || I18N.en; };

  SharonStart.prototype._render = function () {
    var s = this._s, t = this._t(), dir = s.lang === 'he' ? 'rtl' : 'ltr';
    var langOpts = SUPPORTED.map(function (l) {
      return '<option value="' + l + '"' + (l === s.lang ? ' selected' : '') + '>' + LANG_NAMES[l] + '</option>';
    }).join('');
    var cards = VALUE_ICONS.map(function (ic, i) {
      return '<div class="vcard"><div class="vicon">' + svg(PATHS[ic], 15) + '</div><div class="vtext"><div class="vt">' + esc(t.vt[i]) + '</div><div class="vd">' + esc(t.vd[i]) + '</div></div></div>';
    }).join('');
    function field(id, name, type, extra, ph, val) {
      return '<div class="f"><label class="sh-sr" for="' + id + '">' + esc(ph) + '</label><input id="' + id + '" name="' + name + '" type="' + type + '" ' + extra + ' placeholder="' + esc(ph) + '" value="' + esc(val) + '"></div>';
    }
    this.shadowRoot.innerHTML =
      '<style>' + CSS + '</style>' +
      '<div id="sh" lang="' + s.lang + '" dir="' + dir + '">' +
        '<header class="bar">' +
          '<div class="brand" role="img" aria-label="Sharon Homes · Cyprus · Greece"><span class="b1">SHARON HOMES</span><span class="rule"></span><span class="b2">CYPRUS · GREECE</span></div>' +
          '<div class="langwrap"><label class="sh-sr" for="shLang">Language</label><select class="lang" id="shLang">' + langOpts + '</select>' + svg(PATHS.chevron, 12, 2) + '</div>' +
        '</header>' +
        '<main class="w">' +
          '<div class="recog">' + svg(PATHS.check, 13, 2.2) + '<span>' + esc(t.eyebrow) + '</span></div>' +
          '<h1 class="hello">' + esc(t.h1) + '</h1>' +
          '<p class="because">' + esc(t.lead) + '</p>' +
          '<form class="act" id="shForm" novalidate>' +
            '<div class="lbl">' + esc(t.contactLabel) + '</div>' +
            '<div class="fields">' +
              field('shName', 'name', 'text', 'autocomplete="name"', t.namePh, s.name) +
              field('shEmail', 'email', 'email', 'inputmode="email" autocomplete="email"', t.emailPh, s.email) +
              field('shPhone', 'phone', 'tel', 'inputmode="tel" autocomplete="tel"', t.phonePh, s.phone) +
            '</div>' +
            '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
            '<p class="err" id="shErr" role="alert" aria-live="polite"></p>' +
            '<button type="submit" class="go" id="shGo"><span id="shGoLabel">' + esc(t.cta) + '</span>' + svg(PATHS.arrow, 16, 2) + '</button>' +
            '<div class="meta"><span>' + esc(t.meta1) + '</span><span class="d" aria-hidden="true"></span><span>' + esc(t.privacy) + '</span></div>' +
          '</form>' +
          '<div class="value">' + cards + '</div>' +
          '<div class="powered"><span class="rule" aria-hidden="true"></span><span>Powered by</span><span class="mk">' + IMMOPI_MARK + '</span><span class="rule" aria-hidden="true"></span></div>' +
        '</main>' +
      '</div>';
    this._bind();
  };

  SharonStart.prototype._bind = function () {
    var self = this, r = this.shadowRoot;
    r.getElementById('shLang').addEventListener('change', function (e) { self._setLang(e.target.value); });
    r.getElementById('shForm').addEventListener('submit', function (e) { self._submit(e); });
    ['shName', 'shEmail', 'shPhone'].forEach(function (id) {
      r.getElementById(id).addEventListener('input', function (e) { e.target.removeAttribute('aria-invalid'); });
    });
  };

  SharonStart.prototype._readInputs = function () {
    var r = this.shadowRoot;
    this._s.name = r.getElementById('shName').value;
    this._s.email = r.getElementById('shEmail').value;
    this._s.phone = r.getElementById('shPhone').value;
  };

  SharonStart.prototype._setLang = function (l) {
    if (SUPPORTED.indexOf(l) < 0) return;
    this._readInputs();
    this._s.lang = l;
    this._userPickedLang = true;
    this._langSource = 'switcher';
    try { var u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u.toString()); } catch (e) {}
    this._render();
    this._track('lang', { lang: l });
  };

  SharonStart.prototype._validate = function () {
    var s = this._s, t = this._t(), req = this.config.required, r = this.shadowRoot, errs = [];
    function bad(id, msg) { r.getElementById(id).setAttribute('aria-invalid', 'true'); errs.push(msg); }
    if (req.indexOf('name') >= 0 && s.name.trim().length < 2) bad('shName', t.errName);
    if (s.email.trim() ? !EMAIL_RE.test(s.email.trim()) : req.indexOf('email') >= 0) bad('shEmail', t.errEmail);
    if (s.phone.trim() ? !validPhone(s.phone) : req.indexOf('phone') >= 0) bad('shPhone', t.errPhone);
    return errs;
  };

  SharonStart.prototype._setBusy = function (on) {
    var r = this.shadowRoot, t = this._t();
    this._s.busy = on;
    r.getElementById('shGo').toggleAttribute('disabled', on);
    r.getElementById('shGoLabel').textContent = on ? t.sending : t.cta;
  };

  SharonStart.prototype._submit = function (e) {
    e.preventDefault();
    if (this._s.busy) return;
    var self = this, r = this.shadowRoot;
    this._readInputs();
    r.getElementById('shErr').textContent = '';
    var errs = this._validate();
    if (errs.length) {
      r.getElementById('shErr').textContent = errs[0];
      var first = r.querySelector('input[aria-invalid=true]'); if (first) first.focus();
      this._track('invalid', { errors: errs.length });
      return;
    }
    if (r.querySelector('.hp').value) { this._go(null); return; } /* bot filled the honeypot: skip POST, behave normally */
    this._track('submit', { intent: this._s.intent, lang: this._s.lang });
    this._setBusy(true);
    var finish = function (leadId) { self._go(leadId); };
    if (!this.config.endpoint) { finish(null); return; }
    this._postLead().then(function (res) {
      self._track('success', { leadId: res && res.id });
      finish(res && res.id ? res.id : null);
    }).catch(function (err) {
      self._track('error', { message: String((err && err.message) || err) });
      finish(null); /* never block the visitor on our own backend */
    });
  };

  SharonStart.prototype._postLead = function () {
    var s = this._s, cfg = this.config, p = new URLSearchParams(location.search);
    var utm = {};
    p.forEach(function (v, k) { if (/^utm_/i.test(k) || k === 'src' || k === 'ref') utm[k] = v; });
    var key = null;
    try { key = sessionStorage.getItem('sh-start-key'); if (!key) { key = uuid(); sessionStorage.setItem('sh-start-key', key); } } catch (e) { key = uuid(); }
    var payload = {
      source: 'start-generic',
      version: VERSION,
      idempotencyKey: key,
      lang: s.lang,
      intent: s.intent,
      name: s.name.trim(),
      email: s.email.trim().toLowerCase(),
      phone: normalizePhone(s.phone),
      phoneRaw: s.phone.trim(),
      page: location.href.split('#')[0],
      referrer: document.referrer || null,
      utm: utm,
      userAgent: navigator.userAgent,
      ts: new Date().toISOString()
    };
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, cfg.timeoutMs) : null;
    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return {}; });
    });
  };

  SharonStart.prototype._go = function (leadId) {
    var s = this._s, cfg = this.config;
    var w = window.ImmopiChatbot;
    if (w && typeof w.openFull === 'function') {
      var name = s.name.trim(), email = s.email.trim(), phone = s.phone.trim();
      this._track('go', { mode: 'widget' });
      try {
        var payload = { name: name, email: email, phone: phone };
        var msg = cfg.message || this._t().message;
        if (msg) payload.message = msg;
        w.openFull(payload);
        this._setBusy(false);
        return;
      } catch (err) {
        this._track('error', { message: 'openFull: ' + String((err && err.message) || err) });
      }
    }
    /* Widget not on the page (or it threw): redirect, never with email/phone. */
    var u = new URL(cfg.chatUrl, location.href), q = u.searchParams;
    var first = s.name.trim().split(/\s+/)[0];
    if (first) q.set('name', first);
    q.set('pi-mode', 'full');
    q.set('lang', s.lang);
    q.set('pi-locale', LOCALES[s.lang] || s.lang);
    if (s.intent) q.set('intent', s.intent);
    if (leadId) q.set('pi-lead', String(leadId));
    var url = u.toString();
    this._track('go', { mode: 'redirect' });
    location.assign(url);
  };

  SharonStart.prototype._track = function (name, detail) {
    var d = Object.assign({ component: 'sharon-start', version: VERSION }, detail || {});
    var ev = 'sh_start_' + name;
    try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: ev }, d)); } catch (e) {}
    /* Same as <sharon-landing>: hit the site's GA4 / Meta Pixel directly when present.
       Payloads never carry name, email or phone. */
    try { if (typeof window.gtag === 'function') window.gtag('event', ev, d); } catch (e) {}
    try { if (typeof window.fbq === 'function') window.fbq('trackCustom', ev, d); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('sharon-start:' + name, { detail: d, bubbles: true })); } catch (e) {}
    try { this.dispatchEvent(new CustomEvent('sh:track', { detail: { name: ev, params: d }, bubbles: true, composed: true })); } catch (e) {}
  };

  SharonStart.I18N = I18N;
  SharonStart.INTENT_IDS = INTENT_IDS;
  SharonStart.VERSION = VERSION;

  if (typeof customElements !== 'undefined' && !customElements.get('sharon-landing')) {
    customElements.define('sharon-landing', SharonStart);
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { I18N: I18N, INTENT_IDS: INTENT_IDS, VERSION: VERSION };
  }
})();
