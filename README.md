# Stub Test Server

A dynamic stub test server for simulating backend API endpoints. It responds to GET, POST, and DELETE requests with mock JSON responses determined by request content, supporting hot reload and flexible configuration.

## Features

- ✅ **Multiple HTTP Methods**: Supports GET, POST, and DELETE requests
- ✅ **Dynamic Response Mapping**: Maps requests to response files based on field values or query parameters
- ✅ **Response Templating**: Dynamic placeholder replacement with request data
- ✅ **Delay Simulation**: Configurable response delays for realistic API testing
- ✅ **Hot Reload**: Automatically reflects file changes without server restart
- ✅ **Flexible Configuration**: Environment variable-based configuration
- ✅ **Comprehensive Logging**: JSON-structured logs with timestamps
- ✅ **Performance Optimized**: Response caching for sub-200ms response times
- ✅ **Docker Support**: Ready for containerization
- ✅ **Security**: Protected against directory traversal attacks
- ✅ **Health Checks**: Built-in health endpoint

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. (Optional) Copy environment configuration:
```bash
cp .env.example .env
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or your configured port).

## Configuration

Configuration is managed via environment variables or a `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `RESPONSE_DIR` | Directory containing response files | `./responses` |
| `DEFAULT_RESPONSE` | Default fallback response file | `default.json` |
| `LOOKUP_FIELD` | Primary field name for lookup | `id` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
| `NODE_ENV` | Environment (development, production) | `development` |

### Example `.env` file:

```env
PORT=3000
RESPONSE_DIR=./responses
DEFAULT_RESPONSE=default.json
LOOKUP_FIELD=id
LOG_LEVEL=info
NODE_ENV=development
```

## Usage

### Request Mapping Rules

The server determines which response file to return based on:

| Request Type | Lookup Source | Example |
|-------------|---------------|---------|
| GET | Query parameter | `/api/user?user_id=123` → `user_123.json` |
| POST | JSON body field | `{"order_id": "999"}` → `order_999.json` |
| DELETE | JSON body or query param | `{"resource_id": "A12"}` → `resource_A12.json` |

### Response File Naming

The server supports multiple naming patterns:
- `{value}.json` - Direct match
- `user_{value}.json` - User prefix
- `order_{value}.json` - Order prefix
- `resource_{value}.json` - Resource prefix

If no match is found, the server returns `default.json`.

### Examples

#### GET Request
```bash
# Using query parameter
curl "http://localhost:3000/api/user?user_id=123"

# Response from responses/user_123.json
{
  "status": "success",
  "user": {
    "id": "123",
    "name": "Alice",
    "email": "alice@example.com"
  }
}
```

#### POST Request
```bash
curl -X POST http://localhost:3000/api/order \
  -H "Content-Type: application/json" \
  -d '{"order_id": "999"}'

# Response from responses/order_999.json
```

#### DELETE Request
```bash
curl -X DELETE http://localhost:3000/api/resource \
  -H "Content-Type: application/json" \
  -d '{"resource_id": "A12"}'

# Response from responses/resource_A12.json
```

#### Default Response
```bash
curl "http://localhost:3000/api/user?user_id=999"

# No matching file, returns responses/default.json
```

## Response File Format

Each response file must be a valid JSON object. Example:

```json
{
  "status": "success",
  "user": {
    "id": "123",
    "name": "Alice",
    "email": "alice@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## Advanced Features

### Response Templating

The server supports dynamic response templating, allowing you to create reusable response templates with placeholders that are replaced with actual request data at runtime.

#### Template Syntax

Use `{{request.fieldName}}` placeholders in your response JSON files. The server will replace these with values from the incoming request (query parameters or body).

#### Example Template File

Create a response file with templates (e.g., `responses/transaction/transaction_TXN12345.json`):

```json
{
  "transactionId": "{{request.transactionId}}",
  "status": "SUCCESS",
  "message": "Transaction {{request.transactionType}} processed successfully",
  "amount": "{{request.amount}}",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Making a Request

```bash
curl -X POST http://localhost:3000/api/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TXN12345",
    "transactionType": "CREDIT",
    "amount": "100.00"
  }'
```

#### Response

```json
{
  "transactionId": "TXN12345",
  "status": "SUCCESS",
  "message": "Transaction CREDIT processed successfully",
  "amount": "100.00",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Nested Field Access

Templates support dot notation for nested fields:

```json
{
  "userId": "{{request.user.id}}",
  "userName": "{{request.user.name}}"
}
```

#### Missing Placeholders

If a placeholder references a field that doesn't exist in the request, it will be left unchanged in the response:

```json
{
  "message": "{{request.missingField}}"
}
```

### Response Delay Simulation

The server supports two methods for simulating API latency:

#### Method 1: Query Parameter (Per-Request)

Add `_delay` query parameter to simulate latency for a specific request:

```bash
curl "http://localhost:3000/api/user?user_id=123&_delay=500"
```

This will delay the response by 500ms (max 5000ms). Query parameter delays override config-based delays.

#### Method 2: Configuration File (Category-Wide)

Create a `config.json` file in any response category directory to apply a consistent delay to all responses in that category:

**File: `responses/transaction/config.json`**
```json
{
  "delay": 1500
}
```

This will apply a 1500ms delay to all transaction responses. The delay is applied automatically without requiring query parameters.

#### Delay Priority

1. Query parameter `_delay` (highest priority)
2. Category `config.json` delay
3. No delay (default)

#### Example: Category with Delay

```bash
# Directory structure
responses/
├── transaction/
│   ├── config.json          # {"delay": 1500}
│   ├── transaction_TXN123.json
│   └── default.json

# Request (will have 1500ms delay)
curl -X POST http://localhost:3000/api/transaction \
  -d '{"transactionId": "TXN123"}'

# Override with query parameter (will have 500ms delay instead)
curl -X POST "http://localhost:3000/api/transaction?_delay=500" \
  -d '{"transactionId": "TXN123"}'
```

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

Returns server status and configuration.

### Hot Reload

The server automatically watches the response directory for changes. When you:
- Add a new response file
- Modify an existing file
- Delete a file

The cache is invalidated and changes are reflected immediately without restart.

## Logging

The server logs all requests in JSON format:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "message": "Request processed",
  "method": "GET",
  "url": "/api/user?user_id=123",
  "statusCode": 200,
  "duration": "45ms"
}
```

Log levels: `debug`, `info`, `warn`, `error`

## Docker Support

### Build and Run

```bash
# Build image
docker build -t stub-server .

# Run container
docker run -p 3000:3000 -v $(pwd)/responses:/app/responses stub-server
```

### Docker Compose

```bash
docker-compose up -d
```

This will:
- Build the image
- Start the server on port 3000
- Mount the `responses` directory for hot reload
- Include health checks

## Project Structure

```
stubServer/
├── src/
│   ├── server.js          # Main server file
│   ├── config.js          # Configuration management
│   ├── logger.js          # Logging utility
│   └── responseManager.js # Response file manager with caching
├── responses/             # Mock response files
│   ├── default.json
│   ├── user_123.json
│   ├── user_456.json
│   ├── order_999.json
│   └── resource_A12.json
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## Performance

- Response time: < 200ms for file lookups
- Concurrent requests: Supports 50-100+ concurrent users
- Caching: In-memory cache for response files
- Hot reload: File watching with minimal overhead

## Security

- ✅ Directory traversal protection
- ✅ Input sanitization
- ✅ Error message sanitization in production
- ✅ Configurable CORS (add if needed)

## Extending the Server

### Adding New Endpoints

The server uses wildcard routes (`*`), so you can add any endpoint:

```bash
curl http://localhost:3000/api/v1/products?product_id=abc
```

### Custom Lookup Logic

Modify `src/responseManager.js` to add custom lookup patterns or hierarchical structures:

```javascript
// Example: Hierarchical lookup
// responses/products/electronics/abc123.json
```

### Response Transformation

Add middleware in `src/server.js` to transform responses before sending.

## Troubleshooting

### Response not found
- Check the lookup field value in your request
- Verify the response file exists in the `responses/` directory
- Check file naming matches the expected pattern

### Hot reload not working
- Verify file permissions on the response directory
- Check that files are saved completely
- Review logs for file watching errors

### Port already in use
```bash
# Change port in .env or use environment variable
PORT=3001 npm start
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
