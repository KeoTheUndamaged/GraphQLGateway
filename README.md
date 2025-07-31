# GraphQL Gateway

A production-ready Apollo Federation Gateway built with Express.js, TypeScript, and comprehensive security features. This service acts as a unified entry point for federated GraphQL microservices, providing query routing, security protection, and operational monitoring.

## Features

### Core Functionality
- **Apollo Federation Gateway**: Routes queries to multiple subgraph services
- **Express.js HTTP Server**: Robust HTTP transport with middleware support
- **TypeScript**: Full type safety and modern JavaScript features
- **Environment Configuration**: Comprehensive configuration management with validation

### Security
- **Apollo Armor**: Multi-layer GraphQL security protection
    - Query depth limiting
    - Query complexity/cost analysis
    - Alias and directive flooding protection
    - Field suggestion blocking
- **CORS Protection**: Configurable cross-origin resource sharing
- **Rate Limiting**: Request frequency limiting to prevent abuse
- **Security Headers**: Helmet.js for comprehensive HTTP security headers
- **Input Validation**: Zod-based environment variable validation

### Observability & Monitoring
- **OpenTelemetry Integration**: Full distributed tracing and metrics
- **Structured Logging**: Winston-based logging with configurable levels
- **Health Checks**: Production-ready health check endpoints
- **Performance Monitoring**: Request timing and GraphQL operation tracking


### Operational Excellence
- **Graceful Shutdown**: Zero-downtime deployment support
- **Environment-based Configuration**: Zod-validated environment variables
- **Error Handling**: Secure error responses with detailed server-side logging
- **Request Logging**: HTTP request/response logging with Morgan

## Prerequisites

- **Node.js**: v22.0.0 or higher
- **npm**: v11.0.0 or higher
- **TypeScript**: v5.5.0 or higher
- **Apollo Rover CLI**: For supergraph composition (install globally: `npm install -g @apollo/rover`)

## Installation

1. **Clone the repository**
```shell script
   git clone <repository-url>
   cd graphql-gateway
```


2. **Install dependencies**
```shell script
   npm install
```


3. **Environment setup**
```shell script
   cp .env.example .env
   # Edit .env with your configuration values
```


4. **Generate supergraph schema**
```shell script
   npm run compose
```


### Configuration
### Required Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `SERVICE_NAME` | Unique service identifier | `graphql-gateway` |
| `SERVICE_VERSION` | Service version for deployment tracking | `1.0.0` |
| `CORS_ALLOWED_DOMAIN` | Domain authorized for cross-origin requests | `example.com` |
### Optional Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Deployment environment |
| `PORT` | `4000` | HTTP server port |
| `LOG_LEVEL` | `warn` | Winston log level |
| `ALLOW_BATCHED_REQUESTS` | `false` | Enable GraphQL request batching |
| `ENABLE_INTROSPECTION` | `false` | Enable GraphQL schema introspection |
| `ENABLE_GRAPHQL_PLAYGROUND` | `false` | Enable GraphQL Playground interface |
### Security Configuration
All Apollo Armor security features are enabled by default. Configure via environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `ENABLE_BLOCK_FIELD_SUGGESTION` | `true` | Block GraphQL field suggestions |
| `ENABLE_COST_LIMIT` | `true` | Enable query cost analysis |
| `ENABLE_MAX_DEPTH` | `true` | Enable query depth limiting |
| `ENABLE_MAX_ALIASES` | `true` | Enable alias count limiting |
| `ENABLE_MAX_DIRECTIVES` | `true` | Enable directive count limiting |
| `ENABLE_MAX_TOKENS` | `true` | Enable token count limiting |
### Rate Limiting Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `RATE_LIMIT_WINDOW_MS` | `3600000` | Rate limit window (1 hour) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per IP |
### OpenTelemetry Observability Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `ENABLE_TRACES` | `true` | Enable distributed tracing |
| `ENABLE_METRICS` | `true` | Enable metrics collection |
| `OTEL_EXPORTER_TRACE_OTLP_ENDPOINT` | - | OTLP trace exporter endpoint |
| `OTEL_EXPORTER_METRIC_OTLP_ENDPOINT` | - | OTLP metrics exporter endpoint |
| `OTEL_EXPORTER_OTLP_TRACE_HEADERS` | - | Authentication headers for trace endpoint |
| `OTEL_EXPORTER_OTLP_METRIC_HEADERS` | - | Authentication headers for metrics endpoint |
| `OTEL_SAMPLING_RATE` | `0.1` | Trace sampling rate (10%) |
| `OTEL_METRIC_EXPORT_INTERVAL` | `60000` | Metrics export interval (60 seconds) |
| `OTEL_SERVICE_NAMESPACE` | `production` | Service namespace for resource identification |

## Usage

### Development

```shell script
   # Start development server with hot reload
   npm run dev

   # Build TypeScript
   npm run build

   # Generate supergraph schema
   npm run compose
```


### Production

```shell script
   # Build the application
   npm run build

   # Start production server
   npm start
```


### Testing

```shell script
   # Run test suite
   npm test

   # Run tests in watch mode
   npm run test:watch
```


## API Endpoints

### GraphQL Endpoint
- **URL**: `/graphql`
- **Methods**: `POST`
- **Content-Type**: `application/json`

**Example Query:**
```graphql
query {
  user(id: "123") {
    name
    email
    posts {
      title
      content
    }
  }
}
```


### Health Check Endpoint
- **URL**: `/healthcheck`
- **Method**: `GET`
- **Response**: JSON health status

**Example Response:**
```json
{
  "status": "OK",
  "message": "Service is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "service": {
    "name": "graphql-gateway",
    "version": "1.0.0"
  }
}
```


## Security Features

### Apollo Armor Protection
- **Query Depth Limiting**: Prevents deeply nested queries (max depth: 5)
- **Query Cost Analysis**: Analyzes and limits expensive operations (max cost: 5000)
- **Alias Limiting**: Prevents alias flooding attacks (max aliases: 15)
- **Directive Limiting**: Prevents directive flooding (max directives: 50)
- **Token Limiting**: Prevents large query attacks (max tokens: 1000)
- **Field Suggestion Blocking**: Prevents schema enumeration

### HTTP Security
- **CORS**: Configurable cross-origin access control
- **Rate Limiting**: 100 requests per 15 minutes per IP (configurable)
- **Security Headers**: Comprehensive HTTP security headers via Helmet
- **Input Validation**: Request validation and sanitization

### Information Disclosure Protection
- **Environment-Aware Error Responses**: Detailed errors in development, sanitized in production
- **Secure Logging**: Sensitive information filtering in logs
- **Schema Protection**: Introspection disabled by default in production

## Monitoring & Logging

### Log Levels
- **error**: Critical errors requiring immediate attention
- **warn**: Warning conditions (rate limits, security violations)
- **info**: General informational messages
- **http**: HTTP request/response logging
- **debug**: Detailed debugging information (development only)

### Health Check Integration

**Kubernetes Configuration:**
```yaml
readinessProbe:
  httpGet:
    path: /healthcheck
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 10

livenessProbe:
  httpGet:
    path: /healthcheck
    port: 4000
  initialDelaySeconds: 30
  periodSeconds: 30
```

**Load Balancer Configuration:**
- Health check URL: `/healthcheck`
- Expected status: `200`
- Check interval: `10-30 seconds`
- Timeout: `5 seconds`

## Development

### Project Structure
```
src/
├── configuration/          # Middleware and service configurations
│   ├── apolloArmorOptions.ts
│   ├── apolloFormatErrorOptions.ts
│   ├── corsOptions.ts
│   ├── helmetOptions.ts
│   ├── openTelemetryConfiguration.ts
│   └── rateLimitOptions.ts
├── handlers/              # Request handlers
│   └── healthcheck.ts
├── middleware/            # Express middleware
│   └── errorHandler.ts
├── utils/                 # Utility functions
│   ├── environmentVariables.ts
│   └── logger.ts
└── app.ts                 # Application entry point
```


### Adding New Subgraphs

1. **Update supergraph configuration** (`supergraph.yaml`)
2. **Regenerate supergraph SDL**:
```shell script
  npm run compose
```

3. **Restart the gateway** to load the new schema

### Custom Middleware

Add custom middleware in `src/middleware/` and register in `app.ts`:

```typescript
import customMiddleware from './middleware/customMiddleware';

// Add after security middleware
app.use(customMiddleware);
```


## Deployment

### Environment-Specific Configuration

**Development:**
```
NODE_ENV=development
ENABLE_INTROSPECTION=true
ENABLE_GRAPHQL_PLAYGROUND=true
LOG_LEVEL=debug
CORS_ALLOWED_DOMAIN=localhost
```


**Production:**
```
NODE_ENV=production
ENABLE_INTROSPECTION=false
ENABLE_GRAPHQL_PLAYGROUND=false
LOG_LEVEL=warn
CORS_ALLOWED_DOMAIN=yourdomain.com
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `SERVICE_NAME` and `SERVICE_VERSION`
- [ ] Set `CORS_ALLOWED_DOMAIN` to your frontend domain
- [ ] Disable `ENABLE_INTROSPECTION` and `ENABLE_GRAPHQL_PLAYGROUND`
- [ ] Configure appropriate rate limiting values
- [ ] Set `LOG_LEVEL` to `warn` or `error`
- [ ] Enable all Apollo Armor security features
- [ ] Set up health check monitoring
- [ ] Configure log aggregation
- [ ] Test graceful shutdown behavior

## Dependencies

### Production Dependencies
- **@apollo/gateway**: Apollo Federation Gateway
- **@apollo/server**: Apollo GraphQL Server
- **@escape.tech/graphql-armor**: GraphQL security protection
- **express**: HTTP server framework
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers
- **express-rate-limit**: Rate limiting middleware
- **winston**: Structured logging
- **zod**: Runtime type validation

### Development Dependencies
- **typescript**: TypeScript compiler
- **ts-node**: TypeScript runtime
- **jest**: Testing framework
- **@apollo/rover**: Schema composition tool

## Support

### Common Issues

**Supergraph composition fails:**
- Ensure all subgraph URLs are accessible
- Verify subgraph schema compatibility
- Check Apollo Rover CLI installation

**CORS errors:**
- Verify `CORS_ALLOWED_DOMAIN` matches your frontend domain
- Check for protocol mismatches (http vs https)
- Ensure subdomain configuration is correct

**Rate limiting issues:**
- Adjust `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`
- Monitor logs for rate limit violations
- Consider implementing user-specific rate limits

**Memory issues:**
- Monitor Apollo Armor cost analysis limits
- Adjust query complexity limits based on your schema
- Consider implementing query result caching

### Performance Tuning

1. **Monitor Apollo Armor rejections** and adjust limits accordingly
2. **Tune rate limiting** based on actual usage patterns
3. **Configure query result caching** for frequently accessed data
4. **Implement connection pooling** for subgraph connections
5. **Use distributed caching** (Redis) for multi-instance deployments

