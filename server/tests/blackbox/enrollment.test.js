const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../models/User.js');
jest.mock('../../models/Course.js');
jest.mock('../../models/Purchase.js');

const User = require('../../models/User.js');
const Course = require('../../models/Course.js');
const Purchase = require('../../models/Purchase.js');
const userRouter = require('../../routes/userRoutes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/user', userRouter);
  return app;
};

describe('enrollment API (black-box)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET_KEY = 'blackbox-test-secret';
    app = buildApp();
  });

  test('POST /api/user/verify-payment enrolls user when payment succeeds', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
    const userData = {
      _id: 'user-1',
      enrolledCourses: [],
      save: jest.fn().mockResolvedValue()
    };
    const courseData = {
      _id: 'course-1',
      enrolledStudents: [],
      save: jest.fn().mockResolvedValue()
    };

    Purchase.findById.mockResolvedValue({
      _id: 'purchase-1',
      userId: 'user-1',
      courseId: 'course-1'
    });
    
    Purchase.findByIdAndUpdate.mockResolvedValue({
      _id: 'purchase-1',
      userId: 'user-1',
      courseId: 'course-1',
      status: 'completed'
    });
    User.findById.mockResolvedValue(userData);
    Course.findById.mockResolvedValue(courseData);

    const res = await request(app)
      .post('/api/user/verify-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ success: 'true', purchaseId: 'purchase-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Payment verified and order placed successfully'
    });
    expect(Purchase.findByIdAndUpdate).toHaveBeenCalledWith('purchase-1', { status: 'completed' });
    expect(userData.enrolledCourses).toEqual(['course-1']);
    expect(courseData.enrolledStudents).toEqual(['user-1']);
    expect(userData.save).toHaveBeenCalledTimes(1);
    expect(courseData.save).toHaveBeenCalledTimes(1);
  });
});
