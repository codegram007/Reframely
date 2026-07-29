import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  PageSyncHub,
  SyncError,
  parseClientMessage,
  type SyncServerMessage,
} from '../services/sync/index.js';

/**
 * B15 WebSocket realtime sync.
 *
 *   WS GET /projects/:projectId/pages/:pageId/sync
 *
 * Expects `@fastify/websocket` to already be registered on the parent app
 * (see `buildApp`). Wrapped with fastify-plugin so the WS route is registered
 * on that same context (otherwise `@fastify/websocket`'s onRoute hook never
 * sees the route). Ownership is enforced by the B14 auth plugin via
 * `projectId` before the upgrade handler runs.
 */
export function syncRoutes(hub: PageSyncHub): FastifyPluginAsync {
  const plugin: FastifyPluginAsync = async (app) => {
    app.get<{
      Params: { projectId: string; pageId: string };
      Querystring: { clientId?: string };
    }>(
      '/projects/:projectId/pages/:pageId/sync',
      { websocket: true },
      (socket, request) => {
        const { projectId, pageId } = request.params;
        const preferred =
          typeof request.query?.clientId === 'string' ? request.query.clientId : undefined;

        const send = (message: SyncServerMessage) => {
          // Server-side sockets from `ws` are OPEN when the handler runs, but
          // injectWS duplexes can still be CONNECTING — queue via try/send.
          try {
            if (socket.readyState === socket.CONNECTING) {
              socket.once('open', () => {
                try {
                  socket.send(JSON.stringify(message));
                } catch {
                  /* closed mid-flight */
                }
              });
              return;
            }
            if (socket.readyState !== socket.OPEN) return;
            socket.send(JSON.stringify(message));
          } catch {
            /* socket may race-close during send */
          }
        };

        const { clientId } = hub.subscribe(projectId, pageId, { send }, preferred);

        const onMessage = (raw: unknown) => {
          try {
            const message = parseClientMessage(raw);
            hub.handleMessage(projectId, pageId, clientId, message);
          } catch (error) {
            if (error instanceof SyncError) {
              send({ type: 'error', code: error.code, message: error.message });
              return;
            }
            send({
              type: 'error',
              code: 'INVALID_MESSAGE',
              message: 'Unexpected error handling message.',
            });
          }
        };

        socket.on('message', onMessage);
        socket.on('close', () => {
          hub.unsubscribe(projectId, pageId, clientId);
        });
        socket.on('error', () => {
          hub.unsubscribe(projectId, pageId, clientId);
        });
      },
    );
  };

  return fp(plugin, {
    name: 'vibestudio-sync',
    dependencies: ['@fastify/websocket'],
  });
}
