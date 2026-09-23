import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebRTCSignal } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface UseWebRTCOptions {
  role: 'broadcaster' | 'viewer';
  peerId: string;
  localStream: MediaStream | null;
  onSendSignal: (signal: WebRTCSignal) => void;
}

export function useWebRTC({ role, peerId, localStream, onSendSignal }: UseWebRTCOptions) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const onSendSignalRef = useRef(onSendSignal);
  onSendSignalRef.current = onSendSignal;

  // Helper to safely add ICE candidate with queueing
  const addIceCandidateSafe = async (pc: RTCPeerConnection, candidate: RTCIceCandidateInit, peerKey: string) => {
    if (pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('addIceCandidate error:', e);
      }
    } else {
      const queue = pendingCandidatesRef.current.get(peerKey) || [];
      queue.push(candidate);
      pendingCandidatesRef.current.set(peerKey, queue);
    }
  };

  // Process queued candidates once remoteDescription is set
  const processPendingCandidates = async (pc: RTCPeerConnection, peerKey: string) => {
    const queue = pendingCandidatesRef.current.get(peerKey);
    if (!queue || queue.length === 0) return;
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('Failed to add queued candidate:', e);
      }
    }
    pendingCandidatesRef.current.delete(peerKey);
  };

  // Handle incoming signaling messages
  const handleSignal = useCallback(
    async (signal: WebRTCSignal, fromId: string) => {
      try {
        if (role === 'broadcaster') {
          // Broadcaster receives answer or ice candidate from viewer
          const pc = peerConnectionsRef.current.get(fromId);
          if (!pc) return;

          if (signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await processPendingCandidates(pc, fromId);
          } else if (signal.type === 'ice-candidate' && signal.candidate) {
            await addIceCandidateSafe(pc, signal.candidate, fromId);
          }
        } else {
          // Viewer receives offer or ice candidate from broadcaster
          let pc = viewerPeerConnectionRef.current;
          if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            if (pc) {
              try { pc.close(); } catch {}
            }
            pc = new RTCPeerConnection(RTC_CONFIG);
            viewerPeerConnectionRef.current = pc;

            pc.onconnectionstatechange = () => {
              const state = pc?.connectionState || 'closed';
              setConnectionState(state);
              if (state === 'failed' || state === 'disconnected') {
                console.warn('WebRTC connection state degraded to:', state);
                // When WebRTC connection is lost, clear remoteStream so fallback frame takes over instantly
                setRemoteStream(null);
              }
            };

            pc.ontrack = (event) => {
              let inboundStream: MediaStream;
              if (event.streams && event.streams[0]) {
                inboundStream = event.streams[0];
              } else {
                inboundStream = new MediaStream();
                inboundStream.addTrack(event.track);
              }
              setRemoteStream(inboundStream);

              event.track.onended = () => {
                setRemoteStream(null);
              };
              event.track.onmute = () => {
                // track muted
              };
              event.track.onunmute = () => {
                setRemoteStream(inboundStream);
              };
            };

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                onSendSignalRef.current({
                  type: 'ice-candidate',
                  candidate: event.candidate.toJSON(),
                  targetId: fromId,
                  senderId: peerId,
                });
              }
            };
          }

          if (signal.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await processPendingCandidates(pc, fromId);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            onSendSignalRef.current({
              type: 'answer',
              sdp: answer,
              targetId: fromId,
              senderId: peerId,
            });
          } else if (signal.type === 'ice-candidate' && signal.candidate) {
            await addIceCandidateSafe(pc, signal.candidate, fromId);
          }
        }
      } catch (err) {
        console.warn('WebRTC signal processing warning:', err);
      }
    },
    [role, peerId],
  );

  // When a new viewer joins the room, the broadcaster creates an offer for them
  const initiateOfferForViewer = useCallback(
    async (viewerId: string) => {
      if (role !== 'broadcaster' || !localStream) return;

      try {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnectionsRef.current.set(viewerId, pc);

        // Add local tracks to peer connection
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            onSendSignalRef.current({
              type: 'ice-candidate',
              candidate: event.candidate.toJSON(),
              targetId: viewerId,
              senderId: peerId,
            });
          }
        };

        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        onSendSignalRef.current({
          type: 'offer',
          sdp: offer,
          targetId: viewerId,
          senderId: peerId,
        });
      } catch (err) {
        console.error('Failed to create offer for viewer:', err);
      }
    },
    [role, localStream, peerId],
  );

  // Handle peer leaving
  const handlePeerLeft = useCallback((leftPeerId: string) => {
    const pc = peerConnectionsRef.current.get(leftPeerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(leftPeerId);
    }
  }, []);

  // Update tracks when localStream changes for broadcaster
  useEffect(() => {
    if (role === 'broadcaster' && localStream) {
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        localStream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            pc.addTrack(track, localStream);
          }
        });
      });
    }
  }, [role, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      if (viewerPeerConnectionRef.current) {
        viewerPeerConnectionRef.current.close();
      }
    };
  }, []);

  return {
    remoteStream,
    connectionState,
    handleSignal,
    initiateOfferForViewer,
    handlePeerLeft,
  };
}
