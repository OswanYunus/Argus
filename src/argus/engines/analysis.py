"""Intelligence Analysis Engine for ARGUS OSINT Intelligence Platform.

Performs structured LLM-driven intelligence extraction: separates observed facts
from inferences, enforces verbatim source citations, identifies contradictions,
and assigns evidence-based confidence levels.
"""

from __future__ import annotations

import logging
from typing import Optional
from pydantic import BaseModel, Field

from argus.core.db import Database, FindingRepository, ResourceUsageRepository
from argus.core.models import (
    CollectedDocument,
    Finding,
    FindingSource,
    FindingType,
    Investigation,
    ResourceType,
    ResourceUsage,
    TemporalPrecision,
)
from argus.integration.llm.base import LLMClientProtocol, LLMResponse

logger = logging.getLogger("argus.engine.analysis")


class ExtractedFindingItem(BaseModel):
    """Schema for a single finding returned by LLM extraction."""

    finding_type: str = Field(description="'fact', 'inference', 'contradiction', 'uncertainty', or 'timeline_event'")
    category: str = Field(description="Domain e.g. 'professional', 'education', 'technical', 'social', 'contact'")
    summary: str = Field(description="Concise description of the finding")
    detail: Optional[str] = Field(default=None, description="In-depth factual context or explanation")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence level between 0.0 and 1.0")
    confidence_explanation: str = Field(description="Why this confidence level was assigned")
    exact_quote_excerpt: str = Field(description="Exact verbatim excerpt from the document proving this finding")
    page_or_section: Optional[str] = Field(default=None, description="Section heading or page number")
    temporal_date: Optional[str] = Field(default=None, description="Associated date in ISO format YYYY-MM-DD if applicable")
    temporal_precision: Optional[str] = Field(default=None, description="'exact', 'month', 'year', 'decade', or 'approximate'")


class DocumentAnalysisOutput(BaseModel):
    """Schema for complete structured extraction from an OSINT document."""

    findings: list[ExtractedFindingItem] = Field(default_factory=list)
    identified_contradictions: list[str] = Field(default_factory=list)


class AnalysisEngine:
    """Extracts, categorizes, and validates factual findings using LLM intelligence."""

    def __init__(
        self,
        db: Database,
        llm_client: LLMClientProtocol,
    ) -> None:
        self.db = db
        self.llm_client = llm_client
        self.finding_repo = FindingRepository(db)
        self.resource_repo = ResourceUsageRepository(db)

    async def analyze_document(
        self,
        investigation: Investigation,
        document: CollectedDocument,
        source_url: str,
        document_text: str,
        run_id: Optional[str] = None,
    ) -> list[Finding]:
        """
        Analyze extracted document text with the LLM and record structured findings and source citations.
        """
        if not document_text or len(document_text.strip()) < 50:
            logger.info("Skipping analysis on document %s: insufficient text", document.id)
            return []

        # System prompt enforcing strict evidence extraction rules
        system_prompt = (
            "You are a senior intelligence analyst conducting an authorized digital-footprint investigation. "
            f"The primary target is: '{investigation.target_name}'. "
            "Known target signals: " + str(investigation.target_signals) + "\n\n"
            "CRITICAL RULES:\n"
            "1. Strictly separate OBSERVED FACTS from INFERRED RELATIONSHIPS. If a statement is explicitly written, mark as 'fact'. "
            "If it is a hypothesis or derived conclusion, mark as 'inference'.\n"
            "2. REQUIRE SOURCE CITATIONS: Every factual finding MUST include an exact verbatim quote from the text.\n"
            "3. Contradictions: If the document contradicts typical assumptions or states conflicting information, mark as 'contradiction'.\n"
            "4. NEVER invent or hallucinate information. If the document does not relate to the target, return an empty findings list.\n"
            "5. Assign confidence scores objectively with clear justifications."
        )

        user_prompt = (
            f"Document Source URL: {source_url}\n\n"
            f"--- DOCUMENT TEXT ---\n"
            f"{document_text[:12000]}\n"
            f"--- END DOCUMENT TEXT ---\n\n"
            "Analyze the above document and extract all factual findings relating to the target."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            parsed_output, llm_resp = await self.llm_client.extract_structured(
                messages=messages,
                response_model=DocumentAnalysisOutput,
                temperature=0.0,
            )

            # Record LLM resource consumption
            await self.resource_repo.record(
                ResourceUsage.create(
                    investigation_id=investigation.id,
                    run_id=run_id,
                    resource_type=ResourceType.LLM_CALL,
                    amount=1.0,
                    unit="calls",
                    context={"model": llm_resp.model, "document_id": document.id},
                )
            )
            await self.resource_repo.record(
                ResourceUsage.create(
                    investigation_id=investigation.id,
                    run_id=run_id,
                    resource_type=ResourceType.LLM_TOKEN_INPUT,
                    amount=float(llm_resp.prompt_tokens),
                    unit="tokens",
                )
            )
            await self.resource_repo.record(
                ResourceUsage.create(
                    investigation_id=investigation.id,
                    run_id=run_id,
                    resource_type=ResourceType.LLM_TOKEN_OUTPUT,
                    amount=float(llm_resp.completion_tokens),
                    unit="tokens",
                )
            )

        except Exception as exc:
            logger.error("Analysis failed for document %s: %s", document.id, exc)
            return []

        saved_findings: list[Finding] = []

        # Map enum values safely
        valid_types = {t.value: t for t in FindingType}
        valid_precisions = {p.value: p for p in TemporalPrecision}

        for item in parsed_output.findings:
            f_type = valid_types.get(item.finding_type.lower(), FindingType.FACT)
            t_precision = valid_precisions.get((item.temporal_precision or "").lower())

            finding = Finding.create(
                investigation_id=investigation.id,
                finding_type=f_type,
                category=item.category,
                summary=item.summary,
                detail=item.detail,
                confidence=item.confidence,
                confidence_explanation=item.confidence_explanation,
                temporal_precision=t_precision,
                is_new=True,
            )
            await self.finding_repo.create(finding)

            # Attach verifiable source citation
            source_citation = FindingSource.create(
                finding_id=finding.id,
                document_id=document.id,
                url=source_url,
                excerpt=item.exact_quote_excerpt,
                page_or_section=item.page_or_section,
            )
            await self.finding_repo.add_source(source_citation)

            saved_findings.append(finding)

        logger.info(
            "Analysis complete for document %s: saved %d findings with source citations",
            document.id,
            len(saved_findings),
        )
        return saved_findings
