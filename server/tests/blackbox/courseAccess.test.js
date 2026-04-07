process.env.GEMINI_API_KEY = 'blackbox-test-gemini-key';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Here is the course explanation.'
        }
      })
    })
  }))
}));
jest.mock('../../models/User.js');
jest.mock('../../models/Course.js');

const User = require('../../models/User.js');
const Course = require('../../models/Course.js');
const aiRouter = require('../../routes/aiRoutes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
  return app;
};

const mockSelectQuery = (modelMethod, data) => {
  modelMethod.mockReturnValue({
    select: jest.fn().mockResolvedValue(data)
  });
};

describe('course access API (black-box)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET_KEY = 'blackbox-test-secret';
    app = buildApp();
  });

  test('POST /api/ai/doubt rejects user who is not enrolled in the course', async () => {
    const courseId = '507f1f77bcf86cd799439011';
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });

    mockSelectQuery(User.findById, {
      _id: 'user-1',
      name: 'Alice',
      enrolledCourses: ['507f1f77bcf86cd799439012']
    });
    mockSelectQuery(Course.findById, {
      _id: courseId,
      courseTitle: 'Node.js Basics',
      isPublished: true,
      courseContent: []
    });

    const res = await request(app)
      .post('/api/ai/doubt')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        prompt: 'Explain this lecture'
      });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      message: 'You are not enrolled in this course'
    });
  });

  test('POST /api/ai/doubt allows enrolled user to access a valid course', async () => {
    const courseId = '507f1f77bcf86cd799439011';
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });

    mockSelectQuery(User.findById, {
      _id: 'user-1',
      name: 'Alice',
      enrolledCourses: [courseId]
    });
    mockSelectQuery(Course.findById, {
      _id: courseId,
      courseTitle: 'Node.js Basics',
      courseDescription: 'Learn backend development with Node.js.',
      isPublished: true,
      courseContent: [
        { chapterTitle: 'Introduction' }
      ]
    });

    const res = await request(app)
      .post('/api/ai/doubt')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId,
        prompt: 'Explain this lecture'
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      reply: 'Here is the course explanation.'
    });
  });
});
