import { useState, useEffect, useCallback } from 'react';
import type { StreamArchive } from './types';
import { getAllArchives } from './archiveStorage';

export function useArchives() {
  const [archives, setArchives] = useState<StreamArchive[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshArchives = useCallback(async () => {
    try {
      const list = await getAllArchives();
      setArchives(list);
    } catch (e) {
      console.error('Failed to load archives:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshArchives();

    // Listen for WebSocket archive_created events if any
    const handleWsArchive = (e: CustomEvent<StreamArchive>) => {
      if (e.detail) {
        setArchives((prev) => {
          if (prev.some((a) => a.id === e.detail.id)) return prev;
          return [e.detail, ...prev];
        });
      }
    };

    window.addEventListener('applet:archive_created' as any, handleWsArchive as any);
    return () => {
      window.removeEventListener('applet:archive_created' as any, handleWsArchive as any);
    };
  }, [refreshArchives]);

  const removeArchiveFromState = (id: string) => {
    setArchives((prev) => prev.filter((a) => a.id !== id));
  };

  return {
    archives,
    isLoading,
    refreshArchives,
    removeArchiveFromState,
  };
}
