"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Users, CheckCircle2 } from "lucide-react";
import { authHeaders } from "@/lib/supabase-browser";
import { taskStatuses, type TaskBoardState } from "@/lib/task-types";
import type { Project, Profile } from "@/lib/hub-types";

export default function TaskBoard({ project, user }: { project: Project; user: Profile }) {
  const [board, setBoard] = useState<TaskBoardState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const read = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const channel = useRef<BroadcastChannel | null>(null);
  const readonly = project.visibility === "archived";
  const refresh = useCallback(async () => {
    read.current?.abort();
    const abort = new AbortController();
    read.current = abort;
    try {
      const response = await fetch("/api/hub?resource=board&project_id=" + project.id,
        {headers: await authHeaders(), signal: abort.signal, cache: "no-store"});
      const data = await response.json();
      if (abort.signal.aborted || !alive.current) return;
      if (!response.ok) {
        setBoard(null);
        throw Error(data.error || "Could not load the task board.");
      }
      setBoard(data);
      setError("");
    } catch (e) {
      if (!abort.signal.aborted && alive.current) setError((e as Error).message);
    }
  }, [project.id]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(); };
    const timer = setInterval(onFocus, 20000);
    window.addEventListener("focus", onFocus);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("yakkeeper-tasks-" + project.id);
      channel.current.onmessage = onFocus;
    }
    return () => {
      alive.current = false;
      read.current?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      channel.current?.close();
    };
  }, [refresh, project.id]);
  async function change(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/hub", {method: "POST",
        headers: {"Content-Type":"application/json", ...(await authHeaders())},
        body: JSON.stringify({...payload, project_id: project.id})});
      const data = await response.json();
      if (!response.ok) {
        if ([401,403,404].includes(response.status) && alive.current) setBoard(null);
        throw Error(data.error || "Could not save the task.");
      }
      if (alive.current) {
        await refresh();
        channel.current?.postMessage("changed");
      }
      return true;
    } catch (e) {
      if (alive.current) setError((e as Error).message);
      return false;
    } finally { if (alive.current) setBusy(false); }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (await change({action:"createTask", task:{title:data.get("title"),
      description:data.get("description"), status:data.get("status")}})) {
      form.reset();
      setAdding(false);
    }
  }
  return <div className="task-board" aria-busy={busy}>
    <div className="task-board-toolbar">
      <p>Plan together. Pick a task, show you’re working on it, and mark it finished.</p>
      <button type="button" className="small-button" onClick={() => void refresh()} disabled={busy} aria-label="Refresh tasks"><RefreshCw size={15}/>Refresh</button>
      {board && !readonly && <button type="button" className="small-button contribute" onClick={() => setAdding(!adding)} disabled={busy} aria-expanded={adding}><Plus size={15}/>Add task</button>}
    </div>
    {error && <p className="task-board-error" role="alert">{error}</p>}
    {!board && !error && <p role="status">Loading tasks…</p>}
    {readonly && <p className="task-board-note">This project is archived. Its board is read-only.</p>}
    {adding && board && !readonly && <form className="task-create" onSubmit={create}>
      <label>Task title<input name="title" required minLength={3} maxLength={160} placeholder="What needs to be done?" disabled={busy}/></label>
      <label>Details <small>(optional)</small><textarea name="description" maxLength={2000} rows={3} placeholder="A useful outcome or next step" disabled={busy}/></label>
      <label>Start in<select name="status" defaultValue="Future" disabled={busy}>{taskStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
      <div className="task-create-actions"><button className="button primary" disabled={busy}>Create task</button><button type="button" className="small-button" onClick={() => setAdding(false)} disabled={busy}>Cancel</button></div>
    </form>}
    {board && <>
      <div className="task-board-summary"><Users size={15}/><span>Owner and accepted members</span><span>{board.tasks.filter(t => t.status === "Finished").length} / {board.tasks.length} finished</span></div>
      <div className="kanban-columns">{taskStatuses.map(status => {
        const tasks = board.tasks.filter(t => t.status === status);
        return <section className={"kanban-column column-" + status.toLowerCase()} key={status} aria-label={status + " tasks"}>
          <h3><span className="kanban-dot"/>{status}<span className="task-count">{tasks.length}</span></h3>
          {tasks.map(task => {
            const workers = board.workers.filter(w => w.task_id === task.id);
            const mine = workers.some(w => w.user_id === user.id);
            return <article className="task-card" key={task.id}>
              <h4>{task.title}</h4>
              {task.description && <p className="pre-wrap">{task.description}</p>}
              <div className="task-workers" aria-label="Task participants">
                {workers.length ? workers.map(w => <span key={w.id}>@{w.login}</span>) : <small>No one assigned yet</small>}
              </div>
              <label className="task-status-label">Status<select aria-label={"Status for " + task.title} value={task.status} disabled={busy || readonly}
                onChange={e => void change({action:"taskStatus", id:task.id, status:e.target.value})}>
                {taskStatuses.map(s => <option key={s}>{s}</option>)}
              </select></label>
              {!readonly && (task.status !== "Finished" || mine) && <button type="button" className={"task-work-button" + (mine ? " working" : "")}
                disabled={busy} aria-pressed={mine} onClick={() => void change({action:"workOnTask", id:task.id, working:!mine})}>
                {mine ? <CheckCircle2 size={15}/> : <Plus size={15}/>}{mine ? "I’m on this · leave" : "I’m working on this"}
              </button>}
            </article>;
          })}
          {!tasks.length && <p className="kanban-empty">{status === "Future" ? "Ideas and next steps go here." : status === "Ongoing" ? "Ready when the team is." : "Finished work will appear here."}</p>}
        </section>;
      })}</div>
      <p className="task-board-note">Changes sync when you return to this tab and every 20 seconds. Joining a task does not grant GitHub repository access.</p>
    </>}
  </div>;
}
