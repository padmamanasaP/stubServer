import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/server.js';

describe('Response Templating and Delay Simulation', () => {
  
  describe('Response Templating Tests', () => {
    test('TC01: Should replace placeholders with request data', async () => {
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN12345',
          transactionType: 'CREDIT',
          amount: '100.00'
        })
        .expect(200);

      assert.strictEqual(response.body.transactionId, 'TXN12345');
      assert.strictEqual(response.body.status, 'SUCCESS');
      assert.strictEqual(response.body.message, 'Transaction CREDIT processed successfully');
      assert.strictEqual(response.body.amount, '100.00');
    });

    test('TC02: Should replace placeholders with different transaction type', async () => {
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN67890',
          transactionType: 'DEBIT',
          amount: '50.00'
        })
        .expect(200);

      assert.strictEqual(response.body.transactionId, 'TXN67890');
      assert.strictEqual(response.body.message, 'Transaction DEBIT processed successfully');
      assert.strictEqual(response.body.amount, '50.00');
    });

    test('TC03: Should handle missing placeholders gracefully', async () => {
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN99999'
        })
        .expect(200);

      assert.strictEqual(response.body.transactionId, 'TXN99999');
      assert.ok(response.body.message.includes('{{request.transactionType}}'));
      assert.ok(response.body.amount.includes('{{request.amount}}'));
    });

    test('TC04: Should work with query parameters', async () => {
      const response = await request(app)
        .get('/api/transaction')
        .query({ 
          transactionId: 'TXN11111',
          transactionType: 'TRANSFER',
          amount: '200.00'
        })
        .expect(200);

      assert.strictEqual(response.body.transactionId, 'TXN11111');
    });

    test('TC05: Should handle default response with templating', async () => {
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN_UNKNOWN',
          transaction_id: 'TXN_UNKNOWN',
          transactionType: 'REFUND',
          amount: '25.00'
        })
        .expect(200);

      assert.strictEqual(response.body.transactionId, 'TXN_UNKNOWN');
      assert.strictEqual(response.body.message, 'Transaction REFUND processed successfully');
      assert.strictEqual(response.body.amount, '25.00');
    });

    test('TC06: Should handle nested request data', async () => {
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN12345',
          transactionType: 'CREDIT',
          amount: '100.00',
          user: {
            name: 'John Doe',
            id: '123'
          }
        })
        .expect(200);

      assert.strictEqual(response.body.transactionId, 'TXN12345');
    });
  });

  describe('Delay Simulation Tests', () => {
    test('TC07: Should apply delay from config.json', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN12345',
          transactionType: 'CREDIT',
          amount: '100.00'
        })
        .expect(200);

      const duration = Date.now() - startTime;
      
      assert.strictEqual(response.body.transactionId, 'TXN12345');
      assert.ok(duration >= 1400, `Expected delay >= 1400ms, got ${duration}ms`);
    });

    test('TC08: Should return immediately when no config.json exists', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      const duration = Date.now() - startTime;
      
      assert.strictEqual(response.body.user.id, '123');
      assert.ok(duration < 500, `Expected no delay, got ${duration}ms`);
    });

    test('TC09: Query parameter delay should override config.json delay', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN12345',
          transactionType: 'CREDIT',
          amount: '100.00'
        })
        .query({ _delay: 500 })
        .expect(200);

      const duration = Date.now() - startTime;
      
      assert.strictEqual(response.body.transactionId, 'TXN12345');
      assert.ok(duration >= 450 && duration < 1000, `Expected ~500ms delay, got ${duration}ms`);
    });

    test('TC10: Should handle zero delay in config.json', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      const duration = Date.now() - startTime;
      
      assert.ok(duration < 500, `Expected no delay, got ${duration}ms`);
    });
  });

  describe('Combined Templating and Delay Tests', () => {
    test('TC11: Should apply both templating and delay', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/transaction')
        .send({ 
          transactionId: 'TXN_COMBINED',
          transactionType: 'PAYMENT',
          amount: '75.50'
        })
        .expect(200);

      const duration = Date.now() - startTime;
      
      assert.strictEqual(response.body.transactionId, 'TXN_COMBINED');
      assert.strictEqual(response.body.message, 'Transaction PAYMENT processed successfully');
      assert.ok(duration >= 1400, `Expected delay >= 1400ms, got ${duration}ms`);
    });
  });

  describe('Backward Compatibility Tests', () => {
    test('TC12: Should not break existing responses without templates', async () => {
      const response = await request(app)
        .get('/api/user')
        .query({ user_id: '123' })
        .expect(200);

      assert.strictEqual(response.body.user.id, '123');
      assert.strictEqual(response.body.user.name, 'Alice');
      assert.strictEqual(response.body.status, 'success');
    });

    test('TC13: Should not break existing responses without config.json', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/order')
        .send({ order_id: '999' })
        .expect(200);

      const duration = Date.now() - startTime;
      
      assert.strictEqual(response.body.order.id, '999');
      assert.ok(duration < 500, `Expected no delay, got ${duration}ms`);
    });
  });
});
