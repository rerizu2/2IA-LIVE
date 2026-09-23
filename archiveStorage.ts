import type { StreamArchive, ChatMessage } from './types';

const DB_NAME = 'livestream_app_db';
const DB_VERSION = 1;
const STORE_VIDEOS = 'archive_videos';
const STORE_ARCHIVES = 'local_archives';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS);
      }
      if (!db.objectStoreNames.contains(STORE_ARCHIVES)) {
        db.createObjectStore(STORE_ARCHIVES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save recorded video Blob to browser IndexedDB
 */
export async function saveLocalVideoBlob(archiveId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readwrite');
      const store = tx.objectStore(STORE_VIDEOS);
      const req = store.put(blob, archiveId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save local video blob in IndexedDB:', err);
  }
}

/**
 * Retrieve recorded video Blob from browser IndexedDB
 */
export async function getLocalVideoBlob(archiveId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_VIDEOS, 'readonly');
      const store = tx.objectStore(STORE_VIDEOS);
      const req = store.get(archiveId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Delete local video blob
 */
export async function deleteLocalVideoBlob(archiveId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_VIDEOS, 'readwrite');
      const store = tx.objectStore(STORE_VIDEOS);
      const req = store.delete(archiveId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Fetch all archives from server API
 */
export async function fetchServerArchives(): Promise<StreamArchive[]> {
  try {
    const res = await fetch('/api/archives');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.archives || [];
  } catch (err) {
    console.warn('Failed to fetch archives from server, checking local cache:', err);
    return getLocalArchives();
  }
}

export const getAllArchives = fetchServerArchives;

/**
 * Fetch a single archive by ID
 */
export async function fetchServerArchiveById(id: string): Promise<StreamArchive | null> {
  try {
    const res = await fetch(`/api/archives/${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      return data.archive || null;
    }
  } catch (err) {
    console.warn('Failed to fetch archive by id:', err);
  }
  const locals = await getLocalArchives();
  return locals.find((a) => a.id === id) || null;
}

/**
 * Save new archive to server and local backup
 */
export async function saveArchive(archive: StreamArchive, videoBlob?: Blob): Promise<StreamArchive> {
  if (videoBlob) {
    await saveLocalVideoBlob(archive.id, videoBlob);
    archive.hasRecordedVideo = true;
  }

  // Also save to local IndexedDB
  await saveLocalArchive(archive);

  // Send to server
  try {
    const res = await fetch('/api/archives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(archive),
    });
    if (res.ok) {
      const data = await res.json();
      return data.archive;
    }
  } catch (err) {
    console.warn('Server archive sync notice:', err);
  }

  return archive;
}

/**
 * Delete archive from server and local storage
 */
export async function deleteArchive(archiveId: string): Promise<boolean> {
  await deleteLocalVideoBlob(archiveId);
  await deleteLocalArchive(archiveId);

  try {
    const res = await fetch(`/api/archives/${encodeURIComponent(archiveId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return true;
  }
}

/**
 * Like an archive
 */
export async function likeArchive(archiveId: string): Promise<number> {
  try {
    const res = await fetch(`/api/archives/${encodeURIComponent(archiveId)}/like`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      return data.likes;
    }
  } catch {
    // Ignore error
  }
  return 0;
}

/**
 * Post comment to an archive
 */
export async function postArchiveComment(archiveId: string, comment: Partial<ChatMessage>): Promise<ChatMessage | null> {
  try {
    const res = await fetch(`/api/archives/${encodeURIComponent(archiveId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    if (res.ok) {
      const data = await res.json();
      return data.comment;
    }
  } catch {
    // Ignore error
  }
  return null;
}

// Local storage fallback helpers
async function saveLocalArchive(archive: StreamArchive): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ARCHIVES, 'readwrite');
    tx.objectStore(STORE_ARCHIVES).put(archive);
  } catch {
    // Ignore error
  }
}

async function getLocalArchives(): Promise<StreamArchive[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ARCHIVES, 'readonly');
      const req = tx.objectStore(STORE_ARCHIVES).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function deleteLocalArchive(archiveId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ARCHIVES, 'readwrite');
    tx.objectStore(STORE_ARCHIVES).delete(archiveId);
  } catch {
    // Ignore error
  }
}

/**
 * Download recorded video file directly
 */
export function downloadRecordedVideo(blob: Blob, title: string = 'stream_recording'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_');
  a.download = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download chat replay log as JSON
 */
export function downloadChatLogJson(archive: StreamArchive): void {
  const data = JSON.stringify(
    {
      archiveId: archive.id,
      title: archive.title,
      broadcaster: archive.broadcasterName,
      date: new Date(archive.startedAt).toISOString(),
      durationSeconds: archive.duration,
      totalComments: archive.comments.length,
      comments: archive.comments,
    },
    null,
    2
  );
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = archive.title.replace(/[/\\?%*:|"<>]/g, '_');
  a.download = `${safeTitle}_chat_log.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
