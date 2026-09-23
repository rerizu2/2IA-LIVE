import { useState, useRef, useEffect, useCallback } from 'react';

export type StreamSourceType = 'camera' | 'screen' | 'virtual';

export interface UseMediaStreamReturn {
  stream: MediaStream | null;
  sourceType: StreamSourceType;
  isVideoMuted: boolean;
  isAudioMuted: boolean;
  audioLevel: number;
  error: string | null;
  isIframe: boolean;
  isLoading: boolean;
  startCameraStream: () => Promise<boolean>;
  startScreenStream: () => Promise<boolean>;
  startVirtualStream: () => void;
  toggleVideo: () => void;
  toggleAudio: () => void;
  clearError: () => void;
  captureFrame: (videoElement: HTMLVideoElement | null) => string | null;
}

export function useMediaStream(): UseMediaStreamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sourceType, setSourceType] = useState<StreamSourceType>('virtual');
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Check if running inside iframe
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const currentStreamRef = useRef<MediaStream | null>(null);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Stop all active tracks on current stream and cleanup audio
  const stopTracks = useCallback(() => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      currentStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    oscillatorRef.current = null;
  }, []);

  // Helper to connect audio analyser for VU meter
  const attachAudioAnalyser = useCallback((audioTrackOrStream: MediaStreamTrack | MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      let sourceStream: MediaStream;
      if (audioTrackOrStream instanceof MediaStreamTrack) {
        sourceStream = new MediaStream([audioTrackOrStream]);
      } else {
        sourceStream = audioTrackOrStream;
      }

      const source = audioCtx.createMediaStreamSource(sourceStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio analyser setup notice:', e);
    }
  }, []);

  // Create virtual canvas stream
  const startVirtualStream = useCallback(() => {
    stopTracks();
    setError(null);

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    virtualCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    // Create gentle Web Audio synth tone for virtual stream
    let audioTrack: MediaStreamTrack | null = null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.03; // Gentle ambient sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);

        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 0.2;
        lfoGain.gain.value = 15;
        lfo.connect(osc.frequency);
        lfo.start();

        osc.connect(gainNode);
        const dest = audioCtx.createMediaStreamDestination();
        gainNode.connect(dest);
        osc.start();
        oscillatorRef.current = osc;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        gainNode.connect(analyser);
        analyserRef.current = analyser;

        audioTrack = dest.stream.getAudioTracks()[0] || null;
      }
    } catch (e) {
      console.warn('Virtual audio setup warning:', e);
    }

    let frameCount = 0;
    const render = () => {
      if (!ctx || !virtualCanvasRef.current) return;
      frameCount++;

      const w = canvas.width;
      const h = canvas.height;

      // Deep modern studio background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      const shift = (Math.sin(frameCount * 0.015) + 1) * 0.5;
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#1e1b4b');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Dynamic animated wave grid
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 + shift * 0.1})`;
      for (let y = 100; y < h; y += 80) {
        ctx.beginPath();
        for (let x = 0; x < w; x += 30) {
          const wave = Math.sin(x * 0.008 + frameCount * 0.04 + y) * 25;
          if (x === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }

      // Center Studio Card
      const cardW = 600;
      const cardH = 340;
      const cardX = (w - cardW) / 2;
      const cardY = (h - cardH) / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 24);
      ctx.fill();
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pulsing Live Indicator
      const pulse = (Math.sin(frameCount * 0.1) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.8 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(cardX + 50, cardY + 50, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('🔴 LIVE ON AIR', cardX + 75, cardY + 58);

      // Time display
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ja-JP', { hour12: false });
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px monospace';
      ctx.fillText(`JST: ${timeStr}`, cardX + cardW - 160, cardY + 58);

      // Virtual Avatar / Visualizer
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(w / 2, cardY + 160, 50 + shift * 8, 0, Math.PI * 2);
      ctx.fill();

      // Avatar Icon
      ctx.fillStyle = '#ffffff';
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎙️', w / 2, cardY + 175);
      ctx.textAlign = 'left';

      // Stream Title & Subtitle
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('バーチャルスタジオ配信中', w / 2, cardY + 250);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('カメラなしでも高品質な配信が可能です', w / 2, cardY + 285);
      ctx.textAlign = 'left';

      // Sound Wave Spectrum at bottom
      const barCount = 32;
      const barW = (cardW - 80) / barCount;
      for (let i = 0; i < barCount; i++) {
        const barH = 10 + Math.abs(Math.sin(frameCount * 0.1 + i * 0.4)) * 35;
        const barX = cardX + 40 + i * barW;
        const barY = cardY + cardH - 25;
        ctx.fillStyle = `hsl(${220 + i * 4}, 85%, 65%)`;
        ctx.fillRect(barX, barY - barH, barW - 3, barH);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    const canvasStream = canvas.captureStream(30);
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    currentStreamRef.current = canvasStream;
    setStream(canvasStream);
    setSourceType('virtual');
    setIsVideoMuted(false);
    setIsAudioMuted(false);
  }, [stopTracks]);

  // Progressive Camera + Microphone capture
  const startCameraStream = useCallback(async (): Promise<boolean> => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('お使いのブラウザはカメラアクセス（getUserMedia）をサポートしていません。');
      return false;
    }

    setIsLoading(true);
    setError(null);

    let media: MediaStream | null = null;
    let cameraErrorMsg: string | null = null;

    // Strategy 1: Attempt ideal video + audio
    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err: unknown) {
      console.warn('Initial camera + mic request failed, trying simple video+audio...', err);
      if (err instanceof Error) cameraErrorMsg = err.message;
    }

    // Strategy 2: Attempt standard video + audio without advanced constraints
    if (!media) {
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (err: unknown) {
        console.warn('Standard camera + mic failed, trying video only...', err);
        if (err instanceof Error) cameraErrorMsg = err.message;
      }
    }

    // Strategy 3: Attempt video only (in case mic is missing or blocked)
    if (!media) {
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        // Try getting mic separately if video succeeds
        try {
          const micMedia = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = micMedia.getAudioTracks()[0];
          if (audioTrack) {
            media.addTrack(audioTrack);
            micStreamRef.current = micMedia;
          }
        } catch (micErr) {
          console.warn('Separate mic acquisition failed (streaming video-only):', micErr);
        }
      } catch (err: unknown) {
        console.error('All camera attempts failed:', err);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            cameraErrorMsg =
              'カメラへのアクセスが拒否されました。ブラウザのアドレスバーにある鍵マークまたはカメラアイコンをクリックしてアクセスを許可してください。';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            cameraErrorMsg =
              '接続されたカメラが見つかりません。Webカメラが正しく接続されているかご確認ください。';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            cameraErrorMsg =
              'カメラが他のアプリケーション（ZoomやTeamsなど）で使用されている可能性があります。';
          } else {
            cameraErrorMsg = `カメラの起動に失敗しました: ${err.message}`;
          }
        }
      }
    }

    setIsLoading(false);

    if (!media) {
      setError(
        cameraErrorMsg ||
          'カメラの起動に失敗しました。ブラウザのカメラ権限設定をご確認いただくか、「新しいタブで開く」をお試しください。',
      );
      return false;
    }

    // Success: stop old stream and activate new camera stream
    stopTracks();
    currentStreamRef.current = media;

    // Attach audio analyzer for microphone volume meter
    const audioTrack = media.getAudioTracks()[0];
    if (audioTrack) {
      attachAudioAnalyser(audioTrack);
    }

    // Handle track ended (e.g. unplugged)
    const videoTrack = media.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        setError('カメラの接続が切断されました。バーチャル配信に復帰します。');
        startVirtualStream();
      };
    }

    setStream(media);
    setSourceType('camera');
    setIsVideoMuted(false);
    setIsAudioMuted(!audioTrack);
    return true;
  }, [stopTracks, attachAudioAnalyser, startVirtualStream]);

  // Robust Screen Sharing with progressive fallback & audio integration
  const startScreenStream = useCallback(async (): Promise<boolean> => {
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      setError(
        'お使いのブラウザまたは現在の表示環境（iframe）では画面共有APIがサポートされていません。右上「新しいタブで開く」からフル画面でお試しください。',
      );
      return false;
    }

    setIsLoading(true);
    setError(null);

    let media: MediaStream | null = null;
    let screenErrorMsg: string | null = null;

    // Strategy 1: Attempt video only (most compatible across all OS / browsers without rejecting on audio)
    try {
      media = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
    } catch (err: unknown) {
      console.warn('Initial display media attempt failed, trying base displayMedia:', err);
      if (err instanceof Error) screenErrorMsg = err.message;
    }

    // Strategy 2: Attempt standard getDisplayMedia({ video: true })
    if (!media) {
      try {
        media = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
      } catch (err: unknown) {
        console.error('All screen share attempts failed:', err);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            screenErrorMsg =
              '画面共有がキャンセルされたか、ブラウザの権限で制限されています。iframe環境では共有がブロックされることがあるため、上の「新しいタブで開く」もお試しください。';
          } else if (err.name === 'InvalidStateError') {
            screenErrorMsg =
              '画面共有ウィンドウの取得に失敗しました。「新しいタブで開く」から再度実行してください。';
          } else {
            screenErrorMsg = `画面共有エラー: ${err.message}`;
          }
        }
      }
    }

    setIsLoading(false);

    if (!media) {
      setError(screenErrorMsg || '画面共有を開始できませんでした。');
      return false;
    }

    // Try to attach user's microphone so they can talk while sharing screen!
    try {
      if (navigator.mediaDevices.getUserMedia) {
        const micMedia = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        const audioTrack = micMedia.getAudioTracks()[0];
        if (audioTrack) {
          media.addTrack(audioTrack);
          micStreamRef.current = micMedia;
          attachAudioAnalyser(audioTrack);
        }
      }
    } catch (micErr) {
      console.log('No microphone added to screen share (silent screen):', micErr);
    }

    // Success: stop old stream and activate screen share
    stopTracks();
    currentStreamRef.current = media;

    // When user clicks browser's native "Stop sharing" button
    const videoTrack = media.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        startVirtualStream();
      };
    }

    setStream(media);
    setSourceType('screen');
    setIsVideoMuted(false);
    setIsAudioMuted(media.getAudioTracks().length === 0);
    return true;
  }, [stopTracks, attachAudioAnalyser, startVirtualStream]);

  // Audio level monitoring loop for microphone VU meter
  useEffect(() => {
    let animId: number;
    const checkAudio = () => {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        const avg = sum / data.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 150)));
      } else {
        setAudioLevel(0);
      }
      animId = requestAnimationFrame(checkAudio);
    };
    animId = requestAnimationFrame(checkAudio);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracks();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stopTracks]);

  const toggleVideo = useCallback(() => {
    if (currentStreamRef.current) {
      const videoTracks = currentStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks.forEach((t) => {
          t.enabled = nextState;
        });
        setIsVideoMuted(!nextState);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (currentStreamRef.current) {
      const audioTracks = currentStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks.forEach((t) => {
          t.enabled = nextState;
        });
        setIsAudioMuted(!nextState);
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Frame grabber for periodic thumbnails and fallback video frame sync
  const captureFrame = useCallback(
    (videoElement: HTMLVideoElement | null): string | null => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        if (videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.6);
        } else if (virtualCanvasRef.current) {
          ctx.drawImage(virtualCanvasRef.current, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.6);
        }
      } catch (err) {
        console.warn('captureFrame notice:', err);
      }
      return null;
    },
    [],
  );

  return {
    stream,
    sourceType,
    isVideoMuted,
    isAudioMuted,
    audioLevel,
    error,
    isIframe,
    isLoading,
    startCameraStream,
    startScreenStream,
    startVirtualStream,
    toggleVideo,
    toggleAudio,
    clearError,
    captureFrame,
  };
}
