import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initializeSocket, getSocket } from '../api/socket';
import { useToast } from '../components/ui/Toast';
import { SOCKET_EVENTS } from '@exam-view/shared';

/**
 * Custom hook to manage socket connection and global real-time events.
 * Placed high up in the component tree (e.g., DashboardLayout).
 */
export const useSocketManager = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Initialize socket
    const socket = initializeSocket(token);
    socketRef.current = socket;

    // --- Global Event Listeners ---

    // Generic notification alert
    socket.on('notification', (payload) => {
      addToast(payload.message, payload.type || 'info');
    });

    // Query Invalidation (Instructs React Query to refetch data)
    socket.on('invalidate_query', (payload) => {
      if (payload.queryKey) {
        queryClient.invalidateQueries({ queryKey: payload.queryKey });
      }
    });

    // Handle generic errors from server socket
    socket.on('error', (err) => {
      console.error('[Socket Server Error]', err);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient, addToast]);

  return { socket: socketRef.current };
};

