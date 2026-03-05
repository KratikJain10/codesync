import request from 'supertest';
import { app } from '../index';

const TEST_USER = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
};

let token: string;

describe('Auth API', () => {
    describe('POST /api/auth/signup', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send(TEST_USER)
                .expect(201);

            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('id');
            expect(res.body.user.username).toBe(TEST_USER.username);
            token = res.body.token;
        });

        it('should reject duplicate username', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send(TEST_USER)
                .expect(400);

            expect(res.body).toHaveProperty('error');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: TEST_USER.email, password: TEST_USER.password })
                .expect(200);

            expect(res.body).toHaveProperty('token');
            expect(res.body.user.email).toBe(TEST_USER.email);
            token = res.body.token;
        });

        it('should reject wrong password', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ email: TEST_USER.email, password: 'wrongpassword' })
                .expect(401);
        });

        it('should reject nonexistent email', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'noone@example.com', password: 'whatever' })
                .expect(401);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return user profile with valid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.user.email).toBe(TEST_USER.email);
        });

        it('should reject without token', async () => {
            await request(app)
                .get('/api/auth/me')
                .expect(401);
        });
    });

    describe('POST /api/auth/change-password', () => {
        it('should change password with correct current password', async () => {
            await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ currentPassword: TEST_USER.password, newPassword: 'NewPassword456!' })
                .expect(200);
        });

        it('should reject with wrong current password', async () => {
            await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ currentPassword: 'wrongpassword', newPassword: 'Another789!' })
                .expect(400);
        });
    });

    describe('GET /api/auth/activity', () => {
        it('should return activity data', async () => {
            const res = await request(app)
                .get('/api/auth/activity')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('activity');
            expect(typeof res.body.activity).toBe('object');
        });
    });
});
