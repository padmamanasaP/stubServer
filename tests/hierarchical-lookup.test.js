import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/server.js';

describe('Hierarchical Response Lookup (STUB-CR-002)', () => {
  
  describe('TC01: GET /api/user?user_id=123 - Should return user-specific response', () => {
    test('should return responses/user/user_123.json', async () => {
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      assert.strictEqual(response.body.user.id, '123');
      assert.strictEqual(response.body.user.name, 'Alice');
      assert.strictEqual(response.body.status, 'success');
    });
  });

  describe('TC02: GET /api/user?user_id=777 - Should return category default', () => {
    test('should return responses/user/default.json', async () => {
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '777' })
        .expect(200);

      assert.strictEqual(response.body.status, 'success');
      assert.ok(response.body.message.includes('Default user response'));
    });
  });

  describe('TC03: POST /api/order with order_id - Should return order-specific response', () => {
    test('should return responses/order/order_999.json', async () => {
      const response = await request(app)
        .post('/api/order')
        .send({ order_id: '999' })
        .expect(200);

      assert.strictEqual(response.body.order.id, '999');
      assert.strictEqual(response.body.status, 'success');
      assert.ok(response.body.order.items);
    });
  });

  describe('TC04: DELETE /api/payment with payment_id - Should return payment-specific response', () => {
    test('should return responses/payment/payment_555.json', async () => {
      const response = await request(app)
        .delete('/api/payment')
        .send({ payment_id: '555' })
        .expect(200);

      assert.strictEqual(response.body.payment.id, '555');
      assert.strictEqual(response.body.status, 'success');
      assert.strictEqual(response.body.payment.status, 'completed');
    });
  });

  describe('TC05: GET /api/unknown - Should return global default', () => {
    test('should return responses/default.json', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(200);

      assert.strictEqual(response.body.status, 'success');
      assert.ok(response.body.message.includes('Default response'));
    });
  });

  describe('Acceptance Criteria Tests', () => {
    test('AC1: Server correctly identifies top-level path segment', async () => {
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      // Should successfully retrieve from user category
      assert.strictEqual(response.body.user.id, '123');
    });

    test('AC2: Lookup combines category and field value', async () => {
      // Test with user category
      const userResponse = await request(app)
        .get('/api/user')
        .query({ user_id: '456' })
        .expect(200);

      assert.strictEqual(userResponse.body.user.id, '456');

      // Test with order category
      const orderResponse = await request(app)
        .post('/api/order')
        .send({ order_id: '999' })
        .expect(200);

      assert.strictEqual(orderResponse.body.order.id, '999');
    });

    test('AC3: Category folder exists but specific file missing - uses category default', async () => {
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '999' }) // Non-existent user
        .expect(200);

      // Should fall back to user/default.json
      assert.ok(response.body.message.includes('Default user response'));
    });

    test('AC4: Category folder does not exist - uses global default', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .query({ id: '123' })
        .expect(200);

      // Should fall back to responses/default.json
      assert.strictEqual(response.body.status, 'success');
      assert.ok(response.body.message && response.body.message.includes('Default response'));
    });
  });

  describe('Path Extraction Tests', () => {
    test('should extract category from /api/user path', async () => {
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      // Verify it's using hierarchical lookup (user-specific response)
      assert.strictEqual(response.body.user.id, '123');
    });

    test('should extract category from /api/order path', async () => {
      const response = await request(app)
        .post('/api/order')
        .send({ order_id: '999' })
        .expect(200);

      assert.strictEqual(response.body.order.id, '999');
    });

    test('should handle path without /api prefix', async () => {
      const response = await request(app)
        .get('/user')
        .query({ user_id: '123' })
        .expect(200);

      // Should still work with hierarchical lookup
      assert.strictEqual(response.body.user.id, '123');
    });
  });
});

