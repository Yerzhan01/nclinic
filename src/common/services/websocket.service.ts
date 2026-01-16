import type { WebSocket } from '@fastify/websocket';
import type { FastifyRequest } from 'fastify';
import { logger } from '@/common/utils/logger.js';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';

interface WebSocketMessage {
    type: string;
    payload: unknown;
}

export class WebSocketService {
    private clients: Map<string, WebSocket[]> = new Map();

    /**
     * Handle new WebSocket connection
     */
    handleConnection(connection: WebSocket, req: FastifyRequest) {
        // Authenticate via query param 'token'
        const token = (req.query as { token?: string }).token;

        if (!token) {
            connection.close(1008, 'Token required');
            return;
        }

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string; role: string };
            const userId = decoded.id;

            // Store connection
            const userSockets = this.clients.get(userId) || [];
            userSockets.push(connection);
            this.clients.set(userId, userSockets);

            logger.info({ userId }, 'WebSocket connected');

            // Handle messages (optional, mostly for pings)
            connection.on('message', (message: any) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'PING') {
                        connection.send(JSON.stringify({ type: 'PONG' }));
                    }
                } catch (e) {
                    // Ignore malformed
                }
            });

            // Handle disconnect
            connection.on('close', () => {
                const currentSockets = this.clients.get(userId) || [];
                const updatedSockets = currentSockets.filter((s) => s !== connection);

                if (updatedSockets.length === 0) {
                    this.clients.delete(userId);
                } else {
                    this.clients.set(userId, updatedSockets);
                }
                logger.info({ userId }, 'WebSocket disconnected');
            });

        } catch (error) {
            logger.warn({ error }, 'WebSocket authentication failed');
            connection.close(1008, 'Invalid Token');
        }
    }

    /**
     * Send message to specific user
     */
    sendToUser(userId: string, type: string, payload: unknown) {
        const sockets = this.clients.get(userId);
        if (!sockets) return;

        const message = JSON.stringify({ type, payload });

        sockets.forEach((socket) => {
            if (socket.readyState === 1) { // OPEN
                socket.send(message);
            }
        });
    }

    /**
     * Broadcast to all connected users
     */
    broadcast(type: string, payload: unknown) {
        const message = JSON.stringify({ type, payload });

        this.clients.forEach((sockets) => {
            sockets.forEach((socket) => {
                if (socket.readyState === 1) {
                    socket.send(message);
                }
            });
        });
    }
}

export const webSocketService = new WebSocketService();
