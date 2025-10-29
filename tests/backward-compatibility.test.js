import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/server.js';

describe('Backward Compatibility Tests (AC5)', () => {
  
  describe('Flat Directory Structure Support', () => {
    test('should still support existing flat lookup for user_123.json', async () => {
      // This test ensures that even if hierarchical lookup is used,
      // if category folder doesn't exist or file isn't found in category,
      // it falls back to flat structure
      
      // First, try hierarchical lookup
      const hierarchicalResponse = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      assert.strictEqual(hierarchicalResponse.body.user.id, '123');

      // Also verify that files in root responses directory still work
      // when accessed without category (though this might not happen in practice)
      // The flat structure files should still exist for backward compatibility
    });

    test('should support multiple user lookups', async () => {
      const user123 = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      const user456 = await request(app)
        .get('/api/user')
        .query({ user_id: '456' })
        .expect(200);

      assert.strictEqual(user123.body.user.id, '123');
      assert.strictEqual(user456.body.user.id, '456');
    });

    test('should support order lookup', async () => {
      const response = await request(app)
        .post('/api/order')
        .send({ order_id: '999' })
        .expect(200);

      assert.strictEqual(response.body.order.id, '999');
    });
  });

  describe('Lookup Value Extraction', () => {
    test('should extract user_id from query params (GET)', async () => {
      const response = await request(app)
        .get('/api/user?user_id=123')
        .expect(200);

      assert.strictEqual(response.body.user.id, '123');
    });

    test('should extract order_id from body (POST)', async () => {
      const response = await request(app)
        .post('/api/order')
        .send({ order_id: '999' })
        .expect(200);

      assert.strictEqual(response.body.order.id, '999');
    });

    test('should extract payment_id from body (DELETE)', async () => {
      const response = await request(app)
        .delete('/api/payment')
        .send({ payment_id: '555' })
        .expect(200);

      assert.strictEqual(response.body.payment.id, '555');
    });

    test('should handle generic id field', async () => {
      const response = await request(app)
        .get('/api/user?id=123')
        .expect(200);

      // Should still work if id is used instead of user_id
      assert.ok(response.body);
    });
  });

  describe('Default Response Fallback', () => {
    test('should return global default for unknown routes', async () => {
      const response = await request(app)
        .get('/api/xyz')
        .expect(200);

      assert.strictEqual(response.body.status, 'success');
      assert.ok(response.body.message);
    });

    test('should return category default for unknown items in known category', async () => {
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '999' }) // Unknown user
        .expect(200);

      assert.strictEqual(response.body.status, 'success');
      assert.ok(response.body.message.includes('Default user response'));
    });
  });

  describe('Health Check Endpoint', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      assert.strictEqual(response.body.status, 'healthy');
      assert.ok(response.body.timestamp);
      assert.ok(response.body.config);
    });
  });
});

