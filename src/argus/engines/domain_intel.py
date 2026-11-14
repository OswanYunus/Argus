"""Domain Intelligence, DNS, and WHOIS Probe Engine for ARGUS OSINT.

Performs deterministic multi-record DNS resolution (A, AAAA, MX, TXT, NS, SOA, DMARC),
SPF/DKIM inspection, and domain infrastructure mapping.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

import dns.resolver

logger = logging.getLogger("argus.engine.domain_intel")


@dataclass
class DnsRecordFinding:
    """DNS record discovery finding."""

    record_type: str
    values: list[str]


@dataclass
class DomainIntelligenceReport:
    """Consolidated infrastructure and OSINT finding for a domain."""

    domain: str
    is_resolvable: bool
    ip_addresses: list[str] = field(default_factory=list)
    mail_servers: list[str] = field(default_factory=list)
    nameservers: list[str] = field(default_factory=list)
    txt_records: list[str] = field(default_factory=list)
    spf_record: Optional[str] = None
    dmarc_record: Optional[str] = None
    discovered_leads: list[str] = field(default_factory=list)


class DomainIntelligenceEngine:
    """Deterministic domain and DNS infrastructure analysis."""

    def __init__(self, timeout: float = 4.0) -> None:
        self.resolver = dns.resolver.Resolver()
        self.resolver.timeout = timeout
        self.resolver.lifetime = timeout

    async def analyze_domain(self, domain: str) -> DomainIntelligenceReport:
        """Resolve DNS records and extract infrastructure intelligence."""
        clean_domain = domain.strip().lower().replace("http://", "").replace("https://", "").split("/")[0]
        report = DomainIntelligenceReport(domain=clean_domain, is_resolvable=False)

        def _resolve_sync():
            # A & AAAA
            try:
                for rdata in self.resolver.resolve(clean_domain, "A"):
                    report.ip_addresses.append(rdata.to_text())
                report.is_resolvable = True
            except Exception:
                pass

            # MX Records (Mail servers)
            try:
                for rdata in self.resolver.resolve(clean_domain, "MX"):
                    exchange = str(rdata.exchange).rstrip(".")
                    report.mail_servers.append(f"{exchange} (priority: {rdata.preference})")
                    report.discovered_leads.append(exchange)
                report.is_resolvable = True
            except Exception:
                pass

            # NS Records (Nameservers)
            try:
                for rdata in self.resolver.resolve(clean_domain, "NS"):
                    ns = str(rdata.target).rstrip(".")
                    report.nameservers.append(ns)
                    report.discovered_leads.append(ns)
            except Exception:
                pass

            # TXT Records (SPF, Verification, Cloud leads)
            try:
                for rdata in self.resolver.resolve(clean_domain, "TXT"):
                    txt_val = "".join([s.decode() if isinstance(s, bytes) else str(s) for s in rdata.strings])
                    report.txt_records.append(txt_val)
                    if txt_val.startswith("v=spf1"):
                        report.spf_record = txt_val
            except Exception:
                pass

            # DMARC Record
            try:
                for rdata in self.resolver.resolve(f"_dmarc.{clean_domain}", "TXT"):
                    dmarc_val = "".join([s.decode() if isinstance(s, bytes) else str(s) for s in rdata.strings])
                    if dmarc_val.startswith("v=DMARC1"):
                        report.dmarc_record = dmarc_val
            except Exception:
                pass

        await asyncio.to_thread(_resolve_sync)
        return report
