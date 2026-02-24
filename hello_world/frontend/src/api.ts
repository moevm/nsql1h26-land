export interface User {
  _id: string;
  name: string;
  age: number;
  city: string;
}

export interface LogEntry {
  time: string;
  op: string;
  detail: string;
}

export interface DbInfo {
  server: string;
  host: string;
  port: number;
  database: string;
  collection: string;
  documents: number;
  storageSize: number;
  indexes: number;
}

const API = "/api/users";

export async function getUsers(): Promise<User[]> {
  const res = await fetch(API);
  return res.json();
}

export async function createUser(
  user: Omit<User, "_id">
): Promise<User> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  return res.json();
}

export async function updateUser(
  id: string,
  user: Omit<User, "_id">
): Promise<User> {
  const res = await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  return res.json();
}

export async function deleteUser(id: string): Promise<void> {
  await fetch(`${API}/${id}`, { method: "DELETE" });
}

export async function getLogs(): Promise<LogEntry[]> {
  const res = await fetch("/api/logs");
  return res.json();
}

export async function getDbInfo(): Promise<DbInfo> {
  const res = await fetch("/api/dbinfo");
  return res.json();
}
