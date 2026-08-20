export interface WorkspaceRecord<T> {
  key: string;
  value: T;
  savedAt: string;
}

const memory = new Map<string, string>();

function getStore() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    return null;
  }
  return null;
}

export function saveWorkspace<T>(key: string, value: T): WorkspaceRecord<T> {
  const record = { key, value, savedAt: new Date().toISOString() };
  const serialized = JSON.stringify(record);
  const store = getStore();
  if (store) store.setItem(key, serialized);
  else memory.set(key, serialized);
  return record;
}

export function loadWorkspace<T>(key: string): WorkspaceRecord<T> | null {
  const store = getStore();
  const serialized = store ? store.getItem(key) : memory.get(key);
  if (!serialized) return null;
  return JSON.parse(serialized) as WorkspaceRecord<T>;
}
