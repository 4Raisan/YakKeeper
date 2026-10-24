"use client";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  Plus,
  Star,
  Search,
  X,
  Check,
  ChevronDown,
  ArrowRight,
  Layers,
  Inbox,
  LogOut,
  ShieldCheck,
  Flag,
} from "lucide-react";
import ProjectMembers from "./project-members";
import TaskBoard from "./task-board";
import ProjectArt from "./project-art";
import ThemeToggle from "./theme-toggle";
import {demoAccounts} from "@/lib/hub-demo";
import { bannerImage } from "@/lib/banner-image";
import Github from "./github-icon";
import { latestRequestGate } from "@/lib/hub-sync";
import { browserAuth, authHeaders } from "@/lib/supabase-browser";
import {
  blankProject,
  projectCategories,
  type Project,
  type HubState,
  type Repo,
  type HubRequest,
} from "@/lib/hub-types";
import { isMyProject } from "@/lib/hub-membership";
const emptyHub: HubState = {
  configured: false,
  mode: "unconfigured",
  projects: [],
  user: null,
  inbox: [],
  sent: [],
  invitations: [],
  reports: [],
  blocks: [],
  hasMore: false,
};
const views = ["explore", "my", "applications", "moderation"];
export default function Board({ copyrightYear, projectId }: { copyrightYear: number; projectId?: string }) {
  const [hub, setHub] = useState<HubState>(emptyHub),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [view, setView] = useState("explore"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All projects"),
    [expanded, setExpanded] = useState(projectId || ""),
    [page, setPage] = useState(1);
  const [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(""),
    [editor, setEditor] = useState({ ...blankProject }),
    [repoLabel, setRepoLabel] = useState("");
  const [boardProject, setBoardProject] = useState<Project | null>(null);
  const [bannerBusy,setBannerBusy] = useState(false);
  const [confirmDelete,setConfirmDelete] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]),
    [repoPage, setRepoPage] = useState(1),
    [moreRepos, setMoreRepos] = useState(false),
    [repoQuery, setRepoQuery] = useState(""),
    [repoLoading, setRepoLoading] = useState(false),
    [repoError, setRepoError] = useState("");
  const [form, setForm] = useState<{
      project: Project;
      kind: "idea" | "contribution";
    } | null>(null),
    [reportProject, setReportProject] = useState(""),
    [applicationTab, setApplicationTab] = useState("received");
  const dialog = useRef<HTMLElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    gate = useRef(latestRequestGate()),
    readAbort = useRef<AbortController | null>(null),
    repoAbort = useRef<AbortController | null>(null),
    channel = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback(async () => {
    const ticket = gate.current.next();
    readAbort.current?.abort();
    const abort = new AbortController();
    readAbort.current = abort;
    try {
      const response = await fetch(projectId ? "/api/hub?resource=project&project_id=" + encodeURIComponent(projectId) : "/api/hub?page=" + page, {
        headers: await authHeaders(),
        signal: abort.signal,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (gate.current.current(ticket)) {
        setHub(data);
        setError("");
      }
    } catch (e) {
      if (!abort.signal.aborted && gate.current.current(ticket))
        setError((e as Error).message);
    } finally {
      if (gate.current.current(ticket)) setLoading(false);
    }
  }, [page, projectId]);
  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get("view");
    if (wanted && views.includes(wanted)) setView(wanted);
    const authError = new URLSearchParams(location.search).get(
      "error_description",
    );
    if (authError) {
      setFeedback(authError);
      setModal("login");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const auth = browserAuth();
    const subscription = auth?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        gate.current.invalidate();
        readAbort.current?.abort();
        setHub(emptyHub);
      }
      setTimeout(() => void refresh(), 0);
    });
    const onFocus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(onFocus, 60000);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("yakkeeper-sync");
      channel.current.onmessage = () => void refresh();
    }
    return () => {
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
      channel.current?.close();
      gate.current.invalidate();
      readAbort.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (!modal) return;
    const prior = document.activeElement as HTMLElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current
      ?.querySelector<HTMLElement>("input,button,textarea")
      ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      prior?.focus();
    };
  }, [modal]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !modal &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) &&
        !el.isContentEditable
      ) {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [modal]);
  useEffect(() => {
    setModal(current => ["board","members"].includes(current) ? "" : current);
    setBoardProject(null);
    setApplicationTab("received");
    setForm(null);
    setRepos([]);
  }, [hub.user?.id]);
  useEffect(() => {
    if (!hub.user || projectId) return;
    const target=sessionStorage.getItem("yk-return-project");
    if (target) {
      sessionStorage.removeItem("yk-return-project");
      if (/^[0-9a-f-]{36}$/i.test(target)) location.assign("/projects/"+target);
    }
  },[hub.user,projectId]);
  useEffect(() => () => repoAbort.current?.abort(), []);
  function navigate(next: string) {
    if (projectId) { location.assign("/?view="+next); return; }
    setView(next);
    setQuery("");
    setFilter("All projects");
    setForm(null);
    setFeedback("");
    history.replaceState(null, "", next === "explore" ? "/" : "/?view=" + next);
  }
  function open(next: string) {
    setConfirmDelete(false);
    setFeedback("");
    setModal(next);
  }
  function close() {
    if (!busy) {
      setModal("");
      setFeedback("");
      repoAbort.current?.abort();
    }
  }
  async function action(payload: unknown) {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/hub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      await refresh();
      channel.current?.postMessage("changed");
      return true;
    } catch (e) {
      setFeedback((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function loadRepos(next = 1) {
    repoAbort.current?.abort();
    const abort = new AbortController();
    repoAbort.current = abort;
    setRepoLoading(true);
    setRepoError("");
    try {
      const response = await fetch("/api/hub?resource=repos&page=" + next, {
        headers: await authHeaders(),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (!abort.signal.aborted) {
        setRepos((previous) =>
          next === 1 ? data.repos : [...previous, ...data.repos],
        );
        setRepoPage(next);
        setMoreRepos(data.hasMore);
        setRepoError(data.warning || "");
      }
    } catch (e) {
      if (!abort.signal.aborted) setRepoError((e as Error).message);
    } finally {
      if (!abort.signal.aborted) setRepoLoading(false);
    }
  }
  function addProject() {
    if (!hub.user) {
      open("login");
      return;
    }
    setRepos([]);
    setRepoQuery("");
    open("repos");
    void loadRepos();
  }
  function chooseRepo(repo: Repo) {
    setEditor({
      ...blankProject,
      repo_id: repo.id,
      title: repo.name,
      summary: repo.description || "",
      description: repo.description || "",
      tags: repo.language || "",
      demo:
        repo.homepage && /^https?:\/\//.test(repo.homepage)
          ? repo.homepage
          : "",
    });
    setRepoLabel(repo.full_name);
    setEditing("");
    open("editor");
  }
  function edit(project: Project) {
    setEditor({ ...blankProject, ...project });
    setEditing(project.id);
    setRepoLabel(
      project.repo
        ? project.repo.replace("https://github.com/", "")
        : "Local example repository",
    );
    open("editor");
  }
  async function signIn() {
    setBusy(true);
    setFeedback("");
    try {
      const auth = browserAuth();
      if (!auth) throw Error("GitHub sign-in is not configured yet.");
      if (projectId) sessionStorage.setItem("yk-return-project",projectId);
      const { error } = await auth.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: location.origin + "/?view=my" },
      });
      if (error) throw error;
    } catch (e) {
      setFeedback((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    gate.current.invalidate();
    readAbort.current?.abort();
    setHub({ ...emptyHub, mode: hub.mode, configured: hub.configured });
    setForm(null);
    setModal("");
    setRepos([]);
    if (hub.mode === "local") await action({ action: "demoLogout" });
    else {
      await browserAuth()?.auth.signOut();
      await refresh();
    }
    channel.current?.postMessage("changed");
    navigate("explore");
  }
  function request(project: Project, kind: "idea" | "contribution") {
    if (!hub.user) {
      open("login");
      return;
    }
    setFeedback("");
    setForm({ project, kind });
    setExpanded(project.id);
  }
  const user = hub.user;
  const joined = new Set(hub.projects.filter(p=>p.is_member).map(p=>p.id));
  const searchTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = hub.projects
    .filter((p) =>
      projectId ? true : view === "my" ? isMyProject(p, user?.id, joined) : p.visibility === "public",
    )
    .filter((p) => {
      const text = `${p.title} ${p.tags} ${p.needs} ${p.owner_login} ${p.summary}`.toLowerCase();
      return searchTerms.every(term => text.includes(term));
    })
    .filter(
      (p) =>
        filter === "All projects" ||
        (filter === "Open to teammates" &&
          p.join_policy !== "invite_only" &&
          p.contributions_open &&
          p.status === "In progress") ||
        (filter === "Beginner friendly" && p.beginner_friendly) ||
        p.status === filter,
    );
  const requests = applicationTab === "received" ? hub.inbox : hub.sent;
  const title =
    view === "my"
      ? "My projects"
      : view === "applications"
        ? "Applications"
          : view === "moderation"
            ? "Reports"
            : "Build together";
  function requestCard(r: HubRequest) {
    const received = applicationTab === "received";
    const project = hub.projects.find(p => p.id === r.project_id);
    const contactLogin = received ? r.applicant_login : project?.owner_login;
    const canConnect = contactLogin && !contactLogin.endsWith("-demo") && !user?.demo;
    const acceptedMember = r.status === "Accepted" && r.kind === "contribution";
    const displayName = received ? r.name : r.project_title;
    const identityIsName = received && contactLogin &&
      displayName.replace(/^@/, "").toLowerCase() === contactLogin.toLowerCase();
    return <article className="request compact-request" key={r.id}>
      <div className="request-top">
        <div className="request-title">
          {canConnect && identityIsName
            ? <a className="application-person" href={"https://github.com/" + contactLogin} target="_blank" rel="noreferrer">@{contactLogin}<ArrowUpRight size={12}/></a>
            : <><strong>{displayName}</strong>{canConnect && <a href={"https://github.com/" + contactLogin} target="_blank" rel="noreferrer">@{contactLogin}<ArrowUpRight size={12}/></a>}</>}
        </div>
        {received ? <select className="request-status" disabled={busy} aria-label={"Status for " + r.name} value={r.status} onChange={e=>action({action:"status",id:r.id,status:e.target.value})}>
          {["Received","Reviewing","Accepted","Declined"].map(status=><option key={status}>{status}</option>)}
        </select> : <span className="status">{r.status}</span>}
      </div>
      <div className="request-meta"><span>{r.kind === "idea" ? "Idea" : "Join request"}</span>{received && <span>{r.project_title}</span>}<time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString()}</time></div>
      <p className="application-message pre-wrap">{r.message}</p>
      {acceptedMember && <p className="application-membership-note">Project member in YakKeeper. GitHub permissions are managed separately.</p>}
      <div className="request-footer application-footer">
        {acceptedMember && project && <button className="small-button contribute" onClick={() => {setBoardProject(project); open("board");}}>Task board<ArrowUpRight size={13}/></button>}
        {(project?.repo || received) && <details className="application-details application-more"><summary>More</summary>
          <div className="application-links">
            {!user?.demo && project?.repo && <a className="text-button" href={project.repo} target="_blank" rel="noreferrer">GitHub repository<ArrowUpRight size={13}/></a>}
            {!user?.demo && received && acceptedMember && project?.repo && <a className="text-button" href={project.repo.replace(/\/$/, "") + "/settings/access"} target="_blank" rel="noreferrer">GitHub permissions<ArrowUpRight size={13}/></a>}
            {received && <button disabled={busy} className="text-button block-applicant" onClick={()=>action({action:"block",user_id:r.applicant_id})}>{hub.blocks.includes(r.applicant_id) ? "Unblock across my projects" : "Block across my projects"}</button>}
          </div>
        </details>}
      </div>
    </article>;
  }

  return (
    <div className={"app" + (projectId ? " shared-project-page" : "")}>
      <div className="ambient-background" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
          <defs>
            <path id="signal-right" d="M850-150C390 70 1310 170 1030 480S990 970 1570 1020" />
            <path id="signal-left" d="M-240 160C240 50-100 470 290 610S390 1020 80 1080" />
          </defs>
          <g className="ambient-purple">
            <path d="M850-150C390 70 1310 170 1030 480S990 970 1570 1020" />
            <path d="M910-150C450 70 1370 170 1090 480S1050 970 1630 1020" />
            <path d="M970-150C510 70 1430 170 1150 480S1110 970 1690 1020" />
          </g>
          <g className="ambient-signals">
            <use href="#signal-right" className="signal-trail"/>
            <g><animateMotion dur="16s" repeatCount="indefinite"><mpath href="#signal-right"/></animateMotion><circle r="14" className="signal-halo"/><circle r="5" className="signal-violet"/></g>
            <circle r="3" className="signal-violet"><animateMotion dur="16s" begin="-8s" repeatCount="indefinite"><mpath href="#signal-right"/></animateMotion></circle>
            <g><animateMotion dur="20s" begin="-7s" repeatCount="indefinite"><mpath href="#signal-left"/></animateMotion><circle r="12" className="signal-halo mint-halo"/><circle r="4" className="signal-mint"/></g>
          </g>
          <g className="ambient-mint">
            <path d="M-240 160C240 50-100 470 290 610S390 1020 80 1080" />
            <path d="M-280 195C200 85-140 505 250 645S350 1055 40 1115" />
            <circle cx="290" cy="610" r="4" />
          </g>
        </svg>
      </div>
      <header>
        <a className="brand" href="/" aria-label="YakKeeper home">
          <Image
            src="/brand/yak-mark.svg"
            alt=""
            width={44}
            height={44}
            sizes="44px"
            className="brand-logo"
          />
          <span>
            YakKeeper<span className="brand-period">.</span>
          </span>
        </a>
        <span className="header-divider" />
        <span className="header-description">projects / people / progress</span>
        <div className="header-right">
          <ThemeToggle />
          {user ? (
            <>
              <a className="user-name text-button" href={"https://github.com/" + user.github_login} target="_blank" rel="noreferrer">@{user.github_login}</a>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={signOut}
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <button className="sign-in" onClick={() => open("login")}>
              <Github size={15} />
              Sign in
            </button>
          )}
          <button className="button primary" onClick={addProject}>
            <Plus size={15} />
            Add project
          </button>
        </div>
      </header>
      <main>
        {hub.mode === "local" && (
          <div className="sandbox-bar">
            <span className="status-dot amber" />
            <span>
              Local sandbox · demo accounts, real local saves · no GitHub
              verification
            </span>
            <button onClick={() => open("login")}>
              {user ? "Switch account" : "Try it"}
              <ArrowRight size={12} />
            </button>
          </div>
        )}
        <h1 className="sr-only">{title}</h1>
        <div className="board-toolbar">
          <nav aria-label="Project sections">
            {[
              ["explore", "Explore"],
              ["my", "My projects"],
              ["applications", "Applications"],
              ...(user?.role === "owner" ? [["moderation", "Reports"]] : []),
            ].map(([key, label]) => (
              <button
                key={key}
                className={view === key ? "active" : ""}
                title={key === "applications" ? "Received and sent ideas or join requests" : key === "moderation" ? "Flagged projects — platform administrator only" : undefined}
                onClick={() => navigate(key)}
              >
                {label}
                {key === "applications" &&
                  hub.inbox.some((r) => r.status === "Received") && (
                    <span>
                      {hub.inbox.filter((r) => r.status === "Received").length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          {["explore", "my"].includes(view) && (
            <div className="filters">
              <label className="search">
                <Search size={15} />
                <input
                  ref={searchInput}
                  aria-label="Search projects"
                  placeholder="Search projects, skills or owners"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? <button type="button" className="clear-search icon-button" aria-label="Clear search" onClick={()=>{setQuery("");searchInput.current?.focus();}}><X size={15}/></button> : <kbd>/</kbd>}
              </label>
              <label className="filter">
                <select
                  aria-label="Filter projects"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    "All projects",
                    "Open to teammates",
                    "Beginner friendly",
                    "In progress",
                    "Completed",
                    "Paused",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </label>
            </div>
          )}
        </div>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button onClick={() => void refresh()}>Retry</button>
          </div>
        )}
        {feedback && !modal && !form && (
          <p role="status" className="feedback">
            {feedback}
          </p>
        )}
        {user && view === "my" && hub.invitations?.length > 0 && <section className="project-invitations" aria-label="Project invitations">
          <h2>Project invitations</h2>
          {hub.invitations.map(invite=><article key={invite.id} className="project-invitation"><div><strong>{invite.project_title}</strong><p>@{invite.owner_login} invited you as @{user.github_login}.</p></div><button className="small-button contribute" disabled={busy} onClick={()=>void action({action:"respondInvite",id:invite.id,decision:"accept"})}>Accept invitation</button><button className="text-button" disabled={busy} onClick={()=>void action({action:"respondInvite",id:invite.id,decision:"decline"})}>Decline</button></article>)}
        </section>}
        {loading ? (
          <div className="empty">Loading projects…</div>
        ) : !hub.configured ? (
          <div className="empty">
            <Layers size={26} />
            <h2>Almost ready to connect.</h2>
            <p>GitHub sign-in and the database need configuration.</p>
          </div>
        ) : ["my", "applications", "moderation"].includes(view) &&
          !user ? (
          <div className="empty">
            <Github size={26} />
            <p>Sign in to manage your projects and applications.</p>
            <button className="button primary" onClick={() => open("login")}>
              Continue with GitHub
              <ArrowRight size={14} />
            </button>
          </div>
        ) : view === "applications" ? (
          <section className="inbox-list">
            <div className="application-tabs">
              <button
                className={applicationTab === "received" ? "selected" : ""}
                onClick={() => setApplicationTab("received")}
              >
                Received <span>{hub.inbox.length}</span>
              </button>
              <button
                className={applicationTab === "sent" ? "selected" : ""}
                onClick={() => setApplicationTab("sent")}
              >
                Sent <span>{hub.sent.length}</span>
              </button>
            </div>
            {requests.map(requestCard)}
            {!requests.length && (
              <div className="empty">
                <Inbox size={24} />
                <p>
                  {applicationTab === "received"
                    ? "Applications to your projects will appear here."
                    : "Your ideas and applications will appear here."}
                </p>
              </div>
            )}
          </section>
        ) : view === "moderation" ? (
          <section>
            {hub.reports.map((r) => (
              <article className="request" key={r.id}>
                <div className="request-meta">
                  <span>{r.status}</span>
                  <span>{r.project_id}</span>
                </div>
                <p>{r.reason}</p>
                {r.status === "Open" && (
                  <div className="project-actions">
                    <button
                      disabled={busy}
                      className="small-button"
                      onClick={() =>
                        action({
                          action: "moderate",
                          id: r.id,
                          decision: "Dismissed",
                        })
                      }
                    >
                      Dismiss
                    </button>
                    <button
                      disabled={busy}
                      className="small-button"
                      onClick={() =>
                        action({
                          action: "moderate",
                          id: r.id,
                          decision: "Archived",
                        })
                      }
                    >
                      Archive project
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!hub.reports.length && (
              <div className="empty">
                <ShieldCheck size={24} />
                <p>No reports.</p>
              </div>
            )}
          </section>
        ) : (
          <section className="project-list">
            {list.map((p, index) => (
              <article
                className={"project " + (expanded === p.id ? "expanded" : "")}
                key={p.id}
              >
                <div className="project-row">
                  <span className="project-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="project-mark">
                    <ProjectArt
                      key={p.banner_url}
                      banner={p.banner_url}
                      title={p.title}
                      category={p.category}
                      index={index}
                    />
                  </div>
                  <div className="project-content">
                    <div className="project-title-line">
                      <button
                        className="project-title"
                        aria-expanded={expanded === p.id}
                        onClick={() =>
                          setExpanded(expanded === p.id ? "" : p.id)
                        }
                      >
                        {p.title}
                        <ChevronDown size={14} />
                      </button>
                      <span className="status">{p.status}</span>
                    </div>
                    <div className="project-meta project-identity-row">
                      <a className="project-owner" href={"https://github.com/" + p.owner_login} target="_blank" rel="noreferrer" aria-label={"View @" + p.owner_login + " on GitHub"}><Github size={14} />@{p.owner_login}</a>
                      {p.repo && <a className="project-repository" href={p.repo} target="_blank" rel="noreferrer" aria-label={"Open " + p.title + " repository on GitHub"}>Repository<ArrowUpRight size={15}/></a>}
                    </div>
                    {p.needs && <div className="project-looking-for">
                      <span>Looking for</span>
                      <p>{p.needs}</p>
                    </div>}
                    {p.starter_title && <div className="starter-task"><span>Start here{p.starter_time ? " · " + p.starter_time : ""}</span><strong>{p.starter_title}</strong>{p.starter_url && <a href={p.starter_url} target="_blank" rel="noreferrer">View GitHub issue<ArrowUpRight size={13}/></a>}</div>}
                    <div className="project-badges">
                      {p.beginner_friendly && <span>Beginner friendly</span>}
                      <span>
                        {p.contributions_open && p.status === "In progress"
                          ? (p.join_policy === "invite_only" ? "Invite only" : "Open to teammates")
                          : "Requests closed"}
                      </span>
                      {view === "my" && <span>{p.owner_id === user?.id ? "Owner" : "Joined"}</span>}
                      {view === "my" && p.owner_id === user?.id && <span>{p.visibility}</span>}
                    </div>
                  </div>
                  <div className="project-actions">
                    <button className="small-button" onClick={async()=>{const url=location.origin+"/projects/"+p.id;try{await navigator.clipboard.writeText(url);setFeedback("Project link copied.");}catch{setFeedback("Share this link: "+url);}}}>Copy share link</button>
                    {p.owner_id === user?.id && <button className="small-button" onClick={()=>{setBoardProject(p);open("members");}}>Members</button>}
                    {user && (p.owner_id === user.id || joined.has(p.id)) && <button className="small-button task-board-open" onClick={() => {setBoardProject(p); open("board");}}>Task board<ArrowUpRight size={13}/></button>}
                    {p.owner_id === user?.id ? (
                      <button className="small-button" onClick={() => edit(p)}>
                        Edit project
                        <ArrowUpRight size={13} />
                      </button>
                    ) : joined.has(p.id) ? (
                      <button className="small-button" onClick={() => {
                        navigate("applications");
                        setApplicationTab("sent");
                      }}>
                        View application<ArrowUpRight size={13} />
                      </button>
                    ) : (
                      <>
                        <button
                          className="small-button"
                          disabled={
                            !p.contributions_open || p.status !== "In progress"
                          }
                          onClick={() => request(p, "idea")}
                        >
                          Idea
                          <Plus size={13} />
                        </button>
                        <button
                          className="small-button contribute"
                          disabled={
                            !p.contributions_open || p.status !== "In progress" || p.join_policy === "invite_only"
                          }
                          onClick={() => request(p, "contribution")}
                        >
                          {p.join_policy === "invite_only" ? "Invite only" : "Join project"}
                          <ArrowUpRight size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {expanded === p.id && (
                  <div className="project-details">
                    <p className="pre-wrap">{p.description}</p>
                    {p.roadmap && (
                      <div className="roadmap">
                        <span>UP NEXT</span>
                        {p.roadmap
                          .split("\n")
                          .filter(Boolean)
                          .map((item, i) => (
                            <div key={i}>
                              <span className="roadmap-dot" />
                              {item}
                            </div>
                          ))}
                      </div>
                    )}
                    <div className="project-links">
                      {p.demo && (
                        <a href={p.demo} target="_blank" rel="noreferrer">
                          Live demo
                          <ArrowUpRight size={12} />
                        </a>
                      )}
                      {user && p.owner_id !== user.id && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setReportProject(p.id);
                            open("report");
                          }}
                        >
                          <Flag size={12} />
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {form?.project.id === p.id && (
                  <div className="inline-panel">
                    <div className="inline-title">
                      <h2>
                        {form.kind === "idea"
                          ? "Share an idea"
                          : "Join this project"}
                      </h2>
                      <button
                        className="icon-button"
                        aria-label="Close application"
                        onClick={() => setForm(null)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p className="application-as">
                      Applying as @{user?.github_login} ·{" "}
                      {user?.demo ? "sandbox account" : "GitHub connected"}
                    </p>
                    <form
                      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        if (
                          await action({
                            action: "submit",
                            project_id: p.id,
                            kind: form.kind,
                            message: f.get("message"),
                            website: f.get("website") || "",
                          })
                        ) {
                          setForm(null);
                          navigate("applications");
                          setApplicationTab("sent");
                          setFeedback("Sent. Track the response here.");
                        }
                      }}
                    >
                      <label>
                        {form.kind === "idea"
                          ? "Your idea"
                          : "What would you like to contribute?"}
                        <textarea
                          name="message"
                          required
                          minLength={20}
                          maxLength={4000}
                          rows={3}
                          placeholder="Your skills, what you can help with, and your availability."
                        />
                      </label>
                      <label className="honeypot" aria-hidden="true">
                        Website
                        <input
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                        />
                      </label>
                      <div className="send-row">
                        <small>
                          Visible only to you and this project’s owner.
                        </small>
                        <button className="button primary" disabled={busy}>
                          Send
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </form>
                    {feedback && (
                      <p className="feedback" role="status">
                        {feedback}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
            {!list.length && (
              <div className="empty">
                <Layers size={25} />
                <h2>
                  {query
                    ? "No matching projects."
                    : view === "my"
                      ? "No owned or joined projects yet."
                      : "Be the first to build together."}
                </h2>
                <p>
                  {query
                    ? "Try another skill or project name."
                    : view === "my"
                      ? "Publish a project or join one from Explore. Accepted join requests appear here."
                      : "Choose a GitHub repository and tell people what help you need."}
                </p>
                <button className="button primary" onClick={addProject}>
                  Add project
                  <Plus size={14} />
                </button>
              </div>
            )}
            {hub.hasMore && view === "explore" && (
              <button
                className="button small-button load-more"
                onClick={() => setPage(page + 1)}
              >
                Load more projects
              </button>
            )}
          </section>
        )}
        <div className="board-end">
          <span>BUILD / LEARN / COLLABORATE</span>
          <span className="end-line" />
          <span>
            BETTER TOGETHER
            <ArrowUpRight size={11} />
          </span>
        </div>
      </main>
      <footer>
        <span>YakKeeper © {copyrightYear}</span>
        <span className="footer-tagline">Where projects meet their next contributors.</span>
        <a className="github-star-button" href="https://github.com/4Raisan/YakKeeper" target="_blank" rel="noopener noreferrer"><Star size={15} aria-hidden="true"/>Star on GitHub</a>
      </footer>
      {modal && (
        <div className="modal-backdrop">
          <section
            className={"modal" + (modal === "board" ? " task-board-dialog" : modal === "login" ? " login-dialog" : modal === "editor" ? " editor-dialog" : "")}
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "members" ? "Project members" : modal === "board" ? "Project task board" : modal === "repos"
                ? "Choose a repository"
                : modal === "editor"
                  ? "Project editor"
                  : modal === "report"
                    ? "Report project"
                    : "Sign in"
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const items = dialog.current?.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input:not(:disabled),select,textarea,a[href]",
                );
                if (items?.length) {
                  const first = items[0],
                    last = items[items.length - 1];
                  if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                  }
                }
              }
            }}
          >
            {modal === "login" && <div className="login-brand-banner">
              <div className="login-brand-lockup">
                <Image src="/brand/yak-mark.svg" alt="" width={76} height={76} />
                <div><span>YakKeeper<span className="brand-period">.</span></span><p>Where projects meet their next contributors.</p></div>
              </div>
            </div>}
            <div className="modal-heading">
              <h2>
                {modal === "members" ? "Members · " + boardProject?.title : modal === "board" ? (boardProject?.title || "Project") + " · Task board" : modal === "repos"
                  ? "Choose a repository"
                  : modal === "editor"
                    ? editing
                      ? "Edit project"
                      : "Make room for a teammate"
                    : modal === "report"
                      ? "Report project"
                      : "Find your people. Build together."}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={close}
              >
                <X size={19} />
              </button>
            </div>
            {modal === "members" && boardProject && user && <ProjectMembers key={boardProject.id+user.id} project={boardProject} onChange={refresh}/>}
            {modal === "board" && boardProject && user && <TaskBoard key={boardProject.id + user.id} project={boardProject} user={user}/>}
            {modal === "login" && (
              <div className="login-panel">
                <p className="login-intro">Bring a project. Find a teammate. Start building.</p>
                <button
                  className="button primary full"
                  disabled={busy || hub.mode !== "live"}
                  onClick={signIn}
                >
                  <Github size={18} />
                  {busy ? "Connecting to GitHub…" : "Continue with GitHub"}
                  <ArrowUpRight size={14} />
                </button>
                <small className="login-trust"><ShieldCheck size={16} /><span>GitHub handles sign-in.<br />No password sharing or repository write access.</span></small>
                {hub.mode !== "live" && (
                  <p className="setup-note">
                    Real GitHub sign-in needs OAuth and server configuration.
                  </p>
                )}
                {hub.mode === "local" && (
                  <div className="demo-accounts">
                    <span>TRY THE LOCAL SANDBOX</span>
                    <button className="small-button" disabled={busy} onClick={async()=>{
                      if(await action({action:"demoSeed"})) setFeedback("Test workspace ready: 4 projects and 8 applications. Choose an account below.");
                    }}>Load test workspace<Layers size={15}/></button>
                    <p>
                      These accounts are for testing. They are not GitHub
                      verified.
                    </p>
                    {demoAccounts.map(({id,name}) => (
                      <button
                        className="small-button"
                        disabled={busy}
                        key={id}
                        onClick={async () => {
                          gate.current.invalidate();
                          readAbort.current?.abort();
                          setForm(null);
                          setRepos([]);
                          if (
                            await action({ action: "demoLogin", user_id: id })
                          ) {
                            setModal("");
                            navigate("explore");
                          }
                        }}
                      >
                        {name}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {modal === "repos" && (
              <>
                <p className="modal-note">
                  Your public repositories. Select one to fill the project
                  details.
                </p>
                <label className="repo-search">
                  <Search size={16} />
                  <input
                    aria-label="Search repositories"
                    placeholder="Search your repositories"
                    value={repoQuery}
                    onChange={(e) => setRepoQuery(e.target.value)}
                  />
                </label>
                {repoError && (
                  <div className="feedback" role="alert">
                    {repoError}
                    <button
                      className="text-button"
                      onClick={() => void loadRepos(repoPage)}
                    >
                      Retry
                    </button>
                  </div>
                )}
                <div className="repo-list">
                  {repos
                    .filter((r) =>
                      `${r.name} ${r.language || ""}`
                        .toLowerCase()
                        .includes(repoQuery.toLowerCase()),
                    )
                    .map((r) => (
                      <button
                        className="repo-option"
                        key={r.id}
                        onClick={() => chooseRepo(r)}
                      >
                        <Github size={18} />
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.description || "No description yet."}
                          </small>
                          <em>
                            {r.language || "Repository"}
                            {r.fork ? " · Fork" : ""}
                            {!r.html_url ? " · Sandbox example" : ""}
                          </em>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                </div>
                {repoLoading && <p role="status">Loading repositories…</p>}
                {!repoLoading && !repos.length && !repoError && (
                  <p>No public repositories found.</p>
                )}
                {moreRepos && (
                  <button
                    disabled={repoLoading}
                    className="small-button full"
                    onClick={() => void loadRepos(repoPage + 1)}
                  >
                    Load more repositories
                  </button>
                )}
              </>
            )}
            {modal === "editor" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await action({
                      action: "saveProject",
                      id: editing || undefined,
                      project: Object.fromEntries(Object.entries(editor).filter(([key]) => !["title", "summary", "description", "tags"].includes(key))),
                    })
                  ) {
                    setModal("");
                    navigate("my");
                  }
                }}
              >
                <div className="connected-repo">
                  <Github size={15} />
                  {repoLabel}
                </div>
                <div className="repo-preview">
                  <p>{editor.summary || "Add a description in GitHub’s About section."}</p>
                  {editor.tags && <span>{editor.tags}</span>}
                  <small>Name, description and language sync from GitHub.</small>
                </div>
                <div className="banner-picker">
                  <label className="banner-upload banner-upload-bar">
                  {(editor.banner_data || (editor.banner_data !== null && editor.banner_url)) && <img className="banner-preview" src={editor.banner_data || editor.banner_url} alt="Banner preview" />}
                  <div>
                    <span>{bannerBusy ? "Preparing image…" : (editor.banner_data || (editor.banner_data !== null && editor.banner_url)) ? "Change banner" : "Add banner"}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || bannerBusy} onChange={async e => {
                        const file = e.target.files?.[0]; e.target.value="";
                        if (!file) return;
                        setBannerBusy(true); setFeedback("");
                        try {const image = await bannerImage(file); setEditor(current => ({...current,banner_data:image}));}
                        catch(error) {setFeedback((error as Error).message);}
                        finally {setBannerBusy(false);}
                      }} />
                    <small>PNG, JPEG or WebP · cropped to 3:1</small>
                  </div>
                  </label>
                  {(editor.banner_data || (editor.banner_data !== null && editor.banner_url)) && <button type="button" className="text-button" disabled={busy || bannerBusy} onClick={()=>setEditor({...editor,banner_data:null})}>Remove</button>}
                </div>
                <label>Looking for <span className="optional-label">optional</span>
                  <input maxLength={1000} placeholder="Frontend, design, documentation…" value={editor.needs} onChange={e => setEditor({...editor, needs:e.target.value})} />
                </label>
                <div className="editor-selects">
                  <label>Project type
                    <select value={editor.category} onChange={e => setEditor({...editor,category:e.target.value})}>{projectCategories.map(type => <option key={type}>{type}</option>)}</select>
                  </label>
                  <label>Project status
                    <select value={editor.status} onChange={e => setEditor({...editor,status:e.target.value})}>{["In progress","Completed","Paused"].map(value => <option key={value}>{value}</option>)}</select>
                  </label>
                  <label>Who can see it
                    <select value={editor.visibility} onChange={e => setEditor({...editor,visibility:e.target.value})}><option value="public">Everyone</option><option value="private">Only me</option><option value="archived">Archived</option></select>
                  </label>
                </div>
                <details className="editor-extra">
                  <summary>More details <span className="optional-label">optional</span></summary>
                  <label>Next steps
                    <textarea rows={2} maxLength={3000} value={editor.roadmap} onChange={e => setEditor({...editor, roadmap:e.target.value})} />
                  </label>
                  <label>Live demo URL
                    <input type="url" maxLength={500} value={editor.demo} onChange={e => setEditor({...editor, demo:e.target.value})} />
                  </label>
                </details>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={editor.beginner_friendly}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        beginner_friendly: e.target.checked,
                      })
                    }
                  />
                  Beginners welcome
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={editor.contributions_open}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        contributions_open: e.target.checked,
                      })
                    }
                  />
                  Accepting ideas and requests
                </label>
                <label>How people join<select value={editor.join_policy || "open"} onChange={e=>setEditor({...editor,join_policy:e.target.value as "open"|"invite_only"})}><option value="open">Open applications</option><option value="invite_only">Invite only</option></select></label>
                <p className="modal-note">Invite-only projects can stay public in Explore. Owners manage invitations in Members.</p>
                <label>Starter task<input maxLength={160} value={editor.starter_title || ""} onChange={e=>setEditor({...editor,starter_title:e.target.value})} placeholder="One useful thing a newcomer can do"/></label>
                <label>Starter task GitHub issue (optional)<input type="url" maxLength={500} value={editor.starter_url || ""} onChange={e=>setEditor({...editor,starter_url:e.target.value})} placeholder="https://github.com/owner/repo/issues/123"/></label>
                <label>Starter task effort (optional)<input maxLength={80} value={editor.starter_time || ""} onChange={e=>setEditor({...editor,starter_time:e.target.value})} placeholder="30 minutes · beginner friendly"/></label>
                <button className="button primary full" disabled={busy || bannerBusy}>
                  {busy
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Publish project"}
                  <Check size={14} />
                </button>
                {editing && <div className="delete-project">
                  {!confirmDelete ? <button type="button" className="text-button delete-project-link" disabled={busy || bannerBusy} onClick={()=>setConfirmDelete(true)}>Delete from YakKeeper</button> : <div role="group" aria-label="Confirm project deletion">
                    <strong>Delete this listing permanently?</strong>
                    <p>Its applications, ideas, reports and banner will also be removed. Your GitHub repository stays untouched.</p>
                    <div className="delete-project-actions">
                      <button type="button" className="small-button" disabled={busy} onClick={()=>setConfirmDelete(false)}>Keep project</button>
                      <button type="button" className="small-button danger-button" disabled={busy || bannerBusy} onClick={async()=>{
                        if(await action({action:"deleteProject",id:editing,confirm:true})) {setModal("");setEditing("");setExpanded("");}
                      }}>{busy ? "Deleting…" : "Delete permanently"}</button>
                    </div>
                  </div>}
                </div>}
              </form>
            )}
            {modal === "report" && (
              <form
                onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await action({
                      action: "report",
                      project_id: reportProject,
                      reason: f.get("reason"),
                    })
                  ) {
                    setModal("");
                    setFeedback("Report sent for review.");
                  }
                }}
              >
                <label>
                  What is wrong with this project?
                  <textarea
                    name="reason"
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={4}
                  />
                </label>
                <button disabled={busy} className="button primary full">
                  Send report
                  <Flag size={14} />
                </button>
              </form>
            )}
            {feedback && (
              <p className="feedback" role="status">
                {feedback}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
