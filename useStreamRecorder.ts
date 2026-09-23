import { useState, useRef, useCallback } from 'react';

export interface StreamRecorderHook {
  isRecording: boolean;
  recordedDuration: number;
  recordedBlob: Blob | null;
  startRecording: (stream: MediaStream) => boolean;
  stopRecording: () => Promise<Blob | null>;
  resetRecording: () => void;
}

export function useStreamRecorder(): StreamRecorderHook {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const startRecording = useCallback((stream: MediaStream): boolean => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      console.warn('MediaRecorder is not supported in this browser environment');
      return false;
    }

    try {
      // Find optimal mime type supported by the browser
      let mimeType = '';
      const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
            : null;
        setRecordedBlob(fullBlob);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (stopResolveRef.current) {
          stopResolveRef.current(fullBlob);
          stopResolveRef.current = null;
        }
      };

      recorder.onerror = (err) => {
        console.error('MediaRecorder error:', err);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      // Request data every 1 second
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordedDuration(0);
      setRecordedBlob(null);

      timerRef.current = setInterval(() => {
        setRecordedDuration((prev) => prev + 1);
      }, 1000);

      return true;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      return false;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(recordedBlob);
        return;
      }
      stopResolveRef.current = resolve;
      try {
        mediaRecorderRef.current.stop();
      } catch {
        resolve(null);
      }
    });
  }, [recordedBlob]);

  const resetRecording = useCallback(() => {
    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordedDuration(0);
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    isRecording,
    recordedDuration,
    recordedBlob,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
