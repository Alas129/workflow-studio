"""Convert RunRecord into JUnit XML for CI integration."""
from __future__ import annotations

from xml.sax.saxutils import escape, quoteattr

from app.models.runs import RunRecord, StepRunStatus, TestStatus


def _cdata(text: str) -> str:
    # Escape CDATA end sequence
    return text.replace("]]>", "]]]]><![CDATA[>")


def run_to_junit_xml(record: RunRecord) -> str:
    """Each step_result becomes a <testcase>. Assertion steps surface pass/fail.

    Non-assertion steps that succeeded are treated as passing test cases; failed
    non-assertion steps show up as <error> (execution error, not a test failure).
    """
    total = len(record.step_results)
    failures = sum(
        1 for r in record.step_results
        if r.test_status == TestStatus.FAIL
        or (r.status == StepRunStatus.FAILED and r.test_status == TestStatus.NA and _looks_like_assertion(r.step_type))
    )
    errors = sum(
        1 for r in record.step_results
        if r.status == StepRunStatus.FAILED and r.test_status != TestStatus.FAIL
        and not _looks_like_assertion(r.step_type)
    )
    skipped = sum(1 for r in record.step_results if r.status == StepRunStatus.SKIPPED)
    duration_s = (record.duration_ms or 0) / 1000

    lines: list[str] = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(
        f'<testsuites name={quoteattr(record.workflow_name)} tests="{total}" '
        f'failures="{failures}" errors="{errors}" skipped="{skipped}" '
        f'time="{duration_s:.3f}">'
    )
    lines.append(
        f'  <testsuite name={quoteattr(record.workflow_name)} '
        f'tests="{total}" failures="{failures}" errors="{errors}" '
        f'skipped="{skipped}" time="{duration_s:.3f}" '
        f'timestamp={quoteattr(record.started_at.isoformat())}>'
    )

    for sr in record.step_results:
        classname = record.workflow_name
        test_name = sr.label
        if sr.matrix_key:
            test_name += f"[{sr.matrix_key}]"
        dur = (sr.duration_ms or 0) / 1000

        lines.append(
            f'    <testcase classname={quoteattr(classname)} '
            f'name={quoteattr(test_name)} time="{dur:.3f}">'
        )

        if sr.status == StepRunStatus.SKIPPED:
            lines.append('      <skipped/>')
        elif sr.test_status == TestStatus.FAIL or (
            sr.status == StepRunStatus.FAILED and _looks_like_assertion(sr.step_type)
        ):
            msg = escape(sr.error or "assertion failed")
            lines.append(f'      <failure message={quoteattr(sr.error or "assertion failed")}>')
            lines.append(f'        <![CDATA[{_cdata(sr.error or "")}]]>')
            lines.append('      </failure>')
        elif sr.status == StepRunStatus.FAILED:
            lines.append(f'      <error message={quoteattr(sr.error or "execution error")}>')
            lines.append(f'        <![CDATA[{_cdata(sr.error or "")}]]>')
            lines.append('      </error>')

        lines.append('    </testcase>')

    lines.append('  </testsuite>')
    lines.append('</testsuites>')
    return "\n".join(lines)


def _looks_like_assertion(step_type: str) -> bool:
    return step_type.startswith("assert_") or step_type == "snapshot"
