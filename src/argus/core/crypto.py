"""ARGUS encryption and key management.

Provides Fernet-based symmetric encryption scoped per investigation,
deterministic key derivation via HKDF, and secure file purging.
"""

from __future__ import annotations

import base64
import logging
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Key management
# ---------------------------------------------------------------------------


class KeyManager:
    """Manages encryption keys for investigations."""

    def __init__(self, master_key: str | None = None) -> None:
        """Initialise with a master key.

        If *master_key* is empty or ``None``, a new ephemeral key is generated
        and a warning is logged.  The master key must be a valid Fernet key
        (URL-safe base64-encoded 32-byte value).
        """
        if not master_key:
            master_key = self.generate_key()
            logger.warning(
                "Generated ephemeral master key — set ARGUS_MASTER_KEY for persistence"
            )

        # Validate the key by attempting to create a Fernet instance.
        try:
            Fernet(master_key.encode() if isinstance(master_key, str) else master_key)
        except Exception as exc:
            raise ValueError(f"Invalid master key: {exc}") from exc

        self._master_key: str = master_key

    # -- key helpers --------------------------------------------------------

    @staticmethod
    def generate_key() -> str:
        """Generate a new Fernet key."""
        return Fernet.generate_key().decode()

    def derive_investigation_key(self, investigation_id: str) -> bytes:
        """Derive a deterministic Fernet-compatible key for *investigation_id*.

        Uses HKDF-SHA256 with the master key bytes as input key material and
        the investigation id as the *info* parameter.
        """
        master_bytes = base64.urlsafe_b64decode(self._master_key.encode())
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=investigation_id.encode(),
        )
        derived = hkdf.derive(master_bytes)
        return base64.urlsafe_b64encode(derived)

    def get_fernet(self, investigation_id: str) -> Fernet:
        """Return a :class:`~cryptography.fernet.Fernet` for *investigation_id*."""
        key = self.derive_investigation_key(investigation_id)
        return Fernet(key)


# ---------------------------------------------------------------------------
# Document encryption
# ---------------------------------------------------------------------------


class DocumentEncryptor:
    """Encrypts and decrypts document content for secure storage."""

    def __init__(self, key_manager: KeyManager) -> None:
        self.key_manager = key_manager

    # -- file-level ---------------------------------------------------------

    def encrypt_document(
        self,
        content: bytes,
        investigation_id: str,
        document_id: str,
        base_dir: Path,
    ) -> Path:
        """Encrypt *content* and persist it to disk.

        The file is stored at ``base_dir / investigation_id / doc_id[:2] / doc_id``.
        Intermediate directories are created as needed.

        Returns the path to the encrypted file.
        """
        fernet = self.key_manager.get_fernet(investigation_id)
        encrypted = fernet.encrypt(content)

        dest = base_dir / investigation_id / document_id[:2] / document_id
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(encrypted)
        return dest

    def decrypt_document(
        self,
        encrypted_path: Path,
        investigation_id: str,
    ) -> bytes:
        """Decrypt a stored document.

        Raises :class:`~cryptography.fernet.InvalidToken` on key mismatch or
        data corruption.
        """
        fernet = self.key_manager.get_fernet(investigation_id)
        return fernet.decrypt(encrypted_path.read_bytes())

    # -- text convenience ---------------------------------------------------

    def encrypt_text(self, text: str, investigation_id: str) -> str:
        """Encrypt a text string, returning base64-encoded ciphertext."""
        fernet = self.key_manager.get_fernet(investigation_id)
        return fernet.encrypt(text.encode("utf-8")).decode("utf-8")

    def decrypt_text(self, encrypted_text: str, investigation_id: str) -> str:
        """Decrypt base64-encoded ciphertext back to a string."""
        fernet = self.key_manager.get_fernet(investigation_id)
        return fernet.decrypt(encrypted_text.encode("utf-8")).decode("utf-8")


# ---------------------------------------------------------------------------
# Secure deletion
# ---------------------------------------------------------------------------


class SecurePurger:
    """Securely delete investigation data."""

    def __init__(self, key_manager: KeyManager) -> None:
        self.key_manager = key_manager

    def purge_investigation_files(
        self, investigation_id: str, base_dir: Path
    ) -> int:
        """Securely delete all encrypted files for *investigation_id*.

        Each file is overwritten with random bytes before removal.  The
        investigation directory is then removed.

        Returns the number of files purged.
        """
        inv_dir = base_dir / investigation_id
        if not inv_dir.exists():
            return 0

        count = 0
        for file_path in inv_dir.rglob("*"):
            if file_path.is_file():
                self.secure_delete_file(file_path)
                count += 1

        # Remove empty directories bottom-up.
        for dir_path in sorted(inv_dir.rglob("*"), reverse=True):
            if dir_path.is_dir():
                try:
                    dir_path.rmdir()
                except OSError:
                    pass
        try:
            inv_dir.rmdir()
        except OSError:
            pass

        return count

    @staticmethod
    def secure_delete_file(file_path: Path) -> None:
        """Overwrite *file_path* with random data and then delete it."""
        size = file_path.stat().st_size
        with open(file_path, "r+b") as fh:
            fh.write(os.urandom(size))
            fh.flush()
            os.fsync(fh.fileno())
        os.unlink(file_path)


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_key_manager: KeyManager | None = None
_document_encryptor: DocumentEncryptor | None = None


def init_crypto(master_key: str = "") -> None:
    """Initialise the crypto subsystem.  Call once at startup."""
    global _key_manager, _document_encryptor  # noqa: PLW0603
    _key_manager = KeyManager(master_key or None)
    _document_encryptor = DocumentEncryptor(_key_manager)


def get_key_manager() -> KeyManager:
    """Return the singleton :class:`KeyManager`."""
    if _key_manager is None:
        raise RuntimeError("Crypto subsystem not initialised — call init_crypto() first")
    return _key_manager


def get_encryptor() -> DocumentEncryptor:
    """Return the singleton :class:`DocumentEncryptor`."""
    if _document_encryptor is None:
        raise RuntimeError("Crypto subsystem not initialised — call init_crypto() first")
    return _document_encryptor
