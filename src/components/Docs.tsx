import {
  Archive,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  CircleHelp,
  FolderKanban,
  Keyboard,
  LayoutGrid,
  ListChecks,
  LockKeyhole,
  MessageSquare,
  MousePointer2,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { findFaqMatches, type FaqGroup, type FaqMatch } from "../faq-search";
import { activeDocsSection } from "../docs-scroll";
import "./docs.css";

const quickSteps = [
  {
    number: "01",
    title: "Workspace öffnen",
    text: "Oben links wechselst du zwischen allen Workspaces, für die du freigeschaltet bist.",
  },
  {
    number: "02",
    title: "Projekt wählen",
    text: "Öffne ein Projekt in der Seitenleiste oder bleib im Taskboard für den Gesamtüberblick.",
  },
  {
    number: "03",
    title: "Karte bearbeiten",
    text: "Öffne eine Karte für Titel, Zuständigkeit, Labels, Beschreibung, Dateien und Kommentare.",
  },
  {
    number: "04",
    title: "Fortschritt zeigen",
    text: "Ziehe die Karte nach „In Arbeit“ oder markiere sie mit dem grünen Haken als erledigt.",
  },
];

const docsSections = [
  ["schnellstart", "Schnellstart"],
  ["grundprinzip", "Grundprinzip"],
  ["karten", "Karten bearbeiten"],
  ["zusammenarbeit", "Zusammenarbeit"],
  ["finden", "Suchen & finden"],
  ["zugriff", "Zugriff & Sicherheit"],
  ["kurzbefehle", "Kurzbefehle"],
  ["fragen", "Fragen & Antworten"],
] as const;
type DocsSectionId = (typeof docsSections)[number][0];

export const faqGroups: FaqGroup[] = [
  {
    title: "Anmeldung & Zugriff",
    questions: [
      ["Wie melde ich mich an?", "Mit der E-Mail-Adresse und dem Startpasswort, die du von einem Admin erhalten hast. Beim ersten Login musst du ein eigenes Passwort vergeben."],
      ["Was mache ich, wenn ich mein Passwort vergessen habe?", "Wende dich an einen Administrator. Ein Admin kann unter „Team & Zugänge“ ein neues Startpasswort vergeben."],
      ["Warum sehe ich einen Workspace nicht?", "Du siehst nur Workspaces, für die dein Zugang freigeschaltet ist. Bei geschützten oder voneinander getrennten Workspaces kann ausschließlich ein Admin den Zugriff ändern."],
      ["Welcher Workspace öffnet sich nach dem Login?", "Dein zugewiesener Start-Workspace. Du kannst danach über den Workspace-Schalter zu jedem weiteren freigegebenen Workspace wechseln."],
      ["Kann ein Admin alles sehen?", "Ja. Admins können alle Workspaces sehen und verwalten. Sie sind außerdem für Projekte, Zugänge und Workspace-Schutz zuständig."],
    ],
  },
  {
    title: "Karten & Projekte",
    questions: [
      ["Wie erstelle ich eine Karte?", "Klicke rechts oben auf „Neue Karte“, wähle ein Projekt, ergänze Titel und Zuständigkeit und bestätige mit „Karte erstellen“. Dateien kannst du anschließend in der geöffneten Karte ergänzen."],
      ["Was ist der Unterschied zwischen Projekt, Karte und Workspace?", "Ein Workspace ist ein abgegrenzter Arbeitsbereich. Darin bündeln Projekte zusammengehörige Aufgaben. Die einzelne Aufgabe ist eine Karte."],
      ["Was zeigt der Kreis unten rechts auf einer Karte?", "Er zeigt die Person, die die Karte erstellt hat. Die aktuell zuständige Person findest und änderst du in der geöffneten Karte unter „Zugewiesen an“."],
      ["Wie verschiebe ich eine Karte?", "Ziehe sie per Drag-and-drop in eine andere Spalte. Alternativ öffnest du die Karte und wählst unter „Verschieben nach“ das Ziel."],
      ["Was passiert beim Verschieben in ein anderes Projekt?", "Die Karte gehört sofort zum neuen Projekt. Projektfilter und Zähler werden entsprechend aktualisiert."],
      ["Wofür ist „In Arbeit“?", "„In Arbeit“ ist eine feste, manuelle Zwischenstufe. Eine Karte landet dort nur, wenn du sie selbst dorthin verschiebst."],
      ["Was passiert beim grünen Haken?", "Die Karte wird als erledigt markiert und immer in die feste Spalte „Fertig“ verschoben."],
      ["Was passiert, wenn ich den Haken wieder entferne?", "Die Karte kehrt an ihre zuletzt gemerkte Position im ursprünglichen Projekt zurück. Ein Zwischenstopp in „In Arbeit“ verändert diesen Ursprung nicht."],
      ["Kann ich neue Checklisten erstellen?", "Ja. Klicke beim Erstellen einer Karte im Bereich „Checklisten“ auf „Hinzufügen“, benenne die Liste und ergänze beliebig viele Punkte."],
      ["Wie erstelle ich eine Checkliste aus der Beschreibung?", "Beginne jede Aufgabe in der Beschreibung mit einem Bindestrich, zum Beispiel „- Angebot prüfen“. SIMPL erkennt diese Zeilen sofort und legt beim Erstellen der Karte automatisch die Checkliste „Aus Beschreibung“ an."],
      ["Kann ich eigene Labels anlegen?", "Ja. Öffne „Labels“ beziehungsweise „Verwalten“, um Labels anzulegen, umzubenennen und mit einer passenden Pastellfarbe zu versehen."],
      ["Wie archiviere ich eine Karte?", "Öffne die Karte und klicke unten auf „Archivieren“. Jedes Mitglied mit Zugriff auf den Workspace kann das tun. Die Karte verschwindet sofort aus dem aktiven Board, bleibt im „Archiv“ vollständig erhalten und ist dort schreibgeschützt. Direkt danach kannst du die Aktion kurz rückgängig machen."],
      ["Kann ich eine gelöschte Karte zurückholen?", "Direkt nach dem Löschen erscheint kurz eine Rückgängig-Aktion. Danach ist die Löschung abgeschlossen."],
    ],
  },
  {
    title: "Kommentare, Dateien & Übersicht",
    questions: [
      ["Wie sende ich einen Kommentar?", "Enter sendet den Kommentar. Mit Shift + Enter fügst du eine neue Zeile ein, ohne zu senden."],
      ["Welche Dateien kann ich anhängen?", "Alle Dateitypen sind erlaubt, zum Beispiel Bilder, PDFs, Excel-Dateien oder ZIP-Archive. Pro Datei sind bis zu 500 MB möglich."],
      ["Wie viele Dateien sind möglich?", "Eine Karte kann bis zu 20 direkte Anhänge enthalten. Zu einem einzelnen Kommentar kannst du bis zu 10 Dateien hinzufügen."],
      ["Kann ich Screenshots einfügen?", "Ja. Du kannst Bilder auswählen, per Drag-and-drop ablegen oder aus der Zwischenablage einfügen. Bilder lassen sich vergrößern, kopieren und herunterladen."],
      ["Wie filtere ich nach einer Person?", "Wähle die Person im Mitgliederfilter. SIMPL zeigt Karten, die diese Person erstellt hat oder denen sie zugewiesen ist."],
      ["Wie funktioniert die Suche?", "Im Taskboard prüft die Suche Kartentitel und Beschreibungen im aktuellen Workspace. Auf der Docs-Seite findet dasselbe Feld passende Q&A-Antworten – auch wenn du deine Frage anders formulierst. Mit Strg + K beziehungsweise ⌘ K springst du direkt in das Suchfeld."],
      ["Was bedeutet der doppelte Haken?", "Damit markierst du, dass eine Karte wahrgenommen wurde. SIMPL speichert auch, wer diese Markierung gesetzt hat."],
      ["Wann klingelt die Glocke?", "Bei neuen Karten, Kommentaren, Dateien und Kartenänderungen in einem Workspace, auf den du Zugriff hast. Eigene Aktionen lösen keinen Hinweis für dich selbst aus. Die Glocke wird gelb und bewegt sich; im Neuigkeiten-Fenster kannst du Einträge einzeln oder gesammelt als gesehen markieren."],
      ["Wo finde ich alte Karten?", "Im „Archiv“. Dort liegen importierte Trello-Karten und Karten, die dein Team in SIMPL archiviert hat. Sie sind vollständig als erledigt markiert und nur zum Nachlesen verfügbar."],
      ["Warum kann ich eine archivierte Karte nicht bearbeiten?", "Das Archiv bewahrt den Stand zum Zeitpunkt der Archivierung. Deshalb sind Karte, Kommentare, Dateien und Checklisten dort schreibgeschützt."],
      ["Woran erkenne ich, ob meine Änderung gespeichert ist?", "Unten links zeigt SIMPL den Verbindungs- und Speicherstatus. Nach Textänderungen bestätigst du mit „Speichern“; Auswahlen und Anhänge werden sofort gespeichert."],
      ["Was mache ich, wenn etwas fehlt oder nicht lädt?", "Prüfe zuerst den Verbindungsstatus unten links und lade die Seite neu. Bleibt das Problem bestehen, notiere Kartenname und Workspace und wende dich an einen Admin."],
    ],
  },
];

function SearchResults({ matches, compact = false }: { matches: FaqMatch[]; compact?: boolean }) {
  if (!matches.length) return (
    <div className={`docs-search-empty${compact ? " compact" : ""}`}>
      <CircleHelp size={18} />
      <div><b>Keine direkte Antwort gefunden.</b><span>Versuche ein anderes Wort oder einen kürzeren Satz.</span></div>
    </div>
  );
  return (
    <div className={compact ? "docs-search-popover-results" : "docs-faq-results"}>
      {matches.map((match) => <details key={match.question}>
        <summary>
          <span><small>{match.group}</small>{match.question}</span>
          <i aria-hidden="true">+</i>
        </summary>
        <p>{match.answer}</p>
      </details>)}
    </div>
  );
}

export function DocsSearchPopover({ query }: { query: string }) {
  const cleanQuery = query.trim();
  const matches = cleanQuery ? findFaqMatches(faqGroups, cleanQuery, 5) : [];
  return (
    <div className="docs-search-popover" role="region" aria-label="Passende Q&A-Antworten" aria-live="polite">
      {cleanQuery ? <>
        <header><span>Passende Antworten</span><small>{matches.length} Treffer</small></header>
        <SearchResults matches={matches} compact />
      </> : <div className="docs-search-prompt">
        <CircleHelp size={18} />
        <div><b>Frag SIMPL.</b><span>Zum Beispiel: „Wie lade ich eine PDF hoch?“</span></div>
      </div>}
    </div>
  );
}

const ignoreSearch = () => {};

export function DocsPage({ search = "", onSearchChange = ignoreSearch }: {
  search?: string;
  onSearchChange?: (value: string) => void;
}) {
  const matches = findFaqMatches(faqGroups, search);
  const pageRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<DocsSectionId>(docsSections[0][0]);
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const pageTop = page.getBoundingClientRect().top;
      const marker = Math.min(150, page.clientHeight * 0.28);
      const next = activeDocsSection(
        docsSections.map(([id]) => ({
          id,
          top: (page.querySelector<HTMLElement>(`#${id}`)?.getBoundingClientRect().top ?? pageTop) - pageTop,
        })),
        marker,
      );
      if (next) setActiveSection((current) => current === next ? current : next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    page.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      page.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="docs-page" ref={pageRef}>
      <header className="docs-hero">
        <div className="docs-hero-copy">
          <span className="docs-eyebrow"><BookOpen size={14} /> SIMPL HANDBUCH</span>
          <h1>Alles, was du für SIMPL brauchst<span>.</span></h1>
          <p>Ein einfacher Weg durch Workspaces, Projekte und Karten – vom ersten Login bis zur erledigten Aufgabe.</p>
          <div className="docs-meta">
            <span><Sparkles size={14} /> In 5 Minuten startklar</span>
            <span><Users size={14} /> Für Mitarbeiter & Admins</span>
          </div>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label="Inhalt">
          <b>Auf dieser Seite</b>
          {docsSections.map(([id, label]) => <a
            key={id}
            href={`#${id}`}
            className={activeSection === id ? "active" : undefined}
            aria-current={activeSection === id ? "location" : undefined}
            onClick={() => setActiveSection(id)}
          >{label}</a>)}
        </aside>

        <article className="docs-content">
          <section id="schnellstart" className="docs-section">
            <div className="docs-section-heading">
              <span><MousePointer2 size={16} /></span>
              <div><small>LOSLEGEN</small><h2>Vier Schritte bis zur ersten Aufgabe.</h2></div>
            </div>
            <div className="docs-quick-grid">
              {quickSteps.map((step) => <div className="docs-quick-card" key={step.number}>
                <span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p>
              </div>)}
            </div>
          </section>

          <section id="grundprinzip" className="docs-section">
            <div className="docs-section-heading">
              <span><LayoutGrid size={16} /></span>
              <div><small>AUFBAU</small><h2>So ist SIMPL organisiert.</h2></div>
            </div>
            <p className="docs-lead">Alles beginnt im Workspace. Projekte strukturieren die Arbeit, Karten halten die konkrete Aufgabe fest.</p>
            <div className="docs-flow" aria-label="Workspace enthält Projekte und Karten">
              <div><LayoutGrid /><b>Workspace</b><small>Abgegrenzter Arbeitsbereich</small></div>
              <ArrowRight />
              <div><FolderKanban /><b>Projekt</b><small>Gruppe verwandter Aufgaben</small></div>
              <ArrowRight />
              <div><CheckCheck /><b>Karte</b><small>Eine konkrete Aufgabe</small></div>
            </div>
            <div className="docs-note"><BookOpen size={17} /><p><b>Gut zu wissen:</b> Dein Start-Workspace öffnet sich automatisch. Über den Schalter oben links erreichst du alle weiteren Workspaces, für die du freigeschaltet bist.</p></div>
          </section>

          <section id="karten" className="docs-section">
            <div className="docs-section-heading">
              <span><CheckCheck size={16} /></span>
              <div><small>KARTEN</small><h2>Von der Idee bis „Fertig“.</h2></div>
            </div>
            <div className="docs-feature-grid">
              <div><Tags /><h3>Titel, Zuständigkeit & Labels</h3><p>Beim Erstellen wählst du Projekt, Titel und zuständige Person. Labels geben Aufgaben eine schnell erkennbare Kategorie.</p></div>
              <div><ListChecks /><h3>Checklisten direkt mitplanen</h3><p>Lege beim Erstellen eigene Checklisten an. Zeilen mit „-“ in der Beschreibung werden zusätzlich automatisch zu Aufgaben.</p></div>
              <div><MousePointer2 /><h3>Verschieben ohne Wartezeit</h3><p>Ziehe Karten zwischen Projekten und Statusspalten. Die Oberfläche reagiert sofort, während SIMPL im Hintergrund speichert.</p></div>
              <div><Check /><h3>Erledigen & zurückholen</h3><p>Der grüne Haken verschiebt immer nach „Fertig“. Entfernst du ihn, kehrt die Karte an ihre gemerkte Projektposition zurück.</p></div>
              <div><CheckCheck /><h3>Wahrgenommen</h3><p>Der doppelte Haken speichert, wer eine Karte gelesen beziehungsweise wahrgenommen hat – unabhängig vom Erledigt-Status.</p></div>
            </div>
            <div className="docs-status-row">
              <div><i className="docs-status-dot project" /><b>Projekt</b><span>Der fachliche Ort der Karte</span></div>
              <ArrowRight />
              <div><i className="docs-status-dot work" /><b>In Arbeit</b><span>Manuell verschobene Aufgaben</span></div>
              <ArrowRight />
              <div><i className="docs-status-dot done" /><b>Fertig</b><span>Automatisch über den grünen Haken</span></div>
            </div>
          </section>

          <section id="zusammenarbeit" className="docs-section">
            <div className="docs-section-heading">
              <span><MessageSquare size={16} /></span>
              <div><small>ZUSAMMENARBEIT</small><h2>Kontext bleibt direkt an der Karte.</h2></div>
            </div>
            <div className="docs-split">
              <div className="docs-panel"><MessageSquare /><h3>Kommentare</h3><p>Schreibe Fragen, Feedback oder Updates direkt in die Karte. <kbd>Enter</kbd> sendet, <kbd>Shift</kbd> + <kbd>Enter</kbd> beginnt eine neue Zeile.</p></div>
              <div className="docs-panel"><Paperclip /><h3>Dateien & Screenshots</h3><p>Ziehe Dateien hinein oder füge Screenshots aus der Zwischenablage ein. Alle Dateitypen sind erlaubt – bis zu 500 MB pro Datei.</p></div>
              <div className="docs-panel"><Bell /><h3>Neuigkeiten</h3><p>Neue Karten, Kommentare, Dateien und Änderungen erscheinen hinter der gelben Glocke. Von dort öffnest du direkt die betroffene Karte oder markierst alles als gesehen.</p></div>
            </div>
          </section>

          <section id="finden" className="docs-section">
            <div className="docs-section-heading">
              <span><Search size={16} /></span>
              <div><small>ÜBERBLICK</small><h2>Schnell genau das finden, was zählt.</h2></div>
            </div>
            <div className="docs-list">
              <div><span>01</span><div><b>Globale Suche im Workspace</b><p>Durchsucht Titel und Beschreibungen der Karten im aktuell geöffneten Workspace.</p></div></div>
              <div><span>02</span><div><b>Mitgliederfilter</b><p>Findet Karten, die eine Person erstellt hat oder denen sie zugewiesen ist.</p></div></div>
              <div><span>03</span><div><b>Labels & Status</b><p>Grenze die Ansicht nach Label, offen/erledigt und gelesen/nicht gelesen ein.</p></div></div>
              <div><span>04</span><div><b>Meine Karten, Erledigt & Archiv</b><p>Direkte Ansichten für deine Karten, abgeschlossene Arbeit und den schreibgeschützten Trello-Bestand.</p></div></div>
            </div>
          </section>

          <section id="zugriff" className="docs-section">
            <div className="docs-section-heading">
              <span><ShieldCheck size={16} /></span>
              <div><small>ZUGRIFF</small><h2>Sichtbarkeit wird im Workspace geregelt.</h2></div>
            </div>
            <div className="docs-access">
              <div><Users /><h3>Mitarbeiter</h3><p>Arbeiten in allen für sie freigegebenen Workspaces. Gesperrte Unternehmensbereiche bleiben vollständig verborgen.</p></div>
              <div><ShieldCheck /><h3>Administratoren</h3><p>Sehen alle Workspaces und verwalten Projekte, Zugänge, Start-Workspaces sowie gegenseitige Workspace-Sperren.</p></div>
              <div><LockKeyhole /><h3>Archiv</h3><p>Bewahrt historische Trello-Karten als erledigten Originalstand. Archivierte Inhalte können gelesen, aber nicht verändert werden.</p></div>
            </div>
          </section>

          <section id="kurzbefehle" className="docs-section">
            <div className="docs-section-heading">
              <span><Keyboard size={16} /></span>
              <div><small>SCHNELLER ARBEITEN</small><h2>Die wichtigsten Handgriffe.</h2></div>
            </div>
            <div className="docs-shortcuts">
              <div><span><kbd>⌘</kbd><i>oder</i><kbd>Ctrl</kbd><b>+</b><kbd>K</kbd></span><p>Suche fokussieren</p></div>
              <div><span><kbd>Enter</kbd></span><p>Kommentar senden</p></div>
              <div><span><kbd>Shift</kbd><b>+</b><kbd>Enter</kbd></span><p>Neue Kommentarzeile</p></div>
              <div><span><kbd>Esc</kbd></span><p>Dialog schließen</p></div>
            </div>
          </section>

          <section id="fragen" className="docs-section docs-faq-section">
            <div className="docs-section-heading">
              <span><CircleHelp size={16} /></span>
              <div><small>Q&amp;A</small><h2>Fragen, die im Alltag auftauchen.</h2></div>
            </div>
            <p className="docs-lead">Stelle deine Frage in deinen eigenen Worten oder suche nach einem Stichwort.</p>
            <div className="docs-faq-search" role="search">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Wie können wir dir helfen?"
                aria-label="Fragen und Antworten durchsuchen"
              />
              {search && <button type="button" aria-label="Q&A-Suche leeren" onClick={() => onSearchChange("")}><X size={14} /></button>}
            </div>
            {search.trim() ? <div className="docs-filtered-faq" aria-live="polite">
              <div className="docs-filtered-faq-head"><b>Passende Antworten</b><span>{matches.length} Treffer</span></div>
              <SearchResults matches={matches} />
            </div> : <div className="docs-faq-groups">
                {faqGroups.map((group) => <section key={group.title}>
                  <h3>{group.title}</h3>
                  {group.questions.map(([question, answer]) => <details key={question}>
                    <summary>{question}<span aria-hidden="true">+</span></summary>
                    <p>{answer}</p>
                  </details>)}
                </section>)}
              </div>}
          </section>

          <footer className="docs-footer">
            <div><Archive size={18} /><p><b>Noch etwas unklar?</b><span>Notiere den Workspace und den Namen der Karte – damit kann dein Admin am schnellsten helfen.</span></p></div>
            <a href="#schnellstart">Zurück nach oben <ArrowRight size={14} /></a>
          </footer>
        </article>
      </div>
    </div>
  );
}
