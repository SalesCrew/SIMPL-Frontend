export type FaqGroup = {
  title: string;
  questions: [string, string][];
};

export type FaqMatch = {
  group: string;
  question: string;
  answer: string;
  score: number;
};

const STOP_WORDS = new Set([
  "aber", "alle", "als", "auch", "auf", "aus", "bei", "das", "dass",
  "dem", "den", "der", "die", "ein", "eine", "einer", "einen", "es",
  "etwas", "fur", "haben", "ich", "im", "in", "ist", "kann", "konnte",
  "machen", "man", "mein", "meine", "mit", "nach", "oder", "sich", "so",
  "und", "vom", "von", "warum", "was", "wenn", "wer", "wie", "wieder",
  "wo", "wurde", "zu", "zum", "zur", "the", "a", "an", "how", "where",
  "can", "i", "my", "is", "do",
]);

const SEMANTIC_GROUPS = [
  ["login", "anmelden", "anmeldung", "einloggen", "einlogge", "reinkommen", "rein", "konto", "account", "zugang", "sign-in"],
  ["passwort", "password", "kennwort", "passwortwechsel", "zurucksetzen", "reset", "vergessen"],
  ["zugriff", "sichtbar", "sichtbarkeit", "sehen", "freigabe", "erlaubnis", "berechtigung", "gesperrt", "sperre", "nda"],
  ["admin", "administrator", "administratoren", "verwalter", "verwaltung"],
  ["workspace", "workspaces", "arbeitsbereich", "bereich", "firma", "unternehmen"],
  ["karte", "karten", "aufgabe", "aufgaben", "task", "tasks", "ticket", "tickets", "todo", "to-do"],
  ["erstellen", "anlegen", "hinzufugen", "neu", "neue", "create", "erzeuge"],
  ["checkliste", "checklisten", "aufgabenliste", "todo-liste", "unteraufgabe", "unteraufgaben", "listenpunkt", "listenpunkte"],
  ["beschreibung", "beschreibungsfeld", "bindestrich", "minus", "zeile", "textfeld"],
  ["datei", "dateien", "anhang", "anhange", "upload", "hochladen", "excel", "pdf", "zip", "dokument", "dokumente"],
  ["bild", "bilder", "screenshot", "screenshots", "foto", "fotos", "zwischenablage", "clipboard", "paste", "kopieren"],
  ["kommentar", "kommentare", "nachricht", "nachrichten", "schreiben", "antworten", "chat"],
  ["filter", "filtern", "eingrenzen", "personensuche", "mitglied", "mitglieder"],
  ["suche", "suchen", "finden", "suchfeld", "durchsuchen", "search"],
  ["verschieben", "ziehen", "drag", "drop", "bewegen", "anderes-projekt"],
  ["fertig", "erledigt", "abschliessen", "abschluss", "abhaken", "gruner-haken", "done"],
  ["arbeit", "in-arbeit", "bearbeitung", "angefangen", "status"],
  ["gelesen", "wahrgenommen", "doppelhaken", "doppelter-haken", "kenntnis"],
  ["neuigkeit", "neuigkeiten", "glocke", "benachrichtigung", "benachrichtigungen", "notification"],
  ["archiv", "archiviert", "alte", "alter", "historisch", "vergangen", "fruher"],
  ["loschen", "geloscht", "entfernen", "ruckgangig", "wiederherstellen", "zuruckholen"],
  ["label", "labels", "etikett", "kategorie", "farbe", "markierung"],
  ["ersteller", "erstellt-von", "angelegt-von", "autor", "besitzer", "zustandig", "zugewiesen"],
  ["projekt", "projekte", "spalte", "board", "taskboard"],
] as const;

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-AT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim();
}

function stem(value: string) {
  if (value.length < 5) return value;
  return value.replace(/(ern|em|en|er|es|e|n|s)$/u, "");
}

const SEMANTIC_ALIASES = new Map<string, string>();
for (const [canonical, ...aliases] of SEMANTIC_GROUPS) {
  for (const value of [canonical, ...aliases]) {
    SEMANTIC_ALIASES.set(normalize(value), canonical);
    SEMANTIC_ALIASES.set(stem(normalize(value)), canonical);
  }
}

function tokens(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => SEMANTIC_ALIASES.get(token) || SEMANTIC_ALIASES.get(stem(token)) || stem(token));
}

function closeEnough(left: string, right: string) {
  if (left === right) return true;
  if (Math.min(left.length, right.length) >= 4 && (left.startsWith(right) || right.startsWith(left))) return true;
  if (Math.abs(left.length - right.length) > 1 || Math.min(left.length, right.length) < 5) return false;
  let edits = 0;
  for (let a = 0, b = 0; a < left.length && b < right.length;) {
    if (left[a] === right[b]) { a += 1; b += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) a += 1;
    else if (right.length > left.length) b += 1;
    else { a += 1; b += 1; }
  }
  return true;
}

export function findFaqMatches(
  groups: FaqGroup[],
  query: string,
  limit = 12,
): FaqMatch[] {
  const normalizedQuery = normalize(query);
  const queryTokens = [...new Set(tokens(query))];
  if (!queryTokens.length) return [];

  return groups
    .flatMap((group) => group.questions.map(([question, answer]) => {
      const normalizedDocument = normalize(`${group.title} ${question} ${answer}`);
      const documentTokens = new Set(tokens(normalizedDocument));
      let matched = 0;
      let score = normalizedDocument.includes(normalizedQuery) ? 40 : 0;
      for (const queryToken of queryTokens) {
        if (documentTokens.has(queryToken)) {
          matched += 1;
          score += 10;
        } else if ([...documentTokens].some((documentToken) => closeEnough(queryToken, documentToken))) {
          matched += 1;
          score += 4;
        }
      }
      const coverage = matched / queryTokens.length;
      if (!matched || (queryTokens.length > 2 && coverage < 0.4)) score = 0;
      return { group: group.title, question, answer, score: score + coverage * 5 };
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.question.localeCompare(right.question, "de-AT"))
    .slice(0, limit);
}
