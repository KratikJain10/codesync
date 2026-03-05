import request from 'supertest';
import { app } from '../index';

let token: string;
let roomSlug: string;

beforeAll(async () => {
    // Create a test user and get token
    const user = {
        username: `roomtest_${Date.now()}`,
        email: `roomtest_${Date.now()}@example.com`,
        password: 'RoomTest123!',
    };
    const res = await request(app).post('/api/auth/signup').send(user);
    token = res.body.token;
});

describe('Rooms API', () => {
    describe('POST /api/rooms', () => {
        it('should create a new room', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Test Room', language: 'javascript' })
                .expect(201);

            expect(res.body.room).toHaveProperty('slug');
            expect(res.body.room.name).toBe('Test Room');
            roomSlug = res.body.room.slug;
        });

        it('should reject without auth', async () => {
            await request(app)
                .post('/api/rooms')
                .send({ name: 'Fail Room', language: 'python' })
                .expect(401);
        });
    });

    describe('GET /api/rooms/:slug', () => {
        it('should return room details', async () => {
            const res = await request(app)
                .get(`/api/rooms/${roomSlug}`)
                .expect(200);

            expect(res.body.room.name).toBe('Test Room');
            expect(res.body.room).toHaveProperty('hasPassword');
            expect(res.body.room.hasPassword).toBe(false);
        });
    });

    describe('POST /api/rooms/:slug/join', () => {
        it('should join the room', async () => {
            const res = await request(app)
                .post(`/api/rooms/${roomSlug}/join`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('message');
        });
    });

    describe('POST /api/rooms/:slug/files', () => {
        it('should create a file', async () => {
            const res = await request(app)
                .post(`/api/rooms/${roomSlug}/files`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'index.js' })
                .expect(201);

            expect(res.body.file).toHaveProperty('id');
            expect(res.body.file.name).toBe('index.js');
        });
    });

    describe('PATCH /api/rooms/:slug', () => {
        it('should update room name', async () => {
            const res = await request(app)
                .patch(`/api/rooms/${roomSlug}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated Room' })
                .expect(200);

            expect(res.body.room.name).toBe('Updated Room');
        });

        it('should toggle visibility', async () => {
            const res = await request(app)
                .patch(`/api/rooms/${roomSlug}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ isPublic: false })
                .expect(200);

            expect(res.body.room.isPublic).toBe(false);
        });
    });

    describe('GET /api/rooms/:slug/messages', () => {
        it('should return empty messages array', async () => {
            const res = await request(app)
                .get(`/api/rooms/${roomSlug}/messages`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('messages');
            expect(Array.isArray(res.body.messages)).toBe(true);
        });
    });

    describe('GET /api/rooms', () => {
        it('should list rooms for authenticated user', async () => {
            const res = await request(app)
                .get('/api/rooms')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('rooms');
            expect(res.body.rooms.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('DELETE /api/rooms/:slug', () => {
        it('should delete the room', async () => {
            await request(app)
                .delete(`/api/rooms/${roomSlug}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
        });

        it('should return 404 for deleted room', async () => {
            await request(app)
                .get(`/api/rooms/${roomSlug}`)
                .expect(404);
        });
    });
});
