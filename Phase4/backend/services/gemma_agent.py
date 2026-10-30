"""
Local Gemma 4 Agent Service for AegisGraph AI.
Communicates with Ollama running locally (http://127.0.0.1:11434) using Google's Gemma 4 model,
grounded on the functional repository knowledge graph and vulnerability priority list.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_GEMMA_MODEL = os.environ.get("GEMMA_MODEL", "gemma4:e4b")


def query_ollama_gemma(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_GEMMA_MODEL,
    timeout_sec: float = 60.0
) -> Dict[str, Any]:
    """
    Sends chat prompt to local Ollama instance running Gemma 4.
    """
    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 1024,
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data.get("message", {}).get("content", "")
            return {
                "success": True,
                "content": content,
                "model": model,
                "provider": "ollama_local"
            }
    except urllib.error.URLError as err:
        return {
            "success": False,
            "error": f"Could not connect to Ollama at {OLLAMA_URL}. Ensure Ollama is running (`ollama run {model}`).",
            "provider": "offline"
        }
    except Exception as err:
        return {
            "success": False,
            "error": str(err),
            "provider": "offline"
        }


def generate_agent_response(
    query: str,
    functional_nodes: List[Dict[str, Any]],
    functional_edges: List[Dict[str, Any]],
    vulnerabilities: List[Dict[str, Any]],
    repo_name: str = "Repository",
    model: str = DEFAULT_GEMMA_MODEL
) -> Dict[str, Any]:
    """
    Assembles graph and vulnerability context, queries Gemma 4,
    or synthesizes a grounded response if local Ollama daemon is offline.
    """
    # 1. Build concise context for Gemma
    graph_summary_lines = []
    for n in functional_nodes:
        locs = ", ".join(f"{loc.get('file', '')} (L{loc.get('start_line', 1)}-L{loc.get('end_line', 1)})" for loc in n.get("locations", [])[:3])
        graph_summary_lines.append(f"- [{n.get('category', 'Module')}] **{n.get('name', '')}**: {n.get('summary', '')} | Files: {locs}")

    edge_summary_lines = []
    for e in functional_edges:
        edge_summary_lines.append(f"- {e.get('source')} --({e.get('relationship')})--> {e.get('target')}")

    vuln_summary_lines = []
    for v in vulnerabilities[:10]:
        vuln_summary_lines.append(f"- [{v.get('severity')}] {v.get('title')} in {v.get('file')}:{v.get('line')} -> Fix: {v.get('fix')}")

    context_text = f"""### Knowledge Graph Context for {repo_name}:
#### Functional Nodes:
{chr(10).join(graph_summary_lines) if graph_summary_lines else "None"}

#### Functional Relationships:
{chr(10).join(edge_summary_lines) if edge_summary_lines else "None"}

#### Detected Security Vulnerabilities (by severity):
{chr(10).join(vuln_summary_lines) if vuln_summary_lines else "No high-severity vulnerabilities found."}
"""

    system_instruction = (
        f"You are the AegisGraph AI Codebase Intelligence Assistant powered by Google's Gemma 4. "
        f"You have been provided with the functional knowledge graph and security scan of '{repo_name}'. "
        f"Answer the user's question accurately, citing specific functional nodes, files, and line numbers where appropriate. "
        f"Be concise, technical, and grounded strictly in the provided context."
    )

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": f"{context_text}\n\nUser Question: {query}"}
    ]

    # Attempt to query local Gemma 4 via Ollama
    ollama_res = query_ollama_gemma(messages, model=model)

    if ollama_res["success"]:
        return {
            "answer": ollama_res["content"],
            "model_used": ollama_res["model"],
            "mode": "ollama_gemma4_live",
            "grounded_nodes": [n.get("name") for n in functional_nodes[:5]],
            "grounded_vulns": len(vulnerabilities)
        }

    # 2. Fallback: Synthesize grounded response directly from graph context if Ollama is not currently active
    q_lower = query.lower()
    answer_parts = []

    answer_parts.append(f"> ℹ️ *Local Gemma 4 status*: Local Ollama server is offline or `{model}` is not running. (To activate live Gemma 4 inference, run `ollama run {model}`). Here is the graph-grounded answer based on the repository analysis:\n")

    if any(k in q_lower for k in ("bug", "vuln", "vulnerabilit", "security", "threat", "severity", "critical", "risk")):
        answer_parts.append(f"### Security & Vulnerability Analysis for {repo_name}")
        if not vulnerabilities:
            answer_parts.append("✅ No critical or high-risk vulnerabilities were identified in the scanned source files.")
        else:
            answer_parts.append(f"Found **{len(vulnerabilities)} vulnerabilities** categorized by priority:\n")
            for v in vulnerabilities[:6]:
                badge = "🔴" if v["severity"] == "CRITICAL" else ("🟠" if v["severity"] == "HIGH" else "🟡")
                answer_parts.append(f"- {badge} **[{v['severity']}] {v['title']}**")
                answer_parts.append(f"  - **Location**: `{v['file']}:{v['line']}`")
                answer_parts.append(f"  - **Remediation**: {v['fix']}")

    elif any(k in q_lower for k in ("architecture", "function", "graph", "how", "overview", "component", "flow", "structure")):
        answer_parts.append(f"### Functional Architecture of {repo_name}")
        answer_parts.append(f"The repository is structured into **{len(functional_nodes)} core functional components**:\n")
        for n in functional_nodes:
            answer_parts.append(f"- **{n['name']}** ({n['category']}): {n['summary']}")
            for loc in n.get("locations", [])[:2]:
                answer_parts.append(f"  - Source: `{loc.get('file')}` (Lines {loc.get('start_line')}-{loc.get('end_line')})")

        if functional_edges:
            answer_parts.append("\n**Key Interactions:**")
            for e in functional_edges[:6]:
                answer_parts.append(f"- `{e['source']}` **{e['relationship']}** `{e['target']}`")

    else:
        answer_parts.append(f"### Repository Insights: {repo_name}")
        answer_parts.append(f"- **Functional Nodes Identified**: {len(functional_nodes)}")
        answer_parts.append(f"- **Detected Vulnerabilities**: {len(vulnerabilities)}")
        answer_parts.append("\n**Key Modules:**")
        for n in functional_nodes[:4]:
            answer_parts.append(f"- **{n['name']}**: {n['summary']}")

    return {
        "answer": "\n".join(answer_parts),
        "model_used": f"{model} (offline fallback)",
        "mode": "graph_grounded_fallback",
        "grounded_nodes": [n.get("name") for n in functional_nodes[:5]],
        "grounded_vulns": len(vulnerabilities)
    }
