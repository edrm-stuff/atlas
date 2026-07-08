import type { CatalogPost, Collection, UserState } from "../types.js";

const DB_NAME = "atlas";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

export async function openDb(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("posts")) db.createObjectStore("posts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("collections")) db.createObjectStore("collections", { keyPath: "name" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, stores: string[], mode: IDBTransactionMode) {
  return db.transaction(stores, mode);
}

function store(t: IDBTransaction, name: string) {
  return t.objectStore(name);
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

export async function getAllPosts(): Promise<CatalogPost[]> {
  const db = await openDb();
  return wrap(store(tx(db, ["posts"], "readonly"), "posts").getAll());
}

export async function putPost(post: CatalogPost): Promise<void> {
  const db = await openDb();
  await wrap(store(tx(db, ["posts"], "readwrite"), "posts").put(post));
}

export async function putPosts(posts: CatalogPost[]): Promise<void> {
  const db = await openDb();
  const t = tx(db, ["posts"], "readwrite");
  const s = store(t, "posts");
  await Promise.all(posts.map((p) => wrap(s.put(p))));
}

export async function clearPosts(): Promise<void> {
  const db = await openDb();
  await wrap(store(tx(db, ["posts"], "readwrite"), "posts").clear());
}

export async function getAllCollections(): Promise<Collection[]> {
  const db = await openDb();
  return wrap(store(tx(db, ["collections"], "readonly"), "collections").getAll());
}

export async function putCollections(cols: Collection[]): Promise<void> {
  const db = await openDb();
  const t = tx(db, ["collections"], "readwrite");
  const s = store(t, "collections");
  s.clear();
  await Promise.all(cols.map((c) => wrap(s.put(c))));
}

export async function getKv<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return wrap(store(tx(db, ["kv"], "readonly"), "kv").get(key));
}

export async function putKv(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await wrap(store(tx(db, ["kv"], "readwrite"), "kv").put(value, key));
}

export async function loadUserState(): Promise<UserState | undefined> {
  return getKv<UserState>("userState");
}

export async function saveUserState(state: UserState): Promise<void> {
  return putKv("userState", state);
}
