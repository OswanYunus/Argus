"""Unit tests for DomainIntelligenceEngine."""

from unittest.mock import MagicMock, patch
import pytest

from argus.engines.domain_intel import DomainIntelligenceEngine


class MockAData:
    def to_text(self):
        return "192.0.2.1"


class MockMXData:
    def __init__(self, exchange, preference):
        self.exchange = exchange
        self.preference = preference


class MockNSData:
    def __init__(self, target):
        self.target = target


class MockTXTData:
    def __init__(self, strings):
        self.strings = strings


@pytest.mark.asyncio
async def test_domain_intelligence_resolvable():
    engine = DomainIntelligenceEngine()

    def mock_resolve(qname, rdtype):
        if rdtype == "A":
            return [MockAData()]
        elif rdtype == "MX":
            return [MockMXData("mail.example.com.", 10)]
        elif rdtype == "NS":
            return [MockNSData("ns1.example.com.")]
        elif rdtype == "TXT" and "_dmarc" in str(qname):
            return [MockTXTData([b"v=DMARC1; p=reject"])]
        elif rdtype == "TXT":
            return [MockTXTData([b"v=spf1 include:_spf.example.com ~all"])]
        raise Exception("NXDOMAIN")

    with patch.object(engine.resolver, "resolve", side_effect=mock_resolve):
        report = await engine.analyze_domain("https://example.com/some/path")

    assert report.domain == "example.com"
    assert report.is_resolvable is True
    assert "192.0.2.1" in report.ip_addresses
    assert any("mail.example.com" in mx for mx in report.mail_servers)
    assert "ns1.example.com" in report.nameservers
    assert report.spf_record == "v=spf1 include:_spf.example.com ~all"
    assert report.dmarc_record == "v=DMARC1; p=reject"


@pytest.mark.asyncio
async def test_domain_intelligence_unresolvable():
    engine = DomainIntelligenceEngine()

    with patch.object(engine.resolver, "resolve", side_effect=Exception("NXDOMAIN")):
        report = await engine.analyze_domain("invalid-nonexistent-domain-xyz999.com")

    assert report.is_resolvable is False
    assert len(report.ip_addresses) == 0
    assert len(report.mail_servers) == 0
