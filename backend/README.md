# Cloud Infrastructure Health & Cost Intelligence API

Enterprise-grade Node.js/Express backend that interfaces with AWS SDK v3 to collect cloud infrastructure inventory, fetch CloudWatch monitoring metrics, query Cost Explorer spend analytics, and expose REST APIs for a modern React dashboard.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Module System**: JavaScript ES Modules (`"type": "module"`)
- **Cloud SDK**: AWS SDK for JavaScript v3 (`@aws-sdk/client-ec2`, `@aws-sdk/client-cloudwatch`, `@aws-sdk/client-cost-explorer`)
- **Security**: Helmet (security HTTP headers), CORS (origin whitelist validation)
- **Environment Management**: `dotenv`
- **Development Tooling**: Nodemon, Node.js native test runner

---

## Folder Structure

```
backend/
├── .env.example              # Environment variables template (no secrets)
├── .gitignore                # Git ignore rules for node_modules and .env
├── package.json              # Dependencies and lifecycle scripts
├── server.js                 # Express application initialization and server bootstrap
├── README.md                 # Documentation and AWS permissions specification
├── config/
│   └── aws.js                # AWS SDK v3 client initialization & credential provider chain
├── routes/
│   ├── health.routes.js      # GET /api/health
│   ├── overview.routes.js    # GET /api/overview
│   ├── instances.routes.js   # GET /api/instances
│   ├── metrics.routes.js     # GET /api/metrics
│   ├── costs.routes.js       # GET /api/costs
│   ├── alerts.routes.js      # GET /api/alerts
│   └── recommendations.routes.js # GET /api/recommendations
├── services/
│   ├── alert.service.js          # Rule-based infrastructure alert engine
│   ├── cost-analysis.service.js  # Spend analytics, trend direction, and period comparisons
│   ├── recommendation.service.js # Rightsizing and FinOps cost optimization rules
│   ├── ec2.service.js            # EC2 resource inventory retrieval and parsing
│   ├── cloudwatch.service.js     # CloudWatch metric data points and alarm retrieval
│   ├── cost.service.js           # Cost Explorer expenditure & service breakdown
│   └── demo.data.js              # Realistic demo dataset for local development fallback
└── tests/
    ├── api.test.js               # Express API contract integration test suite
    └── finops-rules.test.js      # Unit tests for alert, cost analysis, and recommendation rules
```

---

## AWS IAM Permissions Required

To operate with the principle of least privilege, attach the following **read-only** IAM policy to the user, role, or instance profile running this backend.

> [!IMPORTANT]
> This backend performs strictly **read-only** operations. It never creates, modifies, stops, or terminates any AWS resources.

### Minimum IAM Policy (JSON)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2ReadOnlyInventory",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchMetricsReadOnly",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics",
        "cloudwatch:DescribeAlarms"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CostExplorerReadOnly",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetDimensionValues",
        "ce:GetCostForecast"
      ],
      "Resource": "*"
    }
  ]
}
```

### AWS Cost Explorer Prerequisites
- Cost Explorer must be enabled in the AWS Billing & Cost Management console. It typically takes 24 hours to generate initial data after enabling.
- If Cost Explorer is not enabled or credentials lack billing permissions, the backend automatically flags the response gracefully or falls back to demo data when configured.

---

## Security Best Practices Implemented

1. **AWS Default Credential Provider Chain**:
   - Resolves credentials automatically from environment variables, local AWS profile (`~/.aws/credentials`), IAM role (EC2 metadata or ECS task role), or AWS IAM Identity Center (SSO).
   - Zero hardcoded credentials in source code.
2. **Credential Privacy**: AWS access keys and secret tokens are never exposed or returned in API responses.
3. **No Infrastructure Modification**: All AWS SDK calls use read-only `Describe*`, `Get*`, and `List*` commands.
4. **Environment Isolation**: `.env` is excluded in `.gitignore`; `.env.example` provides safe templates.
5. **CORS & Headers**: Configured with Helmet security headers and origin-checked CORS middleware.
6. **Data Integrity Assurance**: The backend never invents live data. If live requests fail, responses are explicitly tagged with `mode: "demo"` or return actionable errors.

---

## Getting Started

### 1. Prerequisites
- Node.js 18.x, 20.x, or 22+ installed
- (Optional for live mode) AWS CLI configured (`aws configure`) or IAM role attached

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment Variables
Create your local `.env` from the provided template:
```bash
cp .env.example .env
```

Key environment configurations in `.env`:
| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port on which the Express server listens |
| `NODE_ENV` | `development` | Application environment (`development` or `production`) |
| `FRONTEND_URL` | `http://localhost:3000,http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `AWS_REGION` | `us-east-1` | Target AWS Region for EC2 and CloudWatch |
| `AWS_PROFILE` | `default` | Optional local AWS profile to use |
| `DEMO_MODE` | `auto` | `auto` (fallback to demo if AWS unconfigured), `live` (strict AWS), `demo` (always demo) |

### 4. Run the Server

#### Development Mode (with hot-reloading via Nodemon):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

### 5. Run the Automated Test Suite
```bash
npm test
```

---

## REST API Reference

### 1. Health Check
`GET /api/health`

Returns service health, AWS connectivity status, and active execution mode.

**Response (200 OK):**
```json
{
  "status": "ok",
  "awsConfigured": true,
  "mode": "live",
  "region": "us-east-1",
  "timestamp": "2026-10-29T10:00:00.000Z"
}
```

---

### 2. Infrastructure & Cost Overview
`GET /api/overview`

Aggregates high-level inventory counts, monthly spend, and alert counts for dashboard summary cards.

**Response (200 OK):**
```json
{
  "totalInstances": 5,
  "runningInstances": 3,
  "stoppedInstances": 2,
  "monthlyCost": 1485.62,
  "activeAlerts": 4,
  "mode": "live"
}
```

---

### 3. EC2 Instances
`GET /api/instances`

Retrieves inventory of EC2 instances with state, type, availability zone, IP addresses, and tags.

**Query Parameters:**
- `state` *(optional)*: Filter by instance state (e.g. `running`, `stopped`).
- `search` *(optional)*: Search term matching instance ID, name, or type.

**Response (200 OK):**
```json
{
  "instances": [
    {
      "instanceId": "i-09a8b7c6d5e4f3a21",
      "name": "production-api-01",
      "state": "running",
      "instanceType": "t3.xlarge",
      "availabilityZone": "us-east-1a",
      "launchTime": "2026-08-15T08:30:00.000Z",
      "publicIp": "54.210.45.12",
      "privateIp": "10.0.1.15",
      "tags": {
        "Environment": "Production",
        "Project": "Core-API"
      }
    }
  ],
  "mode": "live"
}
```

---

### 4. CloudWatch Metrics
`GET /api/metrics`

Retrieves CPU utilization statistics and time-series data points for instances.

**Query Parameters:**
- `lookbackHours` *(optional, default: 24)*: Number of hours to look back.
- `period` *(optional, default: 3600)*: Granularity period in seconds (multiples of 60).
- `instanceId` *(optional)*: Target specific instance ID.

**Response (200 OK):**
```json
{
  "metrics": [
    {
      "instanceId": "i-09a8b7c6d5e4f3a21",
      "instanceName": "production-api-01",
      "metricName": "CPUUtilization",
      "unit": "Percent",
      "average": 68.4,
      "maximum": 94.2,
      "minimum": 42.1,
      "datapoints": [
        {
          "timestamp": "2026-10-29T08:00:00.000Z",
          "average": 65.2,
          "maximum": 88.0,
          "minimum": 45.0
        }
      ]
    }
  ],
  "mode": "live"
}
```

---

### 5. Cost Explorer Analytics
`GET /api/costs`

Retrieves daily spend trend and service-by-service cost breakdown.

**Query Parameters:**
- `startDate` *(optional, format: `YYYY-MM-DD`)*: Range start date.
- `endDate` *(optional, format: `YYYY-MM-DD`)*: Range end date (exclusive).

**Response (200 OK):**
```json
{
  "currency": "USD",
  "totalCost": 1485.62,
  "dailyCosts": [
    {
      "date": "2026-10-15",
      "amount": 54.20,
      "unit": "USD"
    }
  ],
  "serviceBreakdown": [
    {
      "service": "Amazon Elastic Compute Cloud - Compute",
      "amount": 620.40,
      "unit": "USD",
      "percentage": 41.76
    },
    {
      "service": "Amazon Relational Database Service",
      "amount": 395.12,
      "unit": "USD",
      "percentage": 26.60
    }
  ],
  "mode": "live"
}
```

---

### 6. Cloud Infrastructure Alerts
`GET /api/alerts`

Retrieves active CloudWatch alarms and health warnings (such as prolonged stopped instances).

**Response (200 OK):**
```json
{
  "alerts": [
    {
      "id": "alt-001",
      "type": "error",
      "resourceId": "i-09a8b7c6d5e4f3a21",
      "resourceType": "EC2",
      "message": "High CPU utilization sustained > 90% for 15 minutes",
      "timestamp": "2026-10-29T09:30:00.000Z",
      "severity": "high"
    }
  ],
  "mode": "live"
}
```

---

### 7. Cost & Health Optimization Recommendations
`GET /api/recommendations`

Returns actionable FinOps and infrastructure optimization suggestions (e.g. idle resources, downsizing, Savings Plans, modern instance family upgrades).

**Response (200 OK):**
```json
{
  "recommendations": [
    {
      "id": "rec-001",
      "category": "Cost Optimization",
      "title": "Downsize underutilized EC2 instance",
      "description": "Instance staging-api-01 averages 3.5% CPU utilization. Downsizing to t3.small is recommended.",
      "resourceId": "i-03e2f1a0b9c8d7e65",
      "estimatedMonthlySavings": 15.50,
      "currency": "USD",
      "impact": "Low"
    }
  ],
  "mode": "live"
}
```
