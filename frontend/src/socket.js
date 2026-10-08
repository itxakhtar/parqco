import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
    socket = io(url, { transports: ['websocket', 'polling'] });
  }
  return socket;
}
