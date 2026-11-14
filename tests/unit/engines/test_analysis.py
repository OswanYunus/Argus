"""Unit tests for the Intelligence Analysis Engine and LLM integration."""

from __future__ import annotations

import json
from typing import Type, TypeVar
import pytest
from pydantic import BaseModel

from argus.core.db import (
    Database,
    DocumentRepository,
    FindingRepository,
    InvestigationRepository,
    ResourceUsageRepository,
    UrlRepository,
)
from argus.core.models import (
    CollectedDocument,
    DiscoveredUrl,
    FindingType,
    Investigation,
    SourceType,
)
from argus.engines.analysis import (
    AnalysisEngine,
    DocumentAnalysisOutput,
    ExtractedFindingItem,
)
from argus.integration.llm.base import LLMClientProtocol, LLMResponse

T = TypeVar("T", bound=BaseModel)


class MockLLMClient(LLMClientProtocol):
    """Deterministic mock LLM for testing analysis extraction."""

    def __init__(self, output: DocumentAnalysisOutput) -> None:
        self.output = output

    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        return LLMResponse(
            content=self.output.model_dump_json(),
            prompt_tokens=150,
            completion_tokens=80,
            total_tokens=230,
            model="mock-intelligence-llm",
            elapsed_ms=45.0,
        )

    async def extract_structured(
        self,
        messages: list[dict[str, str]],
        response_model: Type[T],
        temperature: float = 0.0,
        max_tokens: int = 2048,
    ) -> tuple[T, LLMResponse]:
        resp = await self.complete(messages, temperature, max_tokens)
        parsed = response_model.model_validate(self.output.model_dump())
        return parsed, resp


@pytest.fixture
async def test_db():
    db = Database(":memory:", wal_mode=False)
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


@pytest.mark.asyncio
async def test_analyze_document_extracts_findings_and_citations(test_db: Database):
    """Verify structured finding persistence, verbatim citations, and resource accounting."""
    inv_repo = InvestigationRepository(test_db)
    url_repo = UrlRepository(test_db)
    doc_repo = DocumentRepository(test_db)
    finding_repo = FindingRepository(test_db)
    res_repo = ResourceUsageRepository(test_db)

    inv = Investigation.create(name="Analysis Test", target_name="Sarah Connor")
    await inv_repo.create(inv)

    url_rec = DiscoveredUrl.create(
        investigation_id=inv.id,
        url="https://cyberdyne.example/team",
        source_type=SourceType.SEARCH_RESULT,
    )
    await url_repo.create(url_rec)

    doc = CollectedDocument.create(
        investigation_id=inv.id,
        url_id=url_rec.id,
        content_hash="hash_analysis",
        robots_compliant=True,
    )
    await doc_repo.create(doc)

    mock_findings = DocumentAnalysisOutput(
        findings=[
            ExtractedFindingItem(
                finding_type="fact",
                category="professional",
                summary="Lead Systems Architect at Cyberdyne",
                detail="Appointed in March 2022 to head defensive intelligence systems.",
                confidence=0.95,
                confidence_explanation="Directly quoted from official leadership roster.",
                exact_quote_excerpt="Sarah Connor joined as Lead Systems Architect in March 2022.",
                page_or_section="Leadership Team",
                temporal_date="2022-03-01",
                temporal_precision="month",
            ),
            ExtractedFindingItem(
                finding_type="inference",
                category="technical",
                summary="Specializes in neural network security",
                detail="Inferred from authored whitepapers on model vulnerability.",
                confidence=0.75,
                confidence_explanation="Based on publication topics rather than direct job description.",
                exact_quote_excerpt="Published two papers on neural network robustness.",
                page_or_section="Publications",
                temporal_precision="approximate",
            ),
        ]
    )

    llm = MockLLMClient(mock_findings)
    engine = AnalysisEngine(db=test_db, llm_client=llm)

    sample_text = (
        "Leadership Team: Sarah Connor joined as Lead Systems Architect in March 2022. "
        "Publications: Published two papers on neural network robustness."
    )

    findings = await engine.analyze_document(
        investigation=inv,
        document=doc,
        source_url=url_rec.url,
        document_text=sample_text,
    )

    assert len(findings) == 2

    # Check finding types separated
    types = [f.finding_type for f in findings]
    assert FindingType.FACT in types
    assert FindingType.INFERENCE in types

    # Check verbatim source citations saved
    fact_finding = next(f for f in findings if f.finding_type == FindingType.FACT)
    sources = await finding_repo.get_sources(fact_finding.id)
    assert len(sources) == 1
    assert "Sarah Connor joined as Lead Systems Architect" in sources[0].excerpt
    assert sources[0].url == "https://cyberdyne.example/team"

    # Check token resource usage recorded
    usage = await res_repo.get_summary_by_investigation(inv.id)
    assert usage.get("llm_call") == 1.0
    assert usage.get("llm_token_input") == 150.0
    assert usage.get("llm_token_output") == 80.0
