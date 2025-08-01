## Gateway API - Apollo Federation GraphQL Gateway

A production-ready Apollo Federation Gateway service built with Express.js and TypeScript, providing a secure, observable, and scalable GraphQL API layer for microservices architecture.

## 🚀 Features

### Core Architecture

- **Apollo Federation Gateway** - Unified GraphQL API over multiple subgraph services
- **Express.js 5** - High-performance web framework with modern middleware
- **TypeScript** - Type-safe development with comprehensive type definitions
- **Production-ready** - Graceful shutdown, error handling, and health checks

### Security & Protection

- **Apollo Armour** - Comprehensive GraphQL security (query depth, complexity, rate limiting)
- **Helmet** - Security headers for common web vulnerabilities
- **CORS** - Cross-origin request filtering with configurable policies
- **Rate Limiting** - Request frequency limiting to prevent abuse and DoS attacks
- **Input Validation** - Environment variable validation with Zod schemas

### Observability & Monitoring

- **OpenTelemetry** - Distributed tracing and metrics collection
- **Winston Logging** - Structured JSON logging with multiple levels
- **HTTP Request Logging** - Morgan middleware integrated with Winston
- **Health Checks** - Service status endpoints for load balancers and orchestrators
- **Error Tracking** - Comprehensive error handling and reporting

### Performance & Reliability

- **Query Caching** - In-memory LRU cache for GraphQL query results
- **Connection Pooling** - Efficient subgraph service connections
- **Graceful Shutdown** - Zero-downtime deployments with proper cleanup
- **Process Monitoring** - Unhandled error catching and process stability

## 📋 Prerequisites

- **Node.js** 22+
- **npm** 11+
- **TypeScript** 5.5+
- **Apollo Rover CLI** (for supergraph composition)

## 🛠️ Installation

```shell script
  # Clone the repository
  git clone <repository-url>
  cd gateway-api

  # Install dependencies
  npm install

  # Set up environment variables
  cp .env.template .env
  # Edit .env with your configuration
```

## ⚙️ Configuration

### Environment Variables

The application uses environment-based configuration with Zod validation. Key configuration areas:

| Variable Name | Type | Default Value | Enum Options | Description |
|---|---|---|---|---|
| **Server Configuration** |
| `NODE_ENV` | enum | `production` | `production`, `candidate`, `uat`, `development`, `test` | Controls environment-specific behaviour throughout the application |
| `PORT` | string | `8080` | - | HTTP server port number |
| `LOG_LEVEL` | enum | `warn` | `error`, `warn`, `info`, `http`, `debug` | Winston logging level for application verbosity |
| `SERVICE_NAME` | string | *required* | - | Unique service identifier for monitoring and logging |
| `SERVICE_VERSION` | string | *required* | - | Version identifier for deployment tracking |
| **CORS Configuration** |
| `CORS_ALLOWED_DOMAIN` | string | *required* | - | Comma-separated list of authorised domains for cross-origin requests |
| **GraphQL Configuration** |
| `ENABLE_GRAPHQL_PLAYGROUND` | boolean | `false` | `true`, `false` | Enables GraphQL Playground web interface |
| `ENABLE_INTROSPECTION` | boolean | `false` | `true`, `false` | Allows clients to query GraphQL schema structure |
| `ALLOWED_BATCHED_REQUESTS` | boolean | `false` | `true`, `false` | Enables multiple GraphQL operations in single HTTP request |
| **Apollo Armour Security** |
| `ENABLE_BLOCK_FIELD_SUGGESTION` | boolean | `true` | `true`, `false` | Prevents GraphQL field name suggestions |
| `BLOCK_FIELD_SUGGESTION_MASK` | string | `<[REDACTED]>` | - | Replacement text for blocked field suggestions |
| `ENABLE_COST_LIMIT` | boolean | `true` | `true`, `false` | Enables query cost analysis and limiting |
| `COST_LIMIT_MAX_COST` | number | `5000` | - | Maximum computational cost allowed per query |
| `COST_LIMIT_OBJECT_COST` | number | `2` | - | Base cost assigned to object fields |
| `COST_LIMIT_SCALAR_COST` | number | `1` | - | Base cost assigned to scalar fields |
| `COST_LIMIT_DEPTH_COST_FACTOR` | number | `1.5` | - | Multiplication factor for query depth cost |
| `COST_LIMIT_IGNORE_INTROSPECTION` | boolean | `true` | `true`, `false` | Bypasses cost analysis for introspection queries |
| `ENABLE_MAX_DEPTH` | boolean | `true` | `true`, `false` | Limits GraphQL query nesting depth |
| `MAX_DEPTH_LIMIT` | number | `10` | - | Maximum allowed query nesting level |
| `MAX_DEPTH_FLATTEN_FRAGMENTS` | boolean | `false` | `true`, `false` | Includes fragment depth in calculation |
| `ENABLE_MAX_ALIASES` | boolean | `true` | `true`, `false` | Limits number of aliases per query |
| `MAX_ALIASES_LIMIT` | number | `10` | - | Maximum field aliases allowed per query |
| `ENABLE_MAX_DIRECTIVES` | boolean | `true` | `true`, `false` | Limits number of directives per query |
| `MAX_DIRECTIVES_LIMIT` | number | `50` | - | Maximum directives allowed per query |
| `ENABLE_MAX_TOKENS` | boolean | `true` | `true`, `false` | Limits total tokens in query |
| `MAX_TOKENS_LIMIT` | number | `1000` | - | Maximum lexical tokens per query |
| **Rate Limiting** |
| `RATE_LIMIT_WINDOW_MS` | number | `900000` | - | Time window for rate limiting (milliseconds) |
| `RATE_LIMIT_MAX` | number | `100` | - | Maximum requests per IP per window |
| **OpenTelemetry Configuration** |
| `ENABLE_OPEN_TELEMETRY_METRICS` | boolean | `false` | `true`, `false` | Enables metrics collection and export |
| `ENABLE_OPEN_TELEMETRY_TRACES` | boolean | `false` | `true`, `false` | Enables distributed tracing collection |
| `OPEN_TELEMETRY_SERVICE_NAMESPACE` | string | `graphql` | - | Service namespace for telemetry grouping |
| `OPEN_TELEMETRY_TRACES_HEADERS` | string (JSON) | `{}` | - | HTTP headers for trace export authentication |
| `OPEN_TELEMETRY_METRICS_HEADERS` | string (JSON) | `{}` | - | HTTP headers for metrics export authentication |
| `OPEN_TELEMETRY_TRACES_ENDPOINT_URL` | string | *optional* | - | URL for trace collection endpoint |
| `OPEN_TELEMETRY_METRICS_ENDPOINT_URL` | string | *optional* | - | URL for metrics collection endpoint |
| `OPEN_TELEMETRY_SAMPLING_RATE` | number | `1.0` | `0.0` - `1.0` | Fraction of traces to sample (0.0 = 0%, 1.0 = 100%) |

## Notes

- **Required variables** must be set or the application will fail to start
- **Boolean variables** accept string values `'true'` or `'false'` and are transformed to actual booleans
- **Number variables** accept string values and are transformed to numbers with validation
- **JSON variables** accept JSON string format for complex headers configuration
- **Optional variables** can be omitted; features will be disabled if related URLs are not provided

### Supergraph Configuration

Create a `supergraph.yaml` file defining your subgraph services:

```yaml
federation_version: =2.0.0
subgraphs:
  users:
    routing_url: http://localhost:4001/graphql
    schema:
      file: ./subgraphs/users.graphql
  products:
    routing_url: http://localhost:4002/graphql
    schema:
      file: ./subgraphs/products.graphql
```

## 🚀 Usage

### Development

```shell script
  # Start development server with hot reload
  npm run dev

  # Build TypeScript
  npm run build

  # Compose supergraph schema
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
```

## 📚 API Endpoints

### GraphQL Endpoint

- **URL**: `POST /graphql`
- **Description**: Main GraphQL API endpoint
- **Features**: Query planning, federated execution, caching

### Health Check

- **URL**: `GET /healthcheck`
- **Description**: Service health and status information
- **Response**: Service status, uptime, version, memory usage

### Telemetry Status (Development Only)

- **URL**: `GET /telemetry-status`
- **Description**: OpenTelemetry status and configuration
- **Available**: Non-production environments only

## 🏗️ Architecture

### Request Flow

1.  **Security Layer** - Helmet, CORS, Rate Limiting
2.  **Logging** - HTTP request logging with Morgan
3.  **GraphQL Processing** - Apollo Server with Federation Gateway
4.  **Query Planning** - Route queries to appropriate subgraphs
5.  **Execution** - Parallel subgraph requests with result composition
6.  **Caching** - LRU cache for improved performance

### Security Architecture

- **Defence in Depth** - Multiple security layers
- **Query Protection** - Apollo Armour prevents malicious queries
- **Request Filtering** - CORS and rate limiting
- **Error Sanitisation** - Safe error responses in production

## 🔧 Configuration Files

### TypeScript Configuration (`tsconfig.json`)

Optimised for Node.js with strict type checking and modern ES features.

### Apollo Armour Security

Comprehensive GraphQL security rules protecting against:

- Query depth attacks
- Query complexity attacks
- Alias flooding
- Directive flooding
- Token flooding

### CORS Policy

Configurable cross-origin resource sharing with:

- Origin allowlisting
- Method restrictions
- Credential support
- Preflight handling

## 📊 Monitoring & Observability

### Logging

- **Structured JSON** - Machine-readable log format
- **Multiple Levels** - Error, warn, info, debug
- **Request Tracking** - HTTP request/response logging
- **Error Context** - Comprehensive error information

### Metrics & Tracing

- **OpenTelemetry Integration** - Distributed tracing
- **Express Instrumentation** - HTTP request metrics
- **GraphQL Instrumentation** - Query performance tracking

### Health Monitoring

- **Liveness Probes** - Process health status
- **Performance Metrics** - Response times and throughput

## 🚢 Deployment

### Container Deployment

The application is container-ready with:

- **Graceful Shutdown** - SIGTERM/SIGINT handling
- **Health Checks** - Container orchestration support
- **Process Monitoring** - Unhandled error recovery
- **Zero-downtime Updates** - Rolling deployment support

### Environment-specific Configuration

- **Development** - Full introspection, detailed errors, debug logging
- **Staging** - Production-like with enhanced monitoring
- **Production** - Security hardened, minimal error disclosure

## 🤝 Contributing

1.  Follow TypeScript and ESLint configurations
2.  Maintain comprehensive documentation
3.  Add tests for new features
4.  Update environment templates
5.  Follow security best practices

## 📄 License

This project is private and proprietary.

-----

**Built with ❤️ using Apollo Federation, Express.js, and TypeScript**