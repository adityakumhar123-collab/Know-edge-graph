# AegisGraph AI — Feature Demonstration Guide

> **What it is**: A zero-config, privacy-first tool that takes any local Git repository, maps how it works as a clean knowledge graph, finds security vulnerabilities by severity, and lets you interrogate the codebase through a local **Gemma 4** AI agent — all without any cloud dependencies.

---

## 🚀 Getting Started in 3 Steps

```powershell
# Step 1: Start the backend
.\start_local.ps1

# Step 2: Start the frontend (in a new terminal)
cd Phase4\frontend && npm run dev

# Step 3: Open the app
Start-Process "http://localhost:5173"

# Step 4 (one-time, for live Gemma 4 AI):
ollama run gemma4:e4b
```

---

## 🖥️ The 3-Panel Interface

```
┌──────────────────────┬──────────────────────────────────┬──────────────────────┐
│    LEFT PANEL        │        MIDDLE PANEL               │     RIGHT PANEL       │
│                      │                                   │                       │
│  📁 Repo Ingestion   │   🕸️ Functional Knowledge Graph   │  🐛 Vulnerability     │
│  + Gemma 4 Chat      │                                   │     Priority List     │
│                      │                                   │                       │
│  Provide local path  │  Nodes = high-level features      │  CRITICAL / HIGH /    │
│  or upload .zip      │  Edges = data flow & dependencies │  MEDIUM / LOW bugs    │
│                      │                                   │                       │
└──────────────────────┴──────────────────────────────────┴──────────────────────┘
```

---

## 🔬 Feature 1: Repository Ingestion

### Providing a Local Path

1. Type the full path to your project directory in the input box, e.g. `C:\Projects\my-webapp`
2. Press **Scan** or hit `Enter`.
3. The system checks for a `.git` folder automatically.

### What Happens Behind the Scenes

| Step | Action |
|---|---|
| `.git` check | Validates the directory is a real Git repo |
| Tree walk | Reads all `.py`, `.js`, `.ts`, `.jsx`, `.tsx` source files |
| Parsing | Python AST parsing + regex for JS/TS |
| Graph build | Groups code into functional concepts |
| Vuln scan | Static analysis for security issues |

### Error Cases

| Input | Response |
|---|---|
| A folder with no `.git` | 🔴 `"not a git repo"` — no further processing |
| Non-existent path | 🔴 Error message |
| Path with no code files | 🔴 "No readable source files found" |

### ZIP Upload Alternative
Click **Upload .zip** to upload a zipped repository archive. The tool verifies the ZIP contains a `.git` folder before proceeding — same `.git` requirement.

---

## 🕸️ Feature 2: Functional Knowledge Graph

The graph abstracts away file-level details and maps your code into **high-level functional concepts** — the *what*, not the *how*.

### Example: A Typical Web App

Given a project with files spread across `src/components/LoginForm.jsx`, `api/auth.py`, `db/models.py`, and `services/user_service.py`, AegisGraph produces:

```
[Form & Input UI]  --SUBMITS_TO-->  [API Gateway & Endpoints]
                                          |
                                    PROTECTED_BY
                                          |
                                          v
                                  [Auth & Access Control]
                                          |
                                     DISPATCHES
                                          |
                                          v
                               [Core Business Services]  --QUERIES-->  [Database & Persistence]
```

### Node Categories & Colors

| Category | Color | Represents |
|---|---|---|
| **UI** | Blue | Forms, buttons, views, components |
| **API / Routing** | Indigo | HTTP endpoints, route declarations |
| **Authentication** | Rose | Auth, JWT, sessions, permissions |
| **Storage / DB** | Emerald | Models, schemas, SQL, repositories |
| **Service** | Amber | Business logic, orchestration |

### Clicking a Node: File & Line Inspector

Click any functional node and the inspector opens at the bottom of the graph panel, showing **exact file paths and line ranges** where that functionality lives:

```
📄 frontend/src/components/LoginForm.jsx     Lines  1 –  87
📄 frontend/src/components/RegisterForm.jsx  Lines  1 – 112
📄 frontend/src/pages/AuthPage.jsx           Lines 23 –  95
```

No need to grep or search — you know exactly where to look.

---

## 🐛 Feature 3: Vulnerability Priority List

The right panel shows a severity-ranked list of security issues detected in the scanned repository.

### Severity Levels

| Badge | Level | Examples |
|---|---|---|
| 🔴 **CRITICAL** | Must fix immediately | `eval()`, `exec()`, `dangerouslySetInnerHTML`, `shell=True` |
| 🟠 **HIGH** | Fix before shipping | Hardcoded API keys/tokens, `verify=False`, pickle deserialization |
| 🟡 **MEDIUM** | Address soon | Insecure cookie flags, missing input validation |
| 🔵 **LOW** | Monitor | Deprecated APIs, development debugging code |

### Example Vulnerability Card

```
┌──────────────────────────────────────────────────────────────┐
│  CRITICAL                             routes/exec.py : 47    │
│                                                              │
│  Shell Injection via subprocess(shell=True)                  │
│                                                              │
│  subprocess.run(cmd, shell=True, capture_output=True)        │
│                                                              │
│  Subprocess configured with shell=True enables command       │
│  injection if cmd contains shell metacharacters.             │
│                                                              │
│  Fix: Pass arguments as a list and set shell=False.          │
└──────────────────────────────────────────────────────────────┘
```

### Filtering
Use the severity filter buttons to narrow the list:
`ALL (12)` → `CRITICAL (2)` → `HIGH (5)` → `MEDIUM (3)` → `LOW (2)`

---

## 🤖 Feature 4: Gemma 4 Codebase Agent

The left panel includes an AI chat interface powered by Google's **Gemma 4** running locally on your machine via Ollama.

### What Gemma 4 Knows

The agent is grounded with the full context of your repository scan:
- All **functional nodes** (names, categories, descriptions, file locations)
- All **functional edges** (inter-component relationships)
- All **detected vulnerabilities** (severity, location, remediation)

### Example Conversations

**Understanding Architecture:**
```
You:    How does a user request flow through this application?
Gemma4: Based on the graph, user requests enter via the API Gateway & Endpoints
        (routes/api.py: L1-200). They pass through Auth & Access Control
        (middleware/auth.py: L1-85) for JWT verification before being dispatched
        to Core Business Services (services/user_service.py: L40-180), which
        queries Database & Persistence (models/user.py: L1-95).
```

**Security Analysis:**
```
You:    What are the most dangerous vulnerabilities found?
Gemma4: 2 CRITICAL issues require immediate attention:
        1. Shell Injection at exec.py:47 — subprocess with shell=True allows
           command injection. Fix: use argument list with shell=False.
        2. eval() usage at utils.py:23 — arbitrary code execution.
           Fix: replace with json.loads() or ast.literal_eval().
```

### Quick Prompt Buttons

Two shortcuts are available below the chat:
- **Architecture Overview** — Explain the components and their relationships
- **Top Vulnerabilities** — Summarize the highest-severity security issues

### Running Without Ollama

If Ollama is not yet running, the agent still works by synthesizing answers **directly from the graph context** and shows:
```
ℹ️ Gemma 4 is offline. To enable live AI: run `ollama run gemma4`

Here's what I found from the repository analysis: [graph-grounded answer]
```

---

## 📦 Supported Repository Types

| Language / Stack | Support |
|---|---|
| Python (FastAPI, Flask, Django) | Full AST analysis + security scan |
| JavaScript / TypeScript | Regex + import graph |
| React / Next.js (.jsx, .tsx) | Component & form detection |
| HTML | Form and structure detection |

---

## ⚙️ One-time Gemma 4 Setup

```powershell
# 1. Install Ollama from https://ollama.com (Windows installer)
# 2. Pull Gemma 4 — pick size based on your hardware:
ollama pull gemma4:e4b      # Recommended default (~3 GB, fast)
ollama pull gemma4:12b      # Balanced quality (~7 GB)
ollama pull gemma4:26b      # High quality MoE (~15 GB)

# 3. Start AegisGraph
.\start_local.ps1
```

---

## 🔒 Privacy Guarantees

- **Zero network calls** during analysis — all computation is local.
- **No data retention** — repository files are memory-only during analysis.
- **No raw code stored** — vulnerability findings store only line hashes.
- **Fully offline-capable** — works without internet after `ollama pull`.
