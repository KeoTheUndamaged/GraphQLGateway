## Gateway API - Apollo Federation GraphQL Gateway

A production-ready Apollo Federation Gateway service built with Express.js and TypeScript, providing a secure, observable, and scalable GraphQL API layer for microservices architecture.

## 🚀 Features

### Core Architecture
- **Apollo Federation Gateway** - Unified GraphQL API over multiple subgraph services
- **Express.js 5** - High-performance web framework with modern middleware
- **TypeScript** - Type-safe development with comprehensive type definitions
- **Production-ready** - Graceful shutdown, error handling, and health checks

### Security & Protection
- **Apollo Armor** - Comprehensive GraphQL security (query depth, complexity, rate limiting)
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

- **Node.js** 18+
- **npm** 8+
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

#### Server Configuration
```shell script
  NODE_ENV=development          # Environment: development, staging, production
  PORT=4000                    # Server port
  SERVICE_NAME=gateway-api     # Service identifier
  SERVICE_VERSION=1.0.0        # Service version
  LOG_LEVEL=info              # Logging level: error, warn, info, debug
```


#### GraphQL Configuration
```shell script
  ENABLE_INTROSPECTION=true    # Enable GraphQL schema introspection
  ALLOW_BATCHED_REQUESTS=false # Allow batched GraphQL requests
```


#### Rate Limiting
```shell script
  RATE_LIMIT_WINDOW_MS=900000  # Rate limit window (15 minutes)
  RATE_LIMIT_MAX=100          # Max requests per window per IP
```


#### OpenTelemetry (Optional)
```shell script
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
  OTEL_SERVICE_NAME=gateway-api
```


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
1. **Security Layer** - Helmet, CORS, Rate Limiting
2. **Logging** - HTTP request logging with Morgan
3. **GraphQL Processing** - Apollo Server with Federation Gateway
4. **Query Planning** - Route queries to appropriate subgraphs
5. **Execution** - Parallel subgraph requests with result composition
6. **Caching** - LRU cache for improved performance

### Security Architecture
- **Defense in Depth** - Multiple security layers
- **Query Protection** - Apollo Armor prevents malicious queries
- **Request Filtering** - CORS and rate limiting
- **Error Sanitization** - Safe error responses in production

## 🔧 Configuration Files

### TypeScript Configuration (`tsconfig.json`)
Optimised for Node.js with strict type checking and modern ES features.

### Apollo Armor Security
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
- **Custom Metrics** - Business-specific measurements

### Health Monitoring
- **Liveness Probes** - Process health status
- **Readiness Probes** - Service readiness status
- **Dependency Health** - Subgraph service status
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

1. Follow TypeScript and ESLint configurations
2. Maintain comprehensive documentation
3. Add tests for new features
4. Update environment templates
5. Follow security best practices

## 📄 License

This project is private and proprietary.

---

**Built with ❤️ using Apollo Federation, Express.js, and TypeScript**