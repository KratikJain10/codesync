import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { URL } from 'url';
import { redis } from '../lib/redis';
import { yjsLog } from '../lib/logger';

// Store Yjs documents by room+file
const docs = new Map<string, Y.Doc>();
const conns = new Map<string, Set<WebSocket>>();

function getDocName(roomSlug: string, fileId: string): string {
    return `${roomSlug}:${fileId}`;
}

const YJS_KEY_PREFIX = 'yjs:doc:';
const YJS_TTL = 86400; // 24 hours

async function persistDoc(docName: string, doc: Y.Doc): Promise<void> {
    if (!redis) return;
    try {
        const state = Y.encodeStateAsUpdate(doc);
        await redis.setex(`${YJS_KEY_PREFIX}${docName}`, YJS_TTL, Buffer.from(state).toString('base64'));
    } catch (e) {
        yjsLog.error('Persist failed', { docName, error: (e as Error).message });
    }
}

async function loadDoc(docName: string, doc: Y.Doc): Promise<void> {
    if (!redis) return;
    try {
        const saved = await redis.get(`${YJS_KEY_PREFIX}${docName}`);
        if (saved) {
            const state = Buffer.from(saved, 'base64');
            Y.applyUpdate(doc, new Uint8Array(state));
            yjsLog.info('Loaded persisted state', { docName });
        }
    } catch (e) {
        yjsLog.error('Load failed', { docName, error: (e as Error).message });
    }
}

function getYDoc(docName: string): Y.Doc {
    let doc = docs.get(docName);
    if (!doc) {
        doc = new Y.Doc();
        docs.set(docName, doc);
        // Load from Redis on first access
        loadDoc(docName, doc);
    }
    return doc;
}

function broadcastUpdate(docName: string, update: Uint8Array, origin: WebSocket): void {
    const docConns = conns.get(docName);
    if (!docConns) return;

    docConns.forEach((conn) => {
        if (conn !== origin && conn.readyState === WebSocket.OPEN) {
            try {
                conn.send(
                    Buffer.from(
                        new Uint8Array([0, ...update]) // 0 = sync update message
                    )
                );
            } catch (e) {
                console.error('Broadcast error:', e);
            }
        }
    });
}

function broadcastAwareness(docName: string, data: Uint8Array, origin: WebSocket): void {
    const docConns = conns.get(docName);
    if (!docConns) return;

    docConns.forEach((conn) => {
        if (conn !== origin && conn.readyState === WebSocket.OPEN) {
            try {
                conn.send(data);
            } catch (e) {
                console.error('Awareness broadcast error:', e);
            }
        }
    });
}

export function setupYjsServer(server: http.Server): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);

        if (url.pathname.startsWith('/yjs/')) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });

    wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const pathParts = url.pathname.replace('/yjs/', '').split('/');
        const roomSlug = pathParts[0] || 'default';
        const fileId = pathParts[1] || 'main';
        const docName = getDocName(roomSlug, fileId);

        const doc = getYDoc(docName);

        // Add connection to room
        if (!conns.has(docName)) {
            conns.set(docName, new Set());
        }
        conns.get(docName)!.add(ws);

        // Send current document state to new connection
        const stateVector = Y.encodeStateAsUpdate(doc);
        if (stateVector.length > 0) {
            ws.send(Buffer.from(new Uint8Array([0, ...stateVector])));
        }

        ws.on('message', (message: Buffer) => {
            try {
                const data = new Uint8Array(message);
                const messageType = data[0];

                if (messageType === 0) {
                    // Sync update
                    const update = data.slice(1);
                    Y.applyUpdate(doc, update);
                    broadcastUpdate(docName, update, ws);
                    // Persist to Redis on every update
                    persistDoc(docName, doc);
                } else if (messageType === 1) {
                    // Awareness update
                    broadcastAwareness(docName, data, ws);
                }
            } catch (e) {
                console.error('Message processing error:', e);
            }
        });

        ws.on('close', () => {
            const docConns = conns.get(docName);
            if (docConns) {
                docConns.delete(ws);
                if (docConns.size === 0) {
                    // Keep doc in memory for a while for reconnections
                    setTimeout(() => {
                        const currentConns = conns.get(docName);
                        if (!currentConns || currentConns.size === 0) {
                            docs.delete(docName);
                            conns.delete(docName);
                        }
                    }, 60000); // Clean up after 1 minute of no connections
                }
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('✅ Yjs WebSocket server initialized');
}
