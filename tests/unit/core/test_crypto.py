"""Unit tests for argus.core.crypto."""

from __future__ import annotations

import base64
import os
from pathlib import Path

import pytest
from cryptography.fernet import Fernet, InvalidToken

from argus.core.crypto import (
    DocumentEncryptor,
    KeyManager,
    SecurePurger,
    get_encryptor,
    get_key_manager,
    init_crypto,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def master_key() -> str:
    return KeyManager.generate_key()


@pytest.fixture()
def key_manager(master_key: str) -> KeyManager:
    return KeyManager(master_key)


@pytest.fixture()
def encryptor(key_manager: KeyManager) -> DocumentEncryptor:
    return DocumentEncryptor(key_manager)


@pytest.fixture()
def purger(key_manager: KeyManager) -> SecurePurger:
    return SecurePurger(key_manager)


# ---------------------------------------------------------------------------
# 1. Key generation
# ---------------------------------------------------------------------------


def test_generate_key() -> None:
    """generate_key() produces a valid Fernet key."""
    key = KeyManager.generate_key()
    # Must not raise
    Fernet(key.encode())
    # Fernet keys are url-safe base64 of 32 bytes → 44 chars (with padding)
    raw = base64.urlsafe_b64decode(key.encode())
    assert len(raw) == 32


# ---------------------------------------------------------------------------
# 2–4. KeyManager initialisation
# ---------------------------------------------------------------------------


def test_key_manager_init_with_key(master_key: str) -> None:
    """KeyManager accepts a valid master key."""
    km = KeyManager(master_key)
    # Smoke: can derive without error
    km.get_fernet("test-investigation")


def test_key_manager_init_generates_key() -> None:
    """KeyManager generates a key and warns when none is provided."""
    km = KeyManager()  # None / no arg
    # Should still be fully functional
    km.get_fernet("test-investigation")


def test_key_manager_rejects_invalid_key() -> None:
    """KeyManager raises ValueError on a bogus master key."""
    with pytest.raises(ValueError, match="Invalid master key"):
        KeyManager("this-is-not-a-valid-fernet-key!!!")


# ---------------------------------------------------------------------------
# 5–6. Key derivation
# ---------------------------------------------------------------------------


def test_derive_investigation_key_deterministic(key_manager: KeyManager) -> None:
    """Same investigation_id always yields the same derived key."""
    k1 = key_manager.derive_investigation_key("inv-42")
    k2 = key_manager.derive_investigation_key("inv-42")
    assert k1 == k2


def test_derive_investigation_key_unique(key_manager: KeyManager) -> None:
    """Different investigation_ids yield different derived keys."""
    k1 = key_manager.derive_investigation_key("inv-a")
    k2 = key_manager.derive_investigation_key("inv-b")
    assert k1 != k2


# ---------------------------------------------------------------------------
# 7. Document round-trip
# ---------------------------------------------------------------------------


def test_encrypt_decrypt_document_roundtrip(
    encryptor: DocumentEncryptor, tmp_path: Path
) -> None:
    """encrypt_document → decrypt_document returns original bytes."""
    plaintext = b"Sensitive investigation data \xf0\x9f\x94\x8d"
    inv_id = "inv-roundtrip"
    doc_id = "abcdef1234567890"

    enc_path = encryptor.encrypt_document(plaintext, inv_id, doc_id, tmp_path)
    decrypted = encryptor.decrypt_document(enc_path, inv_id)

    assert decrypted == plaintext


# ---------------------------------------------------------------------------
# 8. Text round-trip
# ---------------------------------------------------------------------------


def test_encrypt_decrypt_text_roundtrip(encryptor: DocumentEncryptor) -> None:
    """encrypt_text → decrypt_text returns original string."""
    original = "Top secret note 🕵️"
    inv_id = "inv-text"

    cipher = encryptor.encrypt_text(original, inv_id)
    assert cipher != original  # must be different from plaintext
    assert encryptor.decrypt_text(cipher, inv_id) == original


# ---------------------------------------------------------------------------
# 9. Wrong investigation key
# ---------------------------------------------------------------------------


def test_decrypt_wrong_investigation_fails(
    encryptor: DocumentEncryptor, tmp_path: Path
) -> None:
    """Decrypting with a different investigation_id raises InvalidToken."""
    plaintext = b"classified"
    enc_path = encryptor.encrypt_document(plaintext, "inv-A", "doc001", tmp_path)

    with pytest.raises(InvalidToken):
        encryptor.decrypt_document(enc_path, "inv-B")


# ---------------------------------------------------------------------------
# 10. Encrypted file path & content
# ---------------------------------------------------------------------------


def test_encrypted_file_stored_correctly(
    encryptor: DocumentEncryptor, tmp_path: Path
) -> None:
    """File is at expected path and its content is not the plaintext."""
    plaintext = b"Recognisable plaintext pattern XYZ-12345"
    inv_id = "inv-store"
    doc_id = "ff99887766"

    enc_path = encryptor.encrypt_document(plaintext, inv_id, doc_id, tmp_path)

    expected = tmp_path / inv_id / doc_id[:2] / doc_id
    assert enc_path == expected
    assert enc_path.exists()

    stored = enc_path.read_bytes()
    assert stored != plaintext
    assert b"XYZ-12345" not in stored


# ---------------------------------------------------------------------------
# 11. Secure delete
# ---------------------------------------------------------------------------


def test_secure_delete_file(tmp_path: Path) -> None:
    """secure_delete_file overwrites and removes the file."""
    p = tmp_path / "secret.dat"
    p.write_bytes(b"A" * 1024)

    SecurePurger.secure_delete_file(p)

    assert not p.exists()


# ---------------------------------------------------------------------------
# 12. Purge investigation
# ---------------------------------------------------------------------------


def test_purge_investigation(
    encryptor: DocumentEncryptor,
    purger: SecurePurger,
    tmp_path: Path,
) -> None:
    """All investigation files deleted, directory removed, count returned."""
    inv_id = "inv-purge"
    for i in range(5):
        encryptor.encrypt_document(
            f"doc-{i}".encode(), inv_id, f"doc{i:04d}", tmp_path
        )

    count = purger.purge_investigation_files(inv_id, tmp_path)

    assert count == 5
    assert not (tmp_path / inv_id).exists()


# ---------------------------------------------------------------------------
# 13. Purge empty / nonexistent investigation
# ---------------------------------------------------------------------------


def test_purge_empty_investigation(purger: SecurePurger, tmp_path: Path) -> None:
    """Purging a nonexistent investigation returns 0 and does not error."""
    assert purger.purge_investigation_files("no-such-inv", tmp_path) == 0


# ---------------------------------------------------------------------------
# 14. Empty content
# ---------------------------------------------------------------------------


def test_encrypt_empty_content(encryptor: DocumentEncryptor, tmp_path: Path) -> None:
    """Empty bytes and empty string survive encrypt → decrypt."""
    inv_id = "inv-empty"

    # bytes
    enc_path = encryptor.encrypt_document(b"", inv_id, "empty-doc", tmp_path)
    assert encryptor.decrypt_document(enc_path, inv_id) == b""

    # text
    cipher = encryptor.encrypt_text("", inv_id)
    assert encryptor.decrypt_text(cipher, inv_id) == ""


# ---------------------------------------------------------------------------
# 15. Large document round-trip
# ---------------------------------------------------------------------------


def test_large_document_roundtrip(
    encryptor: DocumentEncryptor, tmp_path: Path
) -> None:
    """10 MB of random data survives encrypt → decrypt."""
    plaintext = os.urandom(10 * 1024 * 1024)  # 10 MB
    inv_id = "inv-large"
    doc_id = "bigfile0001"

    enc_path = encryptor.encrypt_document(plaintext, inv_id, doc_id, tmp_path)
    assert encryptor.decrypt_document(enc_path, inv_id) == plaintext
