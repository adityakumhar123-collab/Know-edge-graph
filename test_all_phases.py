"""
Master Test Runner for AegisGraph AI.
Runs the complete unified test suite across all subsystems:
- Storage, Local SQLite Durability & Lifecycle
- Chunking, Ingestion Pipeline & Prompt Armor
- Topic Clustering, Hybrid RRF Retrieval & Contradictions
- Attack Path Traversal, LangGraph Investigation & MCP Tools
- FastApi Endpoints, RBAC, Security & Acceptance Gates
"""

import os
import sys
import subprocess
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PHASE4_DIR = os.path.join(ROOT_DIR, "Phase4")
VENV_PYTHON = os.path.join(PHASE4_DIR, ".venv", "Scripts", "python.exe")

if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable


def run_suite(title: str, cmd: list, cwd: str) -> bool:
    print(f"\n{'='*70}")
    print(f" RUNNING: {title}")
    print(f" Command: {' '.join(cmd)}")
    print(f" Working Directory: {cwd}")
    print(f"{'='*70}\n")
    start = time.time()
    res = subprocess.run(cmd, cwd=cwd)
    duration = time.time() - start
    status = "PASSED" if res.returncode == 0 else "FAILED"
    print(f"\n>>> [{status}] {title} in {duration:.2f}s\n")
    return res.returncode == 0


def main():
    print(f"==================================================================")
    print(f" AegisGraph AI — Unified Acceptance Test Suite")
    print(f" Python Interpreter: {VENV_PYTHON}")
    print(f"==================================================================")

    passed = run_suite(
        "AegisGraph AI: All E2E, Security, Storage, Ingestion, MCP & API Tests",
        [VENV_PYTHON, "-m", "pytest", "tests", "-v"],
        cwd=PHASE4_DIR,
    )

    print(f"\n{'='*70}")
    print(f" UNIFIED TEST SCORECARD")
    print(f"{'='*70}")
    status = "PASSED" if passed else "FAILED"
    print(f" - {'AegisGraph AI Full Test Suite (131 Tests)':<50} [{status}]")
    print(f"{'='*70}")

    if passed:
        print(" SUCCESS: All acceptance gates and tests verified passing!")
        sys.exit(0)
    else:
        print(" FAILURE: One or more tests failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
