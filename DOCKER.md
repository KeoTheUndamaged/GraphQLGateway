# Docker Setup for GraphQL Gateway

This document provides instructions for building, running, and deploying the GraphQL Gateway using Docker.

## Overview

The GraphQL Gateway uses a multi-stage Docker build process to create a minimal and secure production image. The setup includes:

1. A multi-stage Dockerfile that separates build and runtime environments
2. Security hardening measures
3. Docker Compose configuration for easy deployment
4. Resource limits and health checks

## Quick Start

### Build and Run with Docker Compose

The simplest way to run the application is using Docker Compose:

```bash
   # Build and start the container
   docker-compose up -d

   # View logs
   docker-compose logs -f

   # Stop the container
   docker-compose down
```

### Build and Run Manually

You can also build and run the Docker image manually:

```bash
   # Build the image
   docker build -t graphql-gateway:latest .

   # Run the container
   docker run -d -p 8080:8080 \
     --name graphql-gateway \
     -e NODE_ENV=production \
     -e SERVICE_NAME=graphql-gateway \
     -e SERVICE_VERSION=1.0.0 \
     -e CORS_ALLOWED_DOMAIN=localhost \
    graphql-gateway:latest
```

## Environment Variables

The Docker setup supports all environment variables defined in the application. Key variables include:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | HTTP server port | `8080` |
| `LOG_LEVEL` | Logging verbosity | `warn` |
| `SERVICE_NAME` | Service identifier | `graphql-gateway` |
| `CORS_ALLOWED_DOMAIN` | Allowed CORS domains | `localhost` |

For a complete list of environment variables, refer to the `.env.template` file.

## Security Features

The Docker setup includes several security best practices:

1. **Multi-stage build** - Minimizes image size and attack surface
2. **Non-root user** - Container runs as a non-privileged user
3. **Dependency pruning** - Only production dependencies are included
4. **Minimal base image** - Uses Alpine Linux for a small footprint
5. **Signal handling** - Uses dumb-init as PID 1 for proper process management
6. **Health checks** - Monitors application health

## Production Deployment Recommendations

For production deployments, consider the following:

1. **Use specific image tags** - Tag images with specific versions rather than `latest`
2. **Set resource limits** - Configure appropriate CPU and memory limits
3. **Use secrets management** - For sensitive environment variables
4. **Configure logging** - Set up log aggregation
5. **Implement monitoring** - Enable OpenTelemetry for observability
6. **Use a container orchestration platform** - Such as Kubernetes or AWS ECS

### Kubernetes Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: graphql-gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: graphql-gateway
  template:
    metadata:
      labels:
        app: graphql-gateway
    spec:
      containers:
      - name: graphql-gateway
        image: graphql-gateway:1.0.0
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "250m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /healthcheck
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        env:
        - name: NODE_ENV
          value: "production"
        # Add other environment variables as needed
```

## Customizing the Docker Setup

### Custom Build Arguments

You can customize the build process using build arguments:

```bash
   docker build \
     --build-arg NODE_VERSION=22 \
     -t graphql-gateway:custom .
```

### Using Docker Compose Profiles

For different environments, you can use Docker Compose profiles:

```yaml
# Add to docker-compose.yml
services:
  graphql-gateway:
    profiles:
      - production
      - development
    # ... other configuration
```

Then run with a specific profile:

```bash
   docker-compose --profile development up -d
```

## Troubleshooting

### Common Issues

1. **Container exits immediately** - Check logs with `docker logs graphql-gateway`
2. **Health check fails** - Ensure the application is properly configured
3. **Permission issues** - Verify volume mounts have correct permissions

### Debugging

For debugging, you can run the container with an interactive shell:

```bash
   docker run -it --rm graphql-gateway:latest /bin/sh
```

## Best Practices

1. **Keep images small** - Include only necessary files
2. **Use .dockerignore** - Exclude unnecessary files from the build context
3. **Scan for vulnerabilities** - Use tools like Trivy or Snyk
4. **Update base images** - Regularly update to get security patches
5. **Use multi-stage builds** - Separate build and runtime environments
6. **Set resource limits** - Prevent resource exhaustion
7. **Use health checks** - Enable automatic recovery