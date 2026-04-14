"""Quick e2e smoke test for new features."""
import asyncio
import os
import tempfile

os.environ["WS_USER_DATA_DIR"] = tempfile.mkdtemp()
os.environ["WS_SECRET_MY_KEY"] = "shh-secret-123"

from app.config import Settings  # noqa: E402
import app.config as c  # noqa: E402
c.settings = Settings()

from app.db.engine import init_db  # noqa: E402
from app.models.workflows import WorkflowDefinition  # noqa: E402
from app.models.steps import StepInstance  # noqa: E402
from app.engine.executor import WorkflowExecutor  # noqa: E402
from app.db.repository import run_repository  # noqa: E402
from app.services.junit_export import run_to_junit_xml  # noqa: E402
from app.services.run_diff import diff_runs  # noqa: E402
from app.secrets import resolve_secrets  # noqa: E402


async def noop(m):
    pass


async def main():
    await init_db()
    print("1. DB init OK")

    wf = WorkflowDefinition(
        id="w1", name="Test WF",
        steps=[
            StepInstance(id="s1", type="assert_equals", label="always passes",
                         params={"actual": 1, "expected": 1}),
            StepInstance(id="s2", type="assert_equals", label="always fails",
                         params={"actual": 1, "expected": 99},
                         continue_on_error=True),
        ],
    )

    # Run 1
    ex = WorkflowExecutor(wf, {}, noop)
    r1 = await ex.run()
    print(f"2. Run status={r1.status.value}")
    for sr in r1.step_results:
        print(f"   {sr.label}: status={sr.status.value} test={sr.test_status.value} attempts={sr.attempts}")
    print(f"   summary={r1.summary}")

    # Save + fetch
    await run_repository.save_run(r1)
    fetched = await run_repository.get_run(r1.id)
    assert fetched is not None, "DB fetch failed"
    print(f"3. DB round-trip OK, test_status={fetched.step_results[0].test_status.value}")

    # JUnit XML
    xml = run_to_junit_xml(fetched)
    assert "<?xml" in xml
    assert "failure" in xml.lower()
    print(f"4. JUnit XML OK ({len(xml)} bytes)")

    # Run 2 (same wf, for diff)
    ex2 = WorkflowExecutor(wf, {}, noop)
    r2 = await ex2.run()
    await run_repository.save_run(r2)
    diff = diff_runs(r1, r2)
    print(f"5. Diff OK, steps_with_diffs={diff['summary']['steps_with_diffs']}")

    # Secret resolution
    resolved = resolve_secrets({"key": "${{ secrets.MY_KEY }}", "plain": "hello"})
    assert resolved["key"] == "shh-secret-123"
    assert resolved["plain"] == "hello"
    print(f"6. Secrets OK: {resolved}")

    print("\nALL E2E TESTS PASSED")


asyncio.run(main())
