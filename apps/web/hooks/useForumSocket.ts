'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from '@/lib/api';

// Websockets cannot go through the Next.js rewrite proxy, so this must be an
// absolute origin reachable from the browser. Behind a proxied host (e.g. a
// Codespace) set NEXT_PUBLIC_SOCKET_URL to the forwarded API URL.
const SOCKET_URL = (
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001'
).replace(/\/api\/?$/, '');

export function useForumSocket(topicId: string, onNewPost: (post: unknown) => void) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onNewPostRef = useRef(onNewPost);

  useEffect(() => {
    onNewPostRef.current = onNewPost;
  }, [onNewPost]);

  useEffect(() => {
    let active = true;

    async function connect() {
      try {
        const { data } = await api.get<{ token: string }>('/auth/socket-token');
        if (!active) return;

        const socket = io(`${SOCKET_URL}/forum`, {
          auth: { token: data.token },
          transports: ['websocket'],
          withCredentials: true
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          setConnected(true);
          setError(null);
          socket.emit('join-topic', topicId);
        });

        socket.on('disconnect', () => {
          setConnected(false);
        });

        socket.on('connect_error', (err) => {
          setError(err.message);
          setConnected(false);
        });

        socket.on('post', (post) => {
          onNewPostRef.current(post);
        });

        socket.on('post-error', (err: { message?: string }) => {
          setError(err.message ?? 'Failed to send post');
        });
      } catch (err) {
        setError((err as Error).message);
      }
    }

    connect();

    return () => {
      active = false;
      if (socketRef.current) {
        socketRef.current.emit('leave-topic', topicId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [topicId]);

  const sendPost = useCallback((content: string) => {
    const socket = socketRef.current;
    if (!socket || !connected) {
      setError('Socket not connected');
      return false;
    }
    socket.emit('new-post', { topicId, content });
    return true;
  }, [topicId, connected]);

  return { connected, error, sendPost };
}
