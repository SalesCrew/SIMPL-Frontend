import { useEffect, useRef, useState, type FormEvent } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  LayoutGrid,
  Archive,
  SquareCheck,
  Users,
  ChevronsUpDown,
  Search,
  Bell,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  CheckCheck,
  ArrowUpRight,
  LogOut,
  X,
  ChevronDown,
  Tag,
  LoaderCircle,
  LockKeyhole,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./useWorkspace";
import { workspaceBoard } from "./domain";
import { WorkspaceSwitcher, WorkspaceEditor } from "./components/Workspaces";
import { demoMode, supabase } from "./data";
import { Board, Avatar } from "./components/Board";
import { BoardViewport } from "./components/BoardViewport";
import { BrandLogo } from "./components/BrandLogo";
import { NotificationBell } from "./components/NotificationBell";
import { InitialPassword } from "./components/InitialPassword";
import { ArchiveHeading, ArchiveList, ArchivedCard } from "./components/Archive";
import type { CardEditSession } from "./card-edit-session";
import { CardUndoToast } from "./components/CardUndoToast";
import "./card-editing.css";
import {
  CardEditor,
  ColumnEditor,
  LabelEditor,
  ProfileEditor,
} from "./components/Editors";
import { Dialog } from "./components/ui/Dialog";
import { Select } from "./components/ui/Select";
import { Tooltip, TooltipProvider } from "./components/ui/Tooltip";
import { timestamp, type Column, type Profile, type Workspace } from "./types";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await supabase!.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error)
        setError(
          "E-Mail oder Passwort stimmen nicht. Bitte versuche es erneut.",
        );
    } catch {
      setError("Die Anmeldung ist gerade nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-story">
        <a href="/" className="brand" aria-label="SIMPL Startseite">
          <BrandLogo />
        </a>
        <div>
          <span className="eyebrow">EIN BOARD. EIN TEAM.</span>
          <h1>
            Gemeinsam
            <br />
            <em>weiter.</em>
          </h1>
          <p>Projekte und Aufgaben im Überblick.</p>
          <div className="login-pills">
            <span>
              <CheckCheck size={15} />
              Alles im Blick
            </span>
            <span>
              <Users size={15} />
              Im Austausch
            </span>
          </div>
        </div>
        <small>SalesCrew · Inkognito · Merchandising</small>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={login}>
          <h2>Schön, dass du da bist.</h2>
          <label className="field">
            E-Mail-Adresse
            <input
              type="email"
              required
              autoComplete="username"
              placeholder="du@salescrew.at"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Passwort
            <input
              required
              type="password"
              autoComplete="current-password"
              placeholder="Dein Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <>
                Zum Workspace
                <ArrowRight size={16} />
              </>
            )}
          </button>
          <p className="login-help">
            Noch keinen Zugang oder Passwort vergessen?
            <br />
            Wende dich an deinen Administrator.
          </p>
        </form>
      </div>
    </main>
  );
}
export default function App() {
  const w = useWorkspace();
  const [view, setView] = useState<"board" | "mine" | "done" | "team" | "archive">("board");
  const [workspaceEditor, setWorkspaceEditor] = useState<{
    workspace?: Workspace;
  } | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [newsCollapsed, setNewsCollapsed] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [cardEditor, setCardEditor] = useState<{
    id?: string;
    column?: string;
    session?: CardEditSession;
  } | null>(null);
  const openCard = (id: string) =>
    setCardEditor({ id, session: w.state?.cards.find((card) => card.id === id)?.archived_at ? undefined : w.beginCardEdit(id) });
  useEffect(() => {
    const session = cardEditor?.session;
    return () => session?.close();
  }, [cardEditor?.session]);
  const [columnEditor, setColumnEditor] = useState<{ column?: Column } | null>(
    null,
  );
  const [profileEditor, setProfileEditor] = useState<{
    profile?: Profile;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (w.current?.role !== "admin" && view === "team") setView("board");
  }, [w.current?.role, view]);
  useEffect(() => {
    setView("board");
    setProjectFilter("");
    setSearch("");
    setMemberFilter("");
    setLabelFilter("");
    setStatusFilter("");
    setShowFilters(false);
    setCardEditor((editor) =>
      editor?.id &&
      w.state?.cards.some(
        (c) => c.id === editor.id && c.workspace_id === w.activeWorkspaceId,
      )
        ? editor
        : null,
    );
    setColumnEditor(null);
    setWorkspaceEditor(null);
    setProfileEditor(null);
    setShowLabels(false);
  }, [w.current?.id, w.activeWorkspaceId]);
  if (!demoMode && !supabase)
    return (
      <main className="setup">
        <ShieldCheck size={32} />
        <h1>Der Workspace wird eingerichtet.</h1>
        <p>
          Die Supabase-Verbindung fehlt noch. Hinterlege die Werte aus der
          Einrichtung, um dich sicher anzumelden.
        </p>
      </main>
    );
  if (!w.authReady)
    return (
      <main className="setup">
        <LoaderCircle className="spin" /> Workspace wird geladen …
      </main>
    );
  if (!demoMode && !w.user) return <Login />;
  if (!demoMode && w.passwordGate === "checking")
    return (
      <main className="password-gate">
        <div className="password-gate-form" role="status">
          <p>Dein Zugang wird geprüft …</p>
          {w.error && <>
            <p role="alert">{w.error}</p>
            <button className="primary" onClick={() => void w.refresh()}>Erneut versuchen</button>
          </>}
        </div>
      </main>
    );
  if (!demoMode && w.passwordGate === "required")
    return <InitialPassword email={w.user!.email || ""} complete={w.refresh} />;
  if (!demoMode && (w.passwordGate === "reauthenticate" || w.passwordGate === "unavailable"))
    return (
      <main className="password-gate">
        <div className="password-gate-form">
          <h1>{w.passwordGate === "reauthenticate" ? "Bitte erneut anmelden." : "Zugang noch nicht freigeschaltet."}</h1>
          <button className="primary" onClick={() => void supabase?.auth.signOut({ scope: "local" })}>Zur Anmeldung</button>
        </div>
      </main>
    );
  if (!w.state)
    return (
      <main className="setup">
        <LoaderCircle className="spin" />
        <h1>Zugriffsrechte werden geprüft …</h1>
        {w.error && (
          <>
            <p role="alert">{w.error}</p>
            <button className="primary" onClick={() => void w.refresh()}>
              <RefreshCw size={15} />
              Erneut versuchen
            </button>
          </>
        )}
      </main>
    );
  if (!w.current?.active)
    return (
      <main className="setup">
        <LockKeyhole size={30} />
        <h1>Zugang noch nicht freigeschaltet.</h1>
        <p>Dein Administrator muss deinen Zugang aktivieren.</p>
        <button
          className="secondary"
          onClick={() => void supabase?.auth.signOut()}
        >
          Abmelden
        </button>
      </main>
    );
  const { current, mutate, busy } = w;
  const allState = w.state;
  const state = workspaceBoard(allState, w.activeWorkspaceId);
  const activeWorkspace = allState.workspaces.find(
    (workspace) => workspace.id === w.activeWorkspaceId,
  )!;
  const admin = current.role === "admin";
  const cards = state.cards.filter(
    (c) =>
      (view === "archive" ? !!c.archived_at : !c.archived_at) &&
      (!projectFilter ||
        (view === "archive" && projectFilter === "unassigned"
          ? !c.project_id
          : c.project_id === projectFilter)) &&
      (!search ||
        `${c.title} ${c.description}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!memberFilter || c.assignee_id === memberFilter) &&
      (!labelFilter || c.label_ids.includes(labelFilter)) &&
      (!statusFilter ||
        (statusFilter === "unread"
          ? !c.reviewed_at
          : statusFilter === "read"
            ? !!c.reviewed_at
            : statusFilter === "open"
              ? !c.completed_at
              : !!c.completed_at)) &&
      (view !== "mine" ||
        c.assignee_id === current.id ||
        c.created_by === current.id) &&
      (view !== "done" || !!c.completed_at),
  );
  const unread = state.notifications
    .filter((n) => n.recipient_id === current.id && !n.seen_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const title =
    view === "archive"
      ? "Archiv"
      : view === "mine"
      ? "Meine Karten"
      : view === "done"
        ? "Erledigt"
        : view === "team"
          ? "Unser Team"
          : projectFilter
            ? state.columns.find((c) => c.id === projectFilter)?.name ||
              "Taskboard"
            : "Taskboard";
  const filtersActive = [
    projectFilter,
    memberFilter,
    labelFilter,
    statusFilter,
    search,
  ].some(Boolean);
  const resetFilters = () => {
    setProjectFilter("");
    setMemberFilter("");
    setLabelFilter("");
    setStatusFilter("");
    setSearch("");
  };
  const navigate = (next: typeof view, project = "") => {
    setView(next);
    resetFilters();
    setProjectFilter(project);
  };
  const signOut = async () => {
    if (demoMode || !supabase) return;
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      setShowAccount(false);
    } catch {
      w.setError("Abmelden hat nicht geklappt. Bitte versuche es erneut.");
    }
  };
  const editedCard = cardEditor?.id
    ? state.cards.find((c) => c.id === cardEditor.id)
    : undefined;
  const editorProps = { state, current, mutate, busy };
  const boardHeading = (
    <section className="board-heading">
      <div>
        {view === "team" ? (
          <div className="eyebrow">
            <span className="live-dot" />
            GUTE ARBEIT IST TEAMARBEIT
          </div>
        ) : (
          <div className="board-eyebrow-space" aria-hidden="true" />
        )}
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>
          {view === "team"
            ? "Die richtigen Menschen. Der gemeinsame Überblick."
            : view === "done"
              ? "Kleine Schritte. Zusammen viel geschafft."
              : "Trello nur schöner und gratis."}
        </p>
      </div>
      <div className="heading-right">
        <div className="avatar-stack">
          {state.profiles
            .filter((p) => p.active)
            .slice(0, 6)
            .map((p) => (
              <Avatar profile={p} key={p.id} />
            ))}
        </div>
        <span className="team-copy">Ein Board. Ein Team.</span>
      </div>
    </section>
  );
  return (
    <TooltipProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("board");
            }}
            aria-label="SIMPL Taskboard"
          >
            <BrandLogo />
          </a>
          <WorkspaceSwitcher
            state={allState}
            current={current}
            activeId={w.activeWorkspaceId}
            select={w.selectWorkspace}
            edit={(workspace) => setWorkspaceEditor({ workspace })}
          />
          <div className="sidebar-scroll">
            <span className="section-label">WORKSPACE</span>
            <nav aria-label="Hauptnavigation">
              <button
                aria-label="Taskboard"
                className={`nav-item ${view === "board" && !projectFilter ? "active" : ""}`}
                onClick={() => navigate("board")}
              >
                <LayoutGrid />
                Taskboard<span className="nav-count">{state.cards.filter((card) => !card.archived_at).length}</span>
              </button>
              <button
                aria-label="Meine Karten"
                className={`nav-item ${view === "mine" ? "active" : ""}`}
                onClick={() => navigate("mine")}
              >
                <SquareCheck />
                Meine Karten
              </button>
              <button
                aria-label="Erledigt"
                className={`nav-item ${view === "done" ? "active" : ""}`}
                onClick={() => navigate("done")}
              >
                <CheckCheck />
                Erledigt
              </button>
              <button aria-label="Archiv" className={`nav-item ${view === "archive" ? "active" : ""}`} onClick={() => navigate("archive")}>
                <Archive />Archiv
              </button>
            </nav>
            <span className="section-label project-caption">
              PROJEKTE{" "}
              {admin && (
                <button
                  className="icon-button"
                  aria-label="Projekt erstellen"
                  onClick={() => setColumnEditor({})}
                >
                  <Plus size={14} />
                </button>
              )}
            </span>
            <nav aria-label="Projektfilter">
              {state.columns
                .filter((c) => c.kind === "project")
                .sort((a, b) => a.position - b.position)
                .map((c) => (
                  <button
                    className={`nav-item project-nav ${projectFilter === c.id ? "active" : ""}`}
                    key={c.id}
                    onClick={() => navigate("board", c.id)}
                  >
                    <i className={`dot ${c.color}`} />
                    {c.name}
                    <span className="subtle-count">
                      {
                        state.cards.filter(
                          (t) => t.project_id === c.id && !t.completed_at && !t.archived_at,
                        ).length
                      }
                    </span>
                  </button>
                ))}
            </nav>
            <div className="sidebar-bottom">
              {admin && (
                <button
                  className={`nav-item ${view === "team" ? "active" : ""}`}
                  onClick={() => navigate("team")}
                  aria-label="Team & Zugänge"
                >
                  <Users />
                  Team & Zugänge
                  <ArrowUpRight size={14} />
                </button>
              )}
              <button
                className="profile-bar"
                onClick={() => setShowAccount(true)}
                aria-label="Mein Profil"
              >
                <Avatar profile={current} />
                <div>
                  <b>{current.name}</b>
                  <small>{admin ? "Administrator" : "Mitarbeiter"}</small>
                </div>
                <ChevronsUpDown size={14} />
              </button>
              <Tooltip
                content={
                  demoMode
                    ? "In der lokalen Demo gibt es keine angemeldete Sitzung."
                    : "Abmelden"
                }
              >
                <button
                  type="button"
                  className="nav-item sidebar-logout"
                  aria-label="Abmelden"
                  disabled={demoMode || busy}
                  onClick={() => void signOut()}
                >
                  <LogOut />
                  Abmelden
                </button>
              </Tooltip>
            </div>
          </div>
        </aside>
        <main className="main-area">
          <header className="topbar">
            <div className="breadcrumb">
              {activeWorkspace.name}
              <ChevronRight size={14} />
              <span>{title}</span>
            </div>
            <div className="topbar-actions">
              <div className="search">
                <Search size={17} />
                <input
                  ref={searchRef}
                  placeholder="Karten durchsuchen …"
                  aria-label="Karten durchsuchen"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (view === "team") setView("board");
                  }}
                />
                <kbd>⌘ K</kbd>
              </div>
              <NotificationBell
                unreadCount={unread.length}
                open={showNews}
                onClick={() => setShowNews((v) => !v)}
              />
              <button
                className="avatar-button"
                aria-label="Profil öffnen"
                onClick={() => setShowAccount(true)}
              >
                <Avatar profile={current} />
              </button>
            </div>
          </header>
          {showNews && (
            <section
              className={`news-panel ${newsCollapsed ? "collapsed" : ""}`}
              aria-label="Neuigkeiten"
            >
              <header>
                <Bell size={17} />
                <h2>Neuigkeiten</h2>
                <span className="news-count">{unread.length}</span>
                <button
                  className="icon-button"
                  aria-label={
                    newsCollapsed
                      ? "Neuigkeiten aufklappen"
                      : "Neuigkeiten einklappen"
                  }
                  onClick={() => setNewsCollapsed((v) => !v)}
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: newsCollapsed ? "rotate(180deg)" : undefined,
                    }}
                  />
                </button>
                <button
                  className="icon-button"
                  aria-label="Neuigkeiten schließen"
                  onClick={() => setShowNews(false)}
                >
                  <X size={16} />
                </button>
              </header>
              {!newsCollapsed && (
                <>
                  {unread.length ? (
                    <>
                      <div className="news-actions">
                        <span>Das ist neu für dich</span>
                        <button
                          onClick={() =>
                            void mutate({ type: "notifications.seen" })
                          }
                          disabled={busy}
                        >
                          <CheckCheck size={13} />
                          Alle gesehen
                        </button>
                      </div>
                      <div className="news-list">
                        {unread.map((n) => (
                          <button
                            className="news-item"
                            key={n.id}
                            onClick={() => {
                              const target = allState.cards.find(
                                (c) => c.id === n.card_id,
                              );
                              if (target)
                                w.selectWorkspace(target.workspace_id);
                              openCard(n.card_id);
                              void mutate({
                                type: "notifications.seen",
                                id: n.id,
                              });
                            }}
                          >
                            <Avatar
                              profile={state.profiles.find(
                                (p) => p.id === n.actor_id,
                              )}
                            />
                            <div>
                              <b>
                                {
                                  state.profiles.find(
                                    (p) => p.id === n.actor_id,
                                  )?.name
                                }
                              </b>
                              <span> hat kommentiert</span>
                              <strong>
                                {allState.cards.find((p) => p.id === n.card_id)
                                  ?.title || "Karte"}
                              </strong>
                              <small>
                                {
                                  allState.workspaces.find(
                                    (workspace) =>
                                      workspace.id ===
                                      allState.cards.find(
                                        (card) => card.id === n.card_id,
                                      )?.workspace_id,
                                  )?.name
                                }
                              </small>
                              <p>{n.body}</p>
                              <time dateTime={n.created_at}>
                                {timestamp(n.created_at)}
                              </time>
                            </div>
                            <i className="live-dot" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="news-empty">
                      <span>
                        <CheckCheck size={26} />
                      </span>
                      <b>Alles auf dem neuesten Stand.</b>
                      <p>
                        Neue Kommentare zu deinen Karten
                        <br />
                        findest du hier.
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          {view === "team" && admin && boardHeading}
          {view === "team" && admin ? (
            <div className="team-page">
              <div className="team-toolbar">
                <p>{state.profiles.length} Mitglieder · alle Workspaces</p>
                <button
                  className="primary"
                  onClick={() => setProfileEditor({})}
                >
                  <Plus size={16} />
                  Zugang erstellen
                </button>
              </div>
              <div className="team-grid">
                {state.profiles.map((p) => (
                  <article
                    className={`member-card ${!p.active ? "inactive" : ""}`}
                    key={p.id}
                  >
                    <Avatar profile={p} />
                    <div>
                      <h3>{p.name}</h3>
                      <p>{p.email}</p>
                    </div>
                    <span
                      className={`label ${p.role === "admin" ? "green" : "slate"}`}
                    >
                      {p.role === "admin" ? "Admin" : "Mitarbeiter"}
                    </span>
                    <dl>
                      <dt>Start-Workspace</dt>
                      <dd>
                        {
                          allState.workspaces.find(
                            (workspace) =>
                              workspace.id === p.default_workspace_id,
                          )?.name
                        }
                      </dd>
                      <dt>Standardprojekt</dt>
                      <dd>
                        {allState.columns.find(
                          (c) => c.id === p.default_column_id,
                        )?.name || "Kein Standardprojekt"}
                      </dd>
                      <dt>Status</dt>
                      <dd>{p.active ? "Aktiv" : "Deaktiviert"}</dd>
                    </dl>
                    <button
                      className="secondary"
                      onClick={() => setProfileEditor({ profile: p })}
                    >
                      Zugang bearbeiten
                      <ArrowUpRight size={13} />
                    </button>
                  </article>
                ))}
              </div>
              <p className="team-note">
                <ShieldCheck size={16} />
                Alle aktiven Mitglieder sehen und bearbeiten alle Karten. Nur
                Admins verwalten Workspaces, Projekte und Zugänge.
              </p>
            </div>
          ) : (
            <BoardViewport
              key={`${w.activeWorkspaceId}:${view}`}
              heading={view === "archive" ? <ArchiveHeading /> : boardHeading}
              controls={
                <div className={`board-toolbar${view === "archive" ? " archive-toolbar" : ""}`}>
                  <div className="board-tabs">
                    {view === "archive" ? <div className="view-tab selected archive-view-label">
                      <Archive size={16} />Archiv<span>{cards.length}</span>
                    </div> : <button
                      className="view-tab selected"
                      onClick={() => navigate("board")}
                    >
                      <LayoutGrid size={16} />
                      Board<span>{cards.length}</span>
                    </button>}
                    <span className="toolbar-divider" />
                    <div className="member-select">
                      {view === "archive" ? <Select
                        label="Archiv nach Projekt filtern"
                        variant="toolbar"
                        value={projectFilter}
                        onValueChange={setProjectFilter}
                        options={[
                          { value: "", label: "Alle Projekte", icon: <LayoutGrid size={15} /> },
                          ...state.columns.filter((column) => column.kind === "project").map((column) => ({
                            value: column.id, label: column.name, icon: <i className={`dot ${column.color}`} />,
                          })),
                          { value: "unassigned", label: "Nicht zugeordnet", icon: <Archive size={15} /> },
                        ]}
                      /> : <Select
                        label="Nach Mitglied filtern"
                        variant="toolbar"
                        icon={<Users size={15} />}
                        value={memberFilter}
                        onValueChange={setMemberFilter}
                        options={[
                          {
                            value: "",
                            label: "Alle Mitglieder",
                            icon: <Users size={15} />,
                          },
                          ...state.profiles
                            .filter((p) => p.active)
                            .map((p) => ({
                              value: p.id,
                              label: p.name,
                              icon: (
                                <Avatar profile={p} small tooltip={false} />
                              ),
                            })),
                        ]}
                      />}
                    </div>
                  </div>
                  <div className="toolbar-actions">
                    {view !== "archive" && <button
                      className="secondary label-manage"
                      onClick={() => setShowLabels(true)}
                    >
                      <Tag size={14} />
                      Labels
                    </button>}
                    <PopoverPrimitive.Root
                      open={showFilters}
                      onOpenChange={setShowFilters}
                    >
                      <PopoverPrimitive.Trigger asChild>
                        <button
                          className={`secondary ${showFilters ? "filter-active" : ""}`}
                        >
                          <SlidersHorizontal size={15} />
                          Filter{filtersActive && <i className="live-dot" />}
                        </button>
                      </PopoverPrimitive.Trigger>
                      <PopoverPrimitive.Portal>
                        <PopoverPrimitive.Content
                          className="filter-panel"
                          sideOffset={9}
                          align="end"
                          collisionPadding={12}
                          aria-label={view === "archive" ? "Archiv filtern" : "Board filtern"}
                        >
                          <header className="filter-heading">
                            <span>
                              <SlidersHorizontal size={15} />
                              {view === "archive" ? "Archiv filtern" : "Board filtern"}
                            </span>
                            <PopoverPrimitive.Close
                              className="icon-button"
                              aria-label="Filter schließen"
                            >
                              <X size={15} />
                            </PopoverPrimitive.Close>
                          </header>
                          {view === "archive" && <label className="field">
                            Zugewiesen an
                            <Select label="Archiv nach Mitglied filtern" variant="filter" value={memberFilter} onValueChange={setMemberFilter}
                              options={[
                                { value: "", label: "Alle Mitglieder", icon: <Users size={15} /> },
                                ...state.profiles.map((profile) => ({ value: profile.id, label: profile.name, icon: <Avatar profile={profile} small tooltip={false} /> })),
                              ]}
                            />
                          </label>}
                          <label className="field">
                            Label
                            <Select
                              label="Nach Label filtern"
                              variant="filter"
                              value={labelFilter}
                              onValueChange={setLabelFilter}
                              options={[
                                {
                                  value: "",
                                  label: "Alle Labels",
                                  icon: <Tag size={14} />,
                                },
                                ...state.labels.map((l) => ({
                                  value: l.id,
                                  label: l.name,
                                  icon: (
                                    <i className={`select-color ${l.color}`} />
                                  ),
                                })),
                              ]}
                            />
                          </label>
                          <label className="field">
                            Status
                            <Select
                              label="Nach Status filtern"
                              variant="filter"
                              value={statusFilter}
                              onValueChange={setStatusFilter}
                              options={[
                                {
                                  value: "",
                                  label: "Alle Karten",
                                  icon: <LayoutGrid size={14} />,
                                },
                                {
                                  value: "open",
                                  label: "Offen",
                                  icon: <SquareCheck size={14} />,
                                },
                                {
                                  value: "done",
                                  label: "Erledigt",
                                  icon: <CheckCheck size={14} />,
                                },
                                {
                                  value: "unread",
                                  label: "Noch nicht gelesen",
                                  icon: <Bell size={14} />,
                                },
                                {
                                  value: "read",
                                  label: "Gelesen",
                                  icon: <CheckCheck size={14} />,
                                },
                              ]}
                            />
                          </label>
                          <footer className="filter-footer">
                            <span>
                              {cards.length}{" "}
                              {cards.length === 1 ? "Karte" : "Karten"}
                            </span>
                            <button
                              className="text-button"
                              disabled={!filtersActive}
                              onClick={resetFilters}
                            >
                              Zurücksetzen
                              <RefreshCw size={12} />
                            </button>
                          </footer>
                        </PopoverPrimitive.Content>
                      </PopoverPrimitive.Portal>
                    </PopoverPrimitive.Root>
                    {view !== "archive" && <button
                      className="primary"
                      onClick={() =>
                        setCardEditor({ column: projectFilter || undefined })
                      }
                      disabled={
                        !state.columns.some((c) => c.kind === "project")
                      }
                    >
                      <Plus size={17} />
                      Neue Karte
                    </button>}
                  </div>
                </div>
              }
            >
              {view !== "archive" && filtersActive && cards.length === 0 && (
                <div className="no-results">
                  <Search size={17} />
                  Keine Karten gefunden. Passe die Suche oder deine Filter an.
                </div>
              )}
              {view === "archive" ? <ArchiveList cards={cards} state={state} open={openCard} filtered={filtersActive} reset={resetFilters} /> : <Board
                {...{ state, current, mutate, busy }}
                visible={cards}
                open={openCard}
                create={(column) => setCardEditor({ column })}
                editColumn={(column) => {
                  if (!column || column.kind === "project")
                    setColumnEditor({ column });
                }}
              />}
            </BoardViewport>
          )}
          <footer className="board-status">
            <span>
              <span className="live-dot" />
              {busy
                ? "Wird gespeichert …"
                : demoMode
                  ? "Lokale Demo · nur auf diesem Gerät"
                  : w.connected
                    ? "Verbunden · Änderungen live"
                    : "Zugriffsprüfung alle 5 Sekunden"}
            </span>
            <span>
              {view === "archive" ? "Originale Inhalte. Jederzeit nachlesen." : "Karten verschieben. Fortschritt schaffen."}
              <CheckCheck size={14} />
            </span>
          </footer>
        </main>
        {w.error && (
          <div className="error-toast" role="alert">
            <p>{w.error}</p>
            <button
              aria-label="Fehlermeldung schließen"
              onClick={() => w.setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {cardEditor && editedCard?.archived_at && <ArchivedCard card={editedCard} state={state} close={() => setCardEditor(null)} />}
        {cardEditor && !editedCard?.archived_at && (!cardEditor.id || editedCard) && (
          <CardEditor
            key={cardEditor.id || "new"}
            {...editorProps}
            workspaceId={w.activeWorkspaceId}
            card={editedCard}
            initialColumn={cardEditor.column}
            session={cardEditor.session}
            created={openCard}
            close={() => {
              cardEditor.session?.close();
              setCardEditor(null);
            }}
            editLabels={() => setShowLabels(true)}
          />
        )}
        {columnEditor &&
          (!columnEditor.column || columnEditor.column.kind === "project") && (
            <ColumnEditor
              {...editorProps}
              workspaceId={w.activeWorkspaceId}
              column={columnEditor.column}
              close={() => setColumnEditor(null)}
            />
          )}
        <div className="card-undo-stack">
          {w.undoOffers?.map((offer) => (
            <CardUndoToast
              key={offer.id}
              offer={offer}
              state={allState}
              update={w.updateUndoOffer}
              remove={w.finishUndoOffer}
            />
          ))}
        </div>
        {showLabels && (
          <LabelEditor
            {...editorProps}
            workspaceId={w.activeWorkspaceId}
            close={() => setShowLabels(false)}
          />
        )}
        {profileEditor && admin && (
          <ProfileEditor
            {...editorProps}
            state={allState}
            initialWorkspaceId={w.activeWorkspaceId}
            demo={demoMode}
            profile={profileEditor.profile}
            close={() => setProfileEditor(null)}
          />
        )}
        {showAccount && (
          <Dialog
            title="Dein Platz im Team."
            description={current.email}
            onClose={() => setShowAccount(false)}
          >
            <div className="simple-form">
              <div className="account-info">
                <Avatar profile={current} />
                <div>
                  <h3>{current.name}</h3>
                  <p>
                    {admin ? "Administrator" : "Mitarbeiter"} ·{" "}
                    {
                      allState.workspaces.find(
                        (workspace) =>
                          workspace.id === current.default_workspace_id,
                      )?.name
                    }{" "}
                    ·{" "}
                    {allState.columns.find(
                      (c) => c.id === current.default_column_id,
                    )?.name || "Kein Standardprojekt"}
                  </p>
                </div>
              </div>
              {demoMode ? (
                <>
                  <div className="demo-notice">
                    Lokale Vorschau: Änderungen bleiben nur in diesem Browser.
                    Es werden keine echten Konten erstellt. Die
                    Demo-Zugriffssperren sind keine Sicherheitsgrenze.
                  </div>
                  <label className="field">
                    Demo-Perspektive wechseln
                    <Select
                      label="Demo-Perspektive wechseln"
                      value={w.demoUser}
                      onValueChange={(next) => {
                        w.setDemoUser(next);
                        setShowAccount(false);
                        navigate("board");
                      }}
                      options={w.demoProfiles
                        .filter((p) => p.active)
                        .map((p) => ({
                          value: p.id,
                          label: `${p.name} · ${p.role === "admin" ? "Admin" : "Mitarbeiter"}`,
                          icon: <Avatar profile={p} small tooltip={false} />,
                        }))}
                    />
                  </label>
                </>
              ) : (
                <>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setPasswordBusy(true);
                      setPasswordMessage("");
                      try {
                        const result = await supabase!.auth.updateUser({
                          password: newPassword,
                        });
                        if (result.error)
                          setPasswordMessage(
                            "Passwort konnte nicht geändert werden. Bitte erneut anmelden und versuchen.",
                          );
                        else {
                          setPasswordMessage("Dein Passwort wurde geändert.");
                          setNewPassword("");
                        }
                      } catch {
                        setPasswordMessage(
                          "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
                        );
                      } finally {
                        setPasswordBusy(false);
                      }
                    }}
                  >
                    <label className="field">
                      Neues Passwort
                      <input
                        required
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={128}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mindestens 12 Zeichen"
                      />
                    </label>
                    <button className="secondary" disabled={passwordBusy}>
                      Passwort ändern
                    </button>
                    {passwordMessage && (
                      <p role="status" className="form-hint">
                        {passwordMessage}
                      </p>
                    )}
                  </form>
                  <button className="secondary" onClick={() => void signOut()}>
                    <LogOut size={15} />
                    Abmelden
                  </button>
                </>
              )}
            </div>
          </Dialog>
        )}
        {workspaceEditor && admin && (
          <WorkspaceEditor
            state={allState}
            workspace={workspaceEditor.workspace}
            mutate={mutate}
            busy={busy}
            close={() => setWorkspaceEditor(null)}
            created={w.selectWorkspace}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
