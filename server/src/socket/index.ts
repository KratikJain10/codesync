import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

interface UserPresence {
    userId: string;
    username: string;
    avatar?: string;
    color: string;
    roomSlug: string;
    activeFile?: string;
    cursorPosition?: { lineNumber: number; column: number };
    selection?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    };
}

const CURSOR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
    '#F1948A', '#AED6F1', '#A3E4D7', '#FAD7A0',
];

const roomUsers = new Map<string, Map<string, UserPresence>>();
let colorIndex = 0;

function getNextColor(): string {
    const color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length];
    colorIndex++;
    return color;
}

export function setupSocketHandlers(io: SocketIOServer): void {
    io.on('connection', (socket: Socket) => {
        let currentRoom: string | null = null;
        let currentUser: UserPresence | null = null;

        // Join room
        socket.on('join-room', (data: { roomSlug: string; userId: string; username: string; avatar?: string }) => {
            currentRoom = data.roomSlug;
            currentUser = {
                userId: data.userId,
                username: data.username,
                avatar: data.avatar,
                color: getNextColor(),
                roomSlug: data.roomSlug,
            };

            socket.join(data.roomSlug);

            // Add user to room users map
            if (!roomUsers.has(data.roomSlug)) {
                roomUsers.set(data.roomSlug, new Map());
            }
            roomUsers.get(data.roomSlug)!.set(socket.id, currentUser);

            // Send current users to the joining user
            const users = Array.from(roomUsers.get(data.roomSlug)!.values());
            socket.emit('room-users', users);

            // Notify others
            socket.to(data.roomSlug).emit('user-joined', currentUser);
        });

        // Cursor position update
        socket.on('cursor-update', (data: {
            lineNumber: number;
            column: number;
            activeFile?: string;
            selection?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
        }) => {
            if (currentRoom && currentUser) {
                currentUser.cursorPosition = { lineNumber: data.lineNumber, column: data.column };
                currentUser.activeFile = data.activeFile;
                currentUser.selection = data.selection;
                socket.to(currentRoom).emit('cursor-moved', {
                    socketId: socket.id,
                    userId: currentUser.userId,
                    username: currentUser.username,
                    color: currentUser.color,
                    activeFile: data.activeFile,
                    cursorPosition: { lineNumber: data.lineNumber, column: data.column },
                    selection: data.selection,
                });
            }
        });

        // Chat message
        socket.on('chat-message', (data: { content: string }) => {
            if (currentRoom && currentUser) {
                const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const timestamp = new Date().toISOString();

                io.to(currentRoom).emit('chat-message', {
                    id: msgId,
                    content: data.content,
                    userId: currentUser.userId,
                    username: currentUser.username,
                    avatar: currentUser.avatar,
                    color: currentUser.color,
                    timestamp,
                });

                // Persist to DB (fire-and-forget)
                prisma.room.findUnique({ where: { slug: currentRoom } }).then(room => {
                    if (room) {
                        prisma.message.create({
                            data: { content: data.content, userId: currentUser!.userId, roomId: room.id },
                        }).catch(err => console.error('Chat persist error:', err));
                    }
                });
            }
        });

        // Typing indicator
        socket.on('typing-start', () => {
            if (currentRoom && currentUser) {
                socket.to(currentRoom).emit('user-typing', {
                    userId: currentUser.userId,
                    username: currentUser.username,
                });
            }
        });

        socket.on('typing-stop', () => {
            if (currentRoom && currentUser) {
                socket.to(currentRoom).emit('user-stopped-typing', {
                    userId: currentUser.userId,
                });
            }
        });

        // File change notifications
        socket.on('file-created', (data: { file: any }) => {
            if (currentRoom) {
                socket.to(currentRoom).emit('file-created', data);
            }
        });

        socket.on('file-deleted', (data: { fileId: string }) => {
            if (currentRoom) {
                socket.to(currentRoom).emit('file-deleted', data);
            }
        });

        // Execution events
        socket.on('execution-started', (data: { language: string; filename: string }) => {
            if (currentRoom) {
                io.to(currentRoom).emit('execution-started', {
                    ...data,
                    username: currentUser?.username,
                });
            }
        });

        socket.on('execution-result', (data: any) => {
            if (currentRoom) {
                io.to(currentRoom).emit('execution-result', data);
            }
        });

        // Disconnect
        socket.on('disconnect', () => {
            if (currentRoom) {
                const users = roomUsers.get(currentRoom);
                if (users) {
                    users.delete(socket.id);
                    if (users.size === 0) {
                        roomUsers.delete(currentRoom);
                    }
                }

                socket.to(currentRoom).emit('user-left', {
                    socketId: socket.id,
                    userId: currentUser?.userId,
                    username: currentUser?.username,
                });
            }
        });
    });

    console.log('✅ Socket.io handlers initialized');
}
