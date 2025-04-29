import { io } from 'socket.io-client';

// Use environment variable with fallback to localhost for development
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export const socket = io(BACKEND_URL, {
    autoConnect: false,
    withCredentials: true
});