"""
Local Git Repository Analyzer, Functional Knowledge Graph Generator,
and Severity-Ranked Vulnerability Scanner for AegisGraph AI MVP.
"""

from __future__ import annotations

import ast
import hashlib
import io
import os
import re
import stat
import time
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class FunctionalNode:
    id: str
    name: str              # Concise phrase, e.g. "User Form UI", "Auth Controller"
    category: str          # "UI", "API / Routing", "Authentication", "Storage / DB", "Service", "Utility"
    summary: str           # 1-sentence high-level summary
    locations: List[Dict[str, Any]]  # List of {"file": path, "start_line": int, "end_line": int}


@dataclass
class FunctionalEdge:
    source: str
    target: str
    relationship: str      # "TRIGGERS", "CALLS", "QUERIES", "PROTECTED_BY", "RENDERS", "IMPORTS"


@dataclass
class VulnerabilityFinding:
    id: str
    severity: str          # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    title: str
    file: str
    line: int
    code_snippet: str
    description: str
    fix: str


SECRET_PATTERNS = [
    (re.compile(r"""(?i)(?:api_key|apikey|secret|token|password|passwd|auth_token)\s*[:=]\s*["']([A-Za-z0-9_\-]{16,})["']"""), "Hardcoded Secret / API Token"),
    (re.compile(r"""(?i)-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"""), "Hardcoded Private Key"),
    (re.compile(r"""(?i)(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}"""), "GitHub Personal Access Token"),
    (re.compile(r"""(?i)ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"""), "Hardcoded JWT Token"),
    (re.compile(r"""(?i)postgres(?:ql)?://[a-zA-Z0-9_\-]+:[^@\s]+@[a-zA-Z0-9_\.\-]+/\S+"""), "Database Connection String with Credentials"),
]


def check_git_folder(directory_path: str | Path) -> bool:
    """Verifies that the target directory is an initialized git repository."""
    p = Path(directory_path).resolve()
    if not p.exists() or not p.is_dir():
        return False
    git_dir = p / ".git"
    return git_dir.exists()


def check_git_in_zip(zip_data: bytes) -> bool:
    """Checks if uploaded zip contains a .git folder or .git file."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            for name in zf.namelist():
                parts = Path(name).parts
                if ".git" in parts:
                    return True
    except Exception:
        pass
    return False


def scan_local_directory(directory_path: str | Path, max_files: int = 1500) -> Dict[str, str]:
    """Reads all supported code files from a local git repository."""
    root = Path(directory_path).resolve()
    if not check_git_folder(root):
        raise ValueError("not a git repo")

    ignore_dirs = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__", ".next", ".nuxt", "target", "vendor"}
    allowed_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".sql", ".json", ".yaml", ".yml", ".md"}

    files: Dict[str, str] = {}
    for base, dirs, filenames in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in allowed_exts:
                continue
            full_path = Path(base) / fname
            try:
                rel_path = full_path.relative_to(root).as_posix()
            except ValueError:
                rel_path = fname

            if full_path.stat().st_size > 500_000:  # Skip files > 500 KB
                continue

            try:
                content = full_path.read_text(encoding="utf-8", errors="replace")
                files[rel_path] = content
                if len(files) >= max_files:
                    break
            except Exception:
                continue
        if len(files) >= max_files:
            break

    if not files:
        raise ValueError("No readable source files found in repository")
    return files


def scan_zip_archive(zip_data: bytes, max_files: int = 1500) -> Dict[str, str]:
    """Reads code files from a ZIP archive, verifying .git presence."""
    if not check_git_in_zip(zip_data):
        raise ValueError("not a git repo")

    ignore_dirs = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__", ".next", ".nuxt", "target", "vendor"}
    allowed_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".sql", ".json", ".yaml", ".yml", ".md"}

    files: Dict[str, str] = {}
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        entries = zf.infolist()
        roots = {item.filename.split('/')[0] for item in entries if '/' in item.filename}
        strip_root = len(roots) == 1 and all('/' in item.filename for item in entries if not item.is_dir())

        for item in entries:
            if item.is_dir() or item.file_size > 500_000:
                continue
            path_parts = PurePosixPath(item.filename).parts
            if strip_root and len(path_parts) > 1:
                clean_path = "/".join(path_parts[1:])
            else:
                clean_path = "/".join(path_parts)

            parts_set = set(path_parts)
            if parts_set & ignore_dirs:
                continue

            ext = PurePosixPath(clean_path).suffix.lower()
            if ext not in allowed_exts:
                continue

            try:
                content = zf.read(item).decode("utf-8", errors="replace")
                files[clean_path] = content
                if len(files) >= max_files:
                    break
            except Exception:
                continue

    if not files:
        raise ValueError("No readable source files found in repository")
    return files


def detect_vulnerabilities(files: Dict[str, str]) -> List[VulnerabilityFinding]:
    """
    Scans code files for security vulnerabilities AND general code bugs.
    Returns findings sorted by severity: CRITICAL > HIGH > MEDIUM > LOW.

    Detection coverage:
      Python  — SyntaxError, eval/exec, shell injection, pickle, TLS bypass,
                mutable defaults, bare except, silent swallow, is-literal comparison,
                == None, builtin shadowing, unreachable code, empty function body,
                assert-as-validation, global mutation, division by zero,
                infinite loops, Python-2 print, TODO/FIXME markers.
      JS/TS   — eval, dangerouslySetInnerHTML, innerHTML, document.write,
                setTimeout(string), HTTP URLs, console.log, TODO markers.
      All     — hardcoded secrets / credentials / keys.
    """
    findings: List[VulnerabilityFinding] = []

    def add(severity: str, title: str, file: str, line: int, code: str, desc: str, fix: str):
        ident = hashlib.sha256(f"{file}:{line}:{title}".encode()).hexdigest()[:16]
        # Deduplicate: same file+line+title is always the same finding
        for f in findings:
            if f.id == ident:
                return
        findings.append(VulnerabilityFinding(
            id=ident, severity=severity, title=title, file=file, line=line,
            code_snippet=code.strip()[:180], description=desc, fix=fix,
        ))

    SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

    BUILTIN_NAMES = {
        "list", "dict", "set", "tuple", "str", "int", "float", "bool", "type",
        "len", "range", "print", "input", "open", "map", "filter", "zip",
        "sum", "min", "max", "abs", "round", "sorted", "reversed", "enumerate",
        "id", "hash", "repr", "format", "bytes", "object", "super", "property",
    }

    for path, source in files.items():
        src_lines = source.splitlines()

        def L(n):
            """Return source line n (1-indexed), or empty string."""
            return src_lines[n - 1] if 0 < n <= len(src_lines) else ""

        # ── 1. Secret / Credential Leak Detection (every file type) ──────────
        for ln, lt in enumerate(src_lines, 1):
            for pat, label in SECRET_PATTERNS:
                if pat.search(lt) and not any(
                    kw in lt.lower()
                    for kw in ("example", "dummy", "test", "fake", "placeholder", "your_", "<", ">")
                ):
                    add("HIGH", f"Exposed Secret: {label}", path, ln, lt,
                        "Hardcoded credentials found in source. Anyone with repo access gains immediate account access.",
                        "Move secrets to environment variables (.env) and add .env to .gitignore.")

        # ── 2. Python Analysis ───────────────────────────────────────────────
        if path.endswith(".py"):

            # 2a. Syntax-error check (was previously silently skipped!)
            try:
                tree = ast.parse(source)
            except SyntaxError as syn:
                err_ln = syn.lineno or 1
                snippet = L(err_ln) or (source[:120])
                add("CRITICAL", f"Python Syntax Error: {syn.msg}", path, err_ln, snippet,
                    f"Python cannot parse this file — it crashes on import. "
                    f"Error: '{syn.msg}' near '{(syn.text or '').strip()}'.",
                    "Fix the syntax error. Common causes: missing ':' after def/if/for/class, "
                    "unmatched brackets or quotes, two identifiers next to each other (e.g. 'Hello World' "
                    "is invalid — Python identifiers cannot contain spaces).")
                continue  # nothing more to do for an unparseable file
            except Exception as exc:
                add("HIGH", "Unparseable Python File", path, 1, source[:80],
                    f"AST parsing failed: {exc}", "Check encoding and ensure valid Python 3 syntax.")
                continue

            # 2b. AST walk ─────────────────────────────────────────────────
            for node in ast.walk(tree):

                # SECURITY ─ function calls ─────────────────────────────────
                if isinstance(node, ast.Call):
                    fn = ""
                    if isinstance(node.func, ast.Name):
                        fn = node.func.id
                    elif isinstance(node.func, ast.Attribute):
                        fn = node.func.attr
                    ln = getattr(node, "lineno", 1)
                    lt = L(ln)

                    if fn in {"eval", "exec"}:
                        add("CRITICAL", "Arbitrary Code Execution via eval/exec", path, ln, lt,
                            "eval()/exec() run arbitrary strings as Python — RCE if input is user-controlled.",
                            "Use json.loads() or ast.literal_eval() for safe data parsing.")

                    if fn == "loads" and "pickle" in lt:
                        add("HIGH", "Insecure Deserialization (pickle.loads)", path, ln, lt,
                            "Unpickling untrusted data can execute arbitrary code.",
                            "Use JSON, MessagePack, or Protocol Buffers instead.")

                    if fn in {"system", "popen"} and "os" in lt:
                        add("CRITICAL", "OS Command Injection (os.system/popen)", path, ln, lt,
                            "Shell commands with user-controlled input enable command injection.",
                            "Use subprocess.run(['cmd', arg], shell=False).")

                    if fn in {"run", "Popen", "call", "check_output"}:
                        for kw in node.keywords:
                            if kw.arg == "shell" and getattr(kw.value, "value", None) is True:
                                add("CRITICAL", "Shell Injection via subprocess(shell=True)", path, ln, lt,
                                    "shell=True passes the command to the OS shell enabling metacharacter injection.",
                                    "Use a list of arguments and shell=False.")

                    if fn in {"get", "post", "put", "delete", "request", "urlopen"}:
                        for kw in node.keywords:
                            if kw.arg == "verify" and getattr(kw.value, "value", None) is False:
                                add("HIGH", "TLS Certificate Verification Disabled", path, ln, lt,
                                    "verify=False disables SSL certificate checking, enabling MITM attacks.",
                                    "Remove verify=False and use a valid CA bundle.")

                    if fn in {"load", "loads"} and "yaml" in lt and "safe_load" not in lt:
                        add("HIGH", "Unsafe YAML Deserialization (yaml.load)", path, ln, lt,
                            "yaml.load() can deserialise arbitrary Python objects from untrusted input.",
                            "Use yaml.safe_load() instead.")

                # BUG ─ function definitions ────────────────────────────────
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    ln = node.lineno
                    lt = L(ln)

                    # Mutable default argument
                    for default in node.args.defaults + node.args.kw_defaults:
                        if default is not None and isinstance(default, (ast.List, ast.Dict, ast.Set)):
                            add("MEDIUM", "Mutable Default Argument", path, ln, lt,
                                f"'{node.name}' uses a mutable list/dict/set as a default — "
                                "it is shared across all calls so mutations persist between invocations.",
                                "Set default to None and create the mutable object inside the function body.")

                    # Empty function (only pass / docstring)
                    real_stmts = [
                        s for s in node.body
                        if not isinstance(s, ast.Pass) and not (
                            isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant)
                        )
                    ]
                    if not real_stmts:
                        add("LOW", f"Empty Function Body: '{node.name}'", path, ln, lt,
                            f"'{node.name}' contains only pass or a docstring — no implementation.",
                            "Implement the body or use 'raise NotImplementedError()' as a named stub.")

                    # Unreachable code after return / raise
                    for i, stmt in enumerate(node.body[:-1]):
                        if isinstance(stmt, (ast.Return, ast.Raise)):
                            next_s = node.body[i + 1]
                            if not isinstance(next_s, (ast.Return, ast.Raise, ast.Pass)):
                                dead_ln = getattr(next_s, "lineno", ln + 1)
                                add("MEDIUM", "Unreachable Code After return/raise", path, dead_ln, L(dead_ln),
                                    "Statements after an unconditional return/raise can never execute — likely a logic bug.",
                                    "Remove the dead code or restructure the control flow.")
                            break

                # BUG ─ exception handling ──────────────────────────────────
                if isinstance(node, ast.ExceptHandler):
                    ln = node.lineno
                    lt = L(ln)
                    if node.type is None:
                        add("MEDIUM", "Bare except: Catches All Exceptions", path, ln, lt,
                            "Bare 'except:' swallows SystemExit and KeyboardInterrupt, masking bugs and blocking shutdown.",
                            "Catch specific exceptions: 'except (ValueError, KeyError) as e:'.")
                    if node.type is not None and all(isinstance(s, ast.Pass) for s in node.body):
                        add("MEDIUM", "Silent Exception Swallowing (except: pass)", path, ln, lt,
                            "Exception is caught and silently discarded — errors are hidden, debugging becomes very hard.",
                            "At minimum log: 'except Exception as e: logger.warning(\"Error\", exc_info=e)'.")

                # BUG ─ comparisons ─────────────────────────────────────────
                if isinstance(node, ast.Compare):
                    ln = node.lineno
                    lt = L(ln)
                    for op, comp in zip(node.ops, node.comparators):
                        if isinstance(op, (ast.Is, ast.IsNot)) and isinstance(comp, ast.Constant):
                            if not (comp.value is None or isinstance(comp.value, bool)):
                                add("MEDIUM", f"Identity Check with Literal (is {comp.value!r})", path, ln, lt,
                                    "Using 'is' with non-None/bool literals tests object identity, not value equality. "
                                    "Works by accident for small ints, fails silently for others.",
                                    "Use '==' for value equality. Keep 'is' only for None checks.")
                        if isinstance(op, ast.Eq) and isinstance(comp, ast.Constant) and comp.value is None:
                            add("LOW", "Use 'is None' Instead of '== None'", path, ln, lt,
                                "Comparing to None with '==' can be overridden by __eq__. PEP 8 requires 'is None'.",
                                "Replace '== None' with 'is None'.")

                # BUG ─ global variable mutation ────────────────────────────
                if isinstance(node, ast.Global):
                    ln = node.lineno
                    add("LOW", f"Global State Mutation: {', '.join(node.names)}", path, ln, L(ln),
                        "'global' mutates module-level state from inside a function, creating hidden coupling "
                        "and potential race conditions in threaded code.",
                        "Pass the value as a parameter and return the new value instead.")

                # BUG ─ shadowing builtins ──────────────────────────────────
                if isinstance(node, ast.Assign):
                    ln = node.lineno
                    lt = L(ln)
                    for target in node.targets:
                        if isinstance(target, ast.Name) and target.id in BUILTIN_NAMES:
                            add("MEDIUM", f"Built-in Shadowed: '{target.id}'", path, ln, lt,
                                f"Assigning to '{target.id}' overwrites Python's built-in of the same name in this scope. "
                                "Code that later calls the real built-in will get this variable instead.",
                                f"Rename the variable to avoid collision with built-in '{target.id}'.")

                # BUG ─ assert for validation ───────────────────────────────
                if isinstance(node, ast.Assert):
                    ln = node.lineno
                    add("LOW", "assert Used for Runtime Validation", path, ln, L(ln),
                        "assert is disabled when running Python with -O (optimise). "
                        "Using assert for input validation or security checks is unreliable.",
                        "Use 'if not condition: raise ValueError(...)' for explicit validation.")

            # 2c. Line-level heuristics ─────────────────────────────────────
            for ln, lt in enumerate(src_lines, 1):
                stripped = lt.strip()

                # Division by literal zero
                if re.search(r"[/\%]\s*0(?!\d)", stripped) and not stripped.startswith("#"):
                    add("CRITICAL", "Division by Zero", path, ln, lt,
                        "Dividing by the literal 0 always raises ZeroDivisionError at runtime.",
                        "Guard: 'if divisor != 0: result = x / divisor'.")

                # Infinite loop without break
                if re.match(r"^while\s+(True|1)\s*:", stripped):
                    block = src_lines[ln: ln + 20]
                    if not any(
                        re.search(r"\b(break|return|raise|sys\.exit)\b", bl) for bl in block
                    ):
                        add("HIGH", "Potential Infinite Loop (while True without exit)", path, ln, lt,
                            "while True loop with no break/return/raise visible in the next 20 lines.",
                            "Ensure the loop has a reachable exit condition.")

                # Python 2 print statement
                if re.match(r"^print\s+[^\(]", stripped) and not stripped.startswith("#"):
                    add("MEDIUM", "Python 2-style print Statement", path, ln, lt,
                        "'print x' is a SyntaxError in Python 3 — print is a function.",
                        "Add parentheses: 'print(x)'.")

                # TODO / FIXME / HACK markers
                m = re.search(r"\b(TODO|FIXME|HACK|BUG|XXX)\b", lt, re.IGNORECASE)
                if m and stripped.startswith("#"):
                    add("LOW", f"Unresolved Code Marker: {m.group(1).upper()}", path, ln, lt,
                        f"Developer left a '{m.group(1).upper()}' comment indicating incomplete or broken code.",
                        "Resolve the issue before shipping to production.")

        # ── 3. JavaScript / TypeScript / HTML ───────────────────────────────
        elif path.endswith((".js", ".jsx", ".ts", ".tsx", ".html")):
            for ln, lt in enumerate(src_lines, 1):
                stripped = lt.strip()

                if "dangerouslySetInnerHTML" in lt:
                    add("CRITICAL", "XSS via dangerouslySetInnerHTML", path, ln, lt,
                        "Bypasses React's XSS protection — attackers can inject executable scripts.",
                        "Sanitize with DOMPurify.sanitize(), or use standard React text interpolation.")

                if re.search(r"\binnerHTML\s*=", lt, re.IGNORECASE):
                    add("HIGH", "Direct innerHTML Assignment", path, ln, lt,
                        "Unsanitized innerHTML assignment is a classic DOM-based XSS vector.",
                        "Use textContent for plain text, or DOMPurify for HTML.")

                if re.search(r"\beval\s*\(", lt):
                    add("CRITICAL", "JavaScript eval() — Dynamic Code Execution", path, ln, lt,
                        "eval() runs arbitrary strings as JavaScript code.",
                        "Use JSON.parse() for data. Never pass user input to eval().")

                if re.search(r"document\.write\s*\(", lt):
                    add("HIGH", "document.write() Usage", path, ln, lt,
                        "document.write() is deprecated, blocks rendering, and can enable XSS.",
                        "Use DOM methods (createElement, appendChild, textContent) instead.")

                if re.search(r"\bsetTimeout\s*\(\s*['\"]", lt) or re.search(r"\bsetInterval\s*\(\s*['\"]", lt):
                    add("HIGH", "String Passed to setTimeout/setInterval", path, ln, lt,
                        "Passing a string evaluates it like eval() — code injection risk.",
                        "Pass a function reference: setTimeout(() => fn(), delay).")

                if re.search(r"\bconsole\.(log|debug|info)\s*\(", lt) and not stripped.startswith("//"):
                    add("LOW", "console.log in Production Code", path, ln, lt,
                        "Console logging can leak sensitive data and pollutes browser logs in production.",
                        "Remove or gate behind a debug flag / logging library.")

                if re.search(r"http://", lt) and "localhost" not in lt and not stripped.startswith("//"):
                    add("MEDIUM", "Insecure HTTP URL (should be HTTPS)", path, ln, lt,
                        "Plain HTTP exposes data to interception and MITM attacks.",
                        "Use HTTPS for all external resource URLs.")

                m = re.search(r"\b(TODO|FIXME|HACK|BUG)\b", lt, re.IGNORECASE)
                if m and stripped.startswith("//"):
                    add("LOW", f"Unresolved Code Marker: {m.group(1).upper()}", path, ln, lt,
                        "Incomplete or problematic code marked by developer.",
                        "Resolve before shipping.")

    findings.sort(key=lambda f: (SEV_ORDER.get(f.severity, 99), f.file, f.line))
    return findings

def build_functional_graph(files: Dict[str, str]) -> Tuple[List[FunctionalNode], List[FunctionalEdge]]:
    """
    Synthesizes source code files into a clean, minimal functional knowledge graph.
    Combines distributed components (e.g. form UI, auth handler, database client, routing)
    into high-level conceptual nodes with exact line range citations.
    """
    nodes: Dict[str, FunctionalNode] = {}
    edges: List[FunctionalEdge] = []

    def get_or_create(node_id: str, name: str, category: str, summary: str) -> FunctionalNode:
        if node_id not in nodes:
            nodes[node_id] = FunctionalNode(
                id=node_id,
                name=name,
                category=category,
                summary=summary,
                locations=[]
            )
        return nodes[node_id]

    # Category trackers
    ui_files = []
    api_routes = []
    auth_locations = []
    storage_locations = []
    service_locations = []
    config_locations = []

    for path, content in files.items():
        parts = PurePosixPath(path).parts
        name_lower = PurePosixPath(path).name.lower()
        lines = content.splitlines()
        line_count = len(lines)

        # 1. UI & Frontend Functionality (Buttons, Forms, Components)
        if path.endswith((".jsx", ".tsx", ".html", ".vue")) or (path.endswith(".js") and any(p in parts for p in ("components", "views", "pages", "frontend", "ui"))):
            has_form = bool(re.search(r"<form\b|Form\b|\binput\b|\bbutton\b", content, re.IGNORECASE))
            has_nav = bool(re.search(r"<nav\b|navbar|sidebar|header", content, re.IGNORECASE))
            has_graph = bool(re.search(r"canvas|svg|d3|graph|chart", content, re.IGNORECASE))

            if has_form:
                node = get_or_create("fn-form-ui", "Form & Input UI", "UI", "Interactive user forms, submit actions, and button handlers.")
                node.locations.append({"file": path, "start_line": 1, "end_line": line_count})
            elif has_graph:
                node = get_or_create("fn-graph-canvas", "Visualization Canvas", "UI", "Visual graph renderer, nodes, canvas/SVG rendering engine.")
                node.locations.append({"file": path, "start_line": 1, "end_line": line_count})
            elif has_nav:
                node = get_or_create("fn-navigation-ui", "Layout & Navigation", "UI", "Application shell, navigation bar, and panel routing.")
                node.locations.append({"file": path, "start_line": 1, "end_line": line_count})
            else:
                ui_files.append((path, line_count))

        # 2. Authentication & Security Middleware
        if any(term in name_lower or term in path.lower() for term in ("auth", "jwt", "login", "session", "security", "token", "permission")):
            node = get_or_create("fn-auth", "Auth & Access Control", "Authentication", "User authentication, JWT verification, and permission enforcement.")
            node.locations.append({"file": path, "start_line": 1, "end_line": line_count})
            auth_locations.append(path)

        # 3. Database & Storage Models
        if any(term in parts or term in name_lower for term in ("storage", "db", "database", "models", "schema", "sqlite", "postgres", "sql")):
            node = get_or_create("fn-database", "Database & Persistence", "Storage / DB", "Persistent data models, SQL schemas, and repository layer.")
            node.locations.append({"file": path, "start_line": 1, "end_line": line_count})
            storage_locations.append(path)

        # 4. API Endpoints & Routes (FastAPI, Express, Flask)
        if path.endswith(".py"):
            try:
                tree = ast.parse(content)
                for item in ast.walk(tree):
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        for dec in item.decorator_list:
                            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                                if dec.func.attr in {"get", "post", "put", "delete", "patch", "route"}:
                                    route_path = dec.args[0].value if (dec.args and isinstance(dec.args[0], ast.Constant)) else "/"
                                    api_routes.append((path, item.lineno, getattr(item, "end_lineno", item.lineno), dec.func.attr.upper(), str(route_path)))
            except Exception:
                pass
        elif path.endswith((".js", ".ts")):
            for idx, line in enumerate(lines, 1):
                if re.search(r"\b(?:app|router)\.(?:get|post|put|delete|use)\s*\(", line):
                    api_routes.append((path, idx, idx + 10, "HTTP", "Route declaration"))

        # 5. Core Business Services
        if "services" in parts or "service" in name_lower or "engine" in name_lower:
            node = get_or_create("fn-business-logic", "Core Business Services", "Service", "Workflow orchestration, domain business logic, and computations.")
            node.locations.append({"file": path, "start_line": 1, "end_line": line_count})
            service_locations.append(path)

    # Consolidate API routes node
    if api_routes:
        node = get_or_create("fn-api-gateway", "API Gateway & Endpoints", "API / Routing", f"HTTP REST API endpoints handling incoming web requests ({len(api_routes)} routes).")
        for route_info in api_routes[:20]:
            node.locations.append({"file": route_info[0], "start_line": route_info[1], "end_line": route_info[2]})

    # Consolidate generic UI components if not empty
    if ui_files:
        node = get_or_create("fn-ui-views", "Component Presentation UI", "UI", "Front-end interactive views, cards, and modal components.")
        for p, count in ui_files[:10]:
            node.locations.append({"file": p, "start_line": 1, "end_line": count})

    # Ensure minimal nodes exist for any repo
    if not nodes:
        # Fallback to general modules
        for path, content in list(files.items())[:6]:
            stem = PurePosixPath(path).stem.replace("_", " ").title()
            node_id = f"fn-{PurePosixPath(path).stem}"
            get_or_create(node_id, stem, "Module", f"Implementation module for {stem}.").locations.append({
                "file": path, "start_line": 1, "end_line": len(content.splitlines())
            })

    # Generate clean, minimal relationships between functional nodes
    node_keys = list(nodes.keys())
    if "fn-form-ui" in node_keys and "fn-api-gateway" in node_keys:
        edges.append(FunctionalEdge("fn-form-ui", "fn-api-gateway", "SUBMITS_TO"))
    if "fn-ui-views" in node_keys and "fn-api-gateway" in node_keys:
        edges.append(FunctionalEdge("fn-ui-views", "fn-api-gateway", "CALLS"))
    if "fn-api-gateway" in node_keys and "fn-auth" in node_keys:
        edges.append(FunctionalEdge("fn-api-gateway", "fn-auth", "PROTECTED_BY"))
    if "fn-api-gateway" in node_keys and "fn-business-logic" in node_keys:
        edges.append(FunctionalEdge("fn-api-gateway", "fn-business-logic", "DISPATCHES"))
    if "fn-business-logic" in node_keys and "fn-database" in node_keys:
        edges.append(FunctionalEdge("fn-business-logic", "fn-database", "QUERIES"))
    elif "fn-api-gateway" in node_keys and "fn-database" in node_keys:
        edges.append(FunctionalEdge("fn-api-gateway", "fn-database", "QUERIES"))
    if "fn-graph-canvas" in node_keys and "fn-api-gateway" in node_keys:
        edges.append(FunctionalEdge("fn-graph-canvas", "fn-api-gateway", "FETCHES_GRAPH"))

    # Connect isolated nodes linearly if no edge formed
    connected = {e.source for e in edges} | {e.target for e in edges}
    remaining = [k for k in node_keys if k not in connected]
    for i in range(len(remaining) - 1):
        edges.append(FunctionalEdge(remaining[i], remaining[i + 1], "CONNECTS_TO"))
    if remaining and node_keys and remaining[0] != node_keys[0] and remaining[0] not in connected:
        edges.append(FunctionalEdge(node_keys[0], remaining[0], "USES"))

    return list(nodes.values()), edges

