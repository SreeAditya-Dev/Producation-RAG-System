# LangSmith Dashboard Images

This folder contains LangSmith dashboard screenshots for the RAG System documentation.

## Required Images

Please add the following images to this folder:

### 1. `ingestion-trace.png`
**Purpose**: Shows the document ingestion pipeline trace

**What to capture**:
- Full trace of document upload process
- Stages: parsing → chunking → embedding → storing
- Token counts and latency for each stage
- Success indicators

**Size recommendation**: 1200x800px or similar aspect ratio

---

### 2. `query-trace.png`
**Purpose**: Shows the query processing pipeline trace

**What to capture**:
- Complete query flow from embedding to response
- Stages: query embedding → retrieval → reranking → compression → LLM generation
- Token usage breakdown
- Latency metrics per stage

**Size recommendation**: 1200x800px or similar aspect ratio

---

### 3. `token-usage.png`
**Purpose**: Shows token consumption analytics

**What to capture**:
- Token usage charts/graphs
- Prompt tokens vs completion tokens
- Embedding tokens
- Daily/weekly trends

**Size recommendation**: 1200x600px or similar aspect ratio

---

### 4. `metrics-dashboard.png`
**Purpose**: Shows performance metrics dashboard

**What to capture**:
- Latency percentiles (p50, p95, p99)
- Success/failure rates
- Request throughput
- Error tracking

**Size recommendation**: 1200x800px or similar aspect ratio

---

## How to Take Screenshots

1. **Login to LangSmith**: Go to https://smith.langchain.com
2. **Navigate to your project**: Select "rag-system" project
3. **Find the relevant trace**: Click on a successful run
4. **Capture full trace**: Take screenshot of the complete trace view
5. **Include details**: Make sure token counts, latencies, and stages are visible

## Image Guidelines

- **Format**: PNG (preferred) or JPG
- **Resolution**: At least 1200px wide for clarity
- **Content**: Ensure no sensitive data (API keys, user data) is visible
- **Annotations**: You can add callouts/arrows to highlight key areas

## Usage in Main README

These images are referenced in the main README.md under the "Observability & Monitoring" section:

```markdown
![LangSmith Ingestion Trace](docs/images/langsmith/ingestion-trace.png)
![LangSmith Query Trace](docs/images/langsmith/query-trace.png)
![LangSmith Token Usage](docs/images/langsmith/token-usage.png)
![LangSmith Metrics Dashboard](docs/images/langsmith/metrics-dashboard.png)
```

## Tips for Best Results

1. **Use Dark Mode**: Matches the README's dark theme better
2. **Full Width**: Expand the trace view to full width before capturing
3. **Clear Labels**: Ensure stage names and metrics are readable
4. **Consistent Style**: Use similar zoom levels across all screenshots
5. **Avoid Clutter**: Hide unnecessary UI elements before capturing
