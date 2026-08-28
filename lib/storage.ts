const KEY = "veil.projects";
const ACTIVE = "veil.active";

export function loadProjects(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: unknown[]) {
  localStorage.setItem(KEY, JSON.stringify(projects));
}

export function setActiveProject(project: unknown) {
  sessionStorage.setItem(ACTIVE, JSON.stringify(project));
}

export function getActiveProject<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const PENDING = "veil.pendingAssets";

export function stashPendingAssets(assets: unknown[]) {
  sessionStorage.setItem(PENDING, JSON.stringify(assets));
}

export function takePendingAssets<T>(): T[] {
  try {
    const raw = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function peekPendingAssets<T>(): T[] {
  try {
    const raw = sessionStorage.getItem(PENDING);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
