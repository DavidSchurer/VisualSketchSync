import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://visual-sketch-sync.vercel.app/';

export const socket = io('https://visualsketchsync-server.onrender.com', {
    autoConnect: false,
    withCredentials: true
});