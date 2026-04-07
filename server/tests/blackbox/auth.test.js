const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../../models/User.js');

const User = require('../../models/User.js');
const loginRouter = require('../../routes/loginRoutes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', loginRouter);
  return app;
};

const mockFindOneSelect = (user) => {
  const select = jest.fn().mockResolvedValue(user);
  User.findOne.mockReturnValue({ select });
  return select;
};

describe('auth API (black-box)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET_KEY = 'blackbox-test-secret';
    app = buildApp();
  });

  test('POST /api/signup rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ name: '', email: '', password: '' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'All fields are required'
    });
  });

  test('POST /api/signup rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({
        name: 'Alice',
        email: 'not-an-email',
        password: 'secret123'
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Invalid email format'
    });
  });

  test('POST /api/signup rejects duplicate email', async () => {
    User.findOne.mockResolvedValue({
      _id: 'existing-user',
      email: 'alice@example.com'
    });

    const res = await request(app)
      .post('/api/signup')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123'
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Email is already registered'
    });
    expect(User.create).not.toHaveBeenCalled();
  });

  test('POST /api/signup creates a user and returns a usable token', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (user) => ({
      _id: 'user-1',
      ...user
    }));

    const res = await request(app)
      .post('/api/signup')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
        imageUrl: 'https://example.com/alice.png'
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: 'User registered successfully',
      user: {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        imageUrl: 'https://example.com/alice.png'
      }
    });
    expect(res.body.token).toEqual(expect.any(String));
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET_KEY)).toEqual(
      expect.objectContaining({ id: 'user-1' })
    );
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alice',
        email: 'alice@example.com',
        imageUrl: 'https://example.com/alice.png',
        password: expect.any(String)
      })
    );
    expect(await bcrypt.compare('secret123', User.create.mock.calls[0][0].password)).toBe(true);
  });

  test('POST /api/login rejects invalid credentials', async () => {
    const hashedPassword = await bcrypt.hash('secret123', 10);
    mockFindOneSelect({
      _id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      password: hashedPassword
    });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'alice@example.com', password: 'wrongpass' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Incorrect password'
    });
  });

  test('POST /api/login returns a token for valid credentials', async () => {
    const hashedPassword = await bcrypt.hash('secret123', 10);
    mockFindOneSelect({
      _id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      password: hashedPassword
    });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'alice@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Login successful',
      user: {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com'
      }
    });
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET_KEY)).toEqual(
      expect.objectContaining({ id: 'user-1' })
    );
  });

  test('GET /api/user-info rejects requests without a bearer token', async () => {
    const res = await request(app).get('/api/user-info');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'Authorization token is missing'
    });
  });

  test('GET /api/user-info rejects malformed bearer tokens', async () => {
    const res = await request(app)
      .get('/api/user-info')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'Invalid token'
    });
  });

  test('GET /api/user-info returns the authenticated user profile', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
    User.findById.mockResolvedValue({
      _id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'student',
      imageUrl: 'https://example.com/alice.png'
    });

    const res = await request(app)
      .get('/api/user-info')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      user: {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'student',
        imageUrl: 'https://example.com/alice.png'
      }
    });
    expect(User.findById).toHaveBeenCalledWith('user-1');
  });
});
