
import { FastifyInstance } from 'fastify';
import { webSocketService } from './websocket.service.js';

export default async function websocketRouter(app: FastifyInstance) {
    app.get('/ws', { websocket: true }, (connection, req) => {
        webSocketService.handleConnection(connection, req);
    });
}
