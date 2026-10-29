# Cloud Infrastructure Health & Cost Intelligence Platform - Frontend

A professional, enterprise-grade cloud monitoring and FinOps dashboard built with **React**, **Vite**, and **Tailwind CSS**. Designed for engineering teams and cloud financial managers to monitor AWS infrastructure health, track expenditure trends, analyze compute utilization, and evaluate actionable rightsizing recommendations.

---

## Tech Stack

- **Framework**: React 18 with Vite 6
- **Routing**: React Router v6 (`react-router-dom`)
- **Styling**: Tailwind CSS v3
- **Data Visualization**: Recharts 2.x (`AreaChart`, `PieChart`, `BarChart`, `ResponsiveContainer`)
- **Icons**: Lucide React Icons (`lucide-react`)
- **HTTP Client**: Native Fetch API with central fallback handler and timeout abstraction

---

## Design System & Theme

- **Sidebar**: Dark navy (`#0a1128` / `slate-900`) with cloud branding and security indicators
- **Canvas**: Clean light dashboard background (`slate-50`)
- **Cards**: Crisp white containers (`bg-white rounded-xl shadow-xs border border-slate-200`)
- **Accents**: Deep indigo (`#4f46e5`) and tech blue (`#3b82f6`)
- **Status Badges**:
  - Running: Emerald green pulse (`bg-emerald-50 text-emerald-700`)
  - Stopped: Amber warning (`bg-amber-50 text-amber-700`)
  - Critical Alerts: Rose red (`bg-rose-50 text-rose-700`)

---

## Folder Structure

```
frontend/
├── index.html                  # HTML entry point with metadata and favicon
├── vite.config.js              # Vite bundler configuration (port 3000)
├── tailwind.config.js          # Tailwind styling rules and navy palette
├── postcss.config.js           # PostCSS autoprefixer integration
├── package.json                # Dependencies and build scripts
├── .env.example                # Template for Vite environment variables
├── .env                        # Local environment variables
├── public/
│   └── cloud-icon.svg          # Platform cloud icon / favicon
└── src/
    ├── main.jsx                # React root mount
    ├── App.jsx                 # Routing configuration & global layout shell
    ├── index.css               # Tailwind directives and custom scrollbar
    ├── api/
    │   ├── client.js           # Centralized API client with fallback handling
    │   └── mockData.js         # Realistic fallback dataset for demo/offline use
    ├── components/
    │   ├── common/
    │   │   ├── StatCard.jsx    # Metric / KPI card with trend indicator
    │   │   ├── StatusBadge.jsx # Dynamic running/stopped and severity badges
    │   │   ├── LoadingSpinner.jsx # Clean SVG loading indicator
    │   │   ├── ErrorAlert.jsx  # Dismissible error banner with retry action
    │   │   └── EmptyState.jsx  # Empty state illustration and helpful guidance
    │   ├── layout/
    │   │   ├── Sidebar.jsx     # Dark navy navigation drawer
    │   │   ├── Header.jsx      # Top header with Live/Demo badge & Sync action
    │   │   └── Layout.jsx      # Reusable page shell
    │   └── charts/
    │       ├── SpendTrendChart.jsx      # Recharts AreaChart with gradient
    │       ├── ServicePieChart.jsx      # Recharts Donut chart with legend
    │       └── CpuUtilizationChart.jsx  # Recharts dual-bar chart (Avg vs Peak)
    └── pages/
        ├── OverviewPage.jsx             # Executive KPI & overview dashboard
        ├── InfrastructurePage.jsx       # EC2 table, state filter, search, & tags
        ├── CostIntelligencePage.jsx     # Spend analytics, highest cost, trend
        ├── AlertsRecommendationsPage.jsx# Alerts and FinOps recommendations
        └── SettingsPage.jsx             # System status, architecture, capstone info
```

---

## Pages & Capabilities

### 1. Overview Dashboard (`/`)
- **5 High-Impact KPI Cards**: Total EC2 Instances, Running Instances, Stopped Instances, Monthly Cost, and Active Alerts.
- **AWS Spending Trend Chart**: Area chart visualizing daily spend trajectory.
- **Spend by Service Donut Chart**: Proportional breakdown of AWS products.
- **EC2 CPU Utilization Overview**: Dual-bar chart displaying average and peak CPU loads.
- **Recent Alerts Feed**: Quick preview of infrastructure anomalies.

### 2. Infrastructure Monitoring (`/infrastructure`)
- **Compute Inventory Table**: Displays Instance ID, Name, State, Type, Availability Zone, CPU Utilization progress bar, IP Addresses, and Status Checks.
- **Interactive Controls**: Instant search by keywords (ID, name, type), state filter buttons (`All`, `Running`, `Stopped`), and sync refresh.
- **Instance Details Modal**: Deep dive into launch timestamps and configured AWS resource tags.

### 3. Cost Intelligence (`/costs`)
- **FinOps Metrics**: Total spend, Highest-cost AWS service, Average daily spend, and Period spend trend direction (`increasing`, `decreasing`, `stable`).
- **Spend Progression**: Daily expenditure area chart.
- **Service Allocation Table**: Ranked expenditure table with visual proportion bars.
- **FinOps Callout**: Highlights potential optimization areas.

### 4. Alerts & Recommendations (`/alerts`)
- **Dual-View Switcher**: Toggle between **Active Alerts** and **FinOps Recommendations**.
- **Severity & Priority Filters**: Filter alerts by `Critical`, `Warning`, or `Info`; filter recommendations by `High`, `Medium`, or `Low`.
- **Explanatory Alerts**: Explains stopped instances may be intentional while flagging provisioned EBS storage charges.
- **Actionable Next Steps**: Interactive acknowledge and "Mark as In-Progress" tracking. Strictly preserves `null` for unassessed savings (never invents synthetic numbers).

### 5. Project Information & System Diagnostics (`/settings`)
- **Capstone Project Overview**: Details objective and FinOps heuristics methodology.
- **Live Health Handshake**: Diagnostic card testing connectivity against `http://localhost:5000/api/health`.
- **Data Source Verification**: Status indicators for Amazon EC2, Amazon CloudWatch, and AWS Cost Explorer.
- **Technology Stack Badges**: Complete breakdown of frontend and backend technologies.

---

## Backend Integration & Demo Mode

The frontend communicates with the backend via [src/api/client.js](file:///c:/Users/shaks/OneDrive/Desktop/cloud-infrastructure-health-cost-intelligence/frontend/src/api/client.js) using the configured `VITE_API_BASE_URL`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

- **Live AWS Mode**: When the backend is authenticated with AWS, real cloud resources and CloudWatch metrics are presented with a green badge: `AWS LIVE CONNECTED`.
- **Demo Mode**: When AWS credentials are missing or backend runs in demo mode, data is accompanied by a visible amber badge: `DEMO MODE (SIMULATED DATA)`.
- **Offline Fallback**: If the backend server is offline or unreachable, the frontend gracefully falls back to its internal mock dataset ([src/api/mockData.js](file:///c:/Users/shaks/OneDrive/Desktop/cloud-infrastructure-health-cost-intelligence/frontend/src/api/mockData.js)), ensuring zero crashes or broken screens during capstone presentations.

---

## Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000` (or `http://localhost:5173`).

### 3. Build for Production
```bash
npm run build
```
Creates an optimized, production-ready build in `dist/`.

### 4. Preview Production Build
```bash
npm run preview
```
