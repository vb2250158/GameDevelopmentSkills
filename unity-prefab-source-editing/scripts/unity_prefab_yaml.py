#!/usr/bin/env python3
"""Inspect and narrowly edit Unity text-serialized YAML without launching Unity."""

from __future__ import annotations

import argparse
import collections.abc
import datetime as dt
import difflib
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterable

try:
    from unityparser import UnityDocument
except ImportError as exc:
    raise SystemExit(
        "unityparser is not installed in this Python environment. "
        "Run install-unity-yaml-parser.ps1 first."
    ) from exc

SUPPORTED_SUFFIXES = {".prefab", ".unity", ".asset", ".meta"}
STRUCTURAL_SEGMENTS = {
    "m_Component",
    "m_Children",
    "m_Father",
    "m_GameObject",
    "m_CorrespondingSourceObject",
    "m_PrefabInstance",
    "m_PrefabAsset",
    "m_SourcePrefab",
    "m_Modification",
    "m_Modifications",
    "m_RemovedComponents",
    "m_RemovedGameObjects",
    "m_AddedComponents",
    "m_AddedGameObjects",
    "fileID",
    "guid",
}
PATH_TOKEN = re.compile(r"(?:^|\.)([^.\[\]]+)|\[(\d+)\]")


def fail(message: str, code: int = 2) -> "NoReturn":
    print(message, file=sys.stderr)
    raise SystemExit(code)


def require_yaml_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    if not path.is_file():
        fail(f"File not found: {path}")
    if path.suffix.lower() not in SUPPORTED_SUFFIXES:
        fail(f"Unsupported file extension: {path.suffix}")
    with path.open("rb") as stream:
        if stream.read(5) != b"%YAML":
            fail(f"File is not a text-serialized Unity YAML file: {path}")
    return path


def load_document(path: Path) -> UnityDocument:
    try:
        return UnityDocument.load_yaml(str(path))
    except Exception as exc:
        fail(f"Failed to parse Unity YAML: {path}\n{type(exc).__name__}: {exc}")


def entry_by_anchor(document: UnityDocument, anchor: str) -> Any:
    matches = [entry for entry in document.entries if str(entry.anchor) == str(anchor)]
    if not matches:
        fail(f"No YAML document found for fileID/anchor {anchor}")
    if len(matches) > 1:
        fail(f"Duplicate YAML documents found for fileID/anchor {anchor}")
    return matches[0]


def parse_field_path(field_path: str) -> list[Any]:
    if not field_path or field_path.startswith(".") or field_path.endswith("."):
        fail(f"Invalid field path: {field_path!r}")
    tokens: list[Any] = []
    position = 0
    for match in PATH_TOKEN.finditer(field_path):
        if match.start() != position:
            fail(f"Invalid field path near: {field_path[position:]}")
        if match.group(1) is not None:
            tokens.append(match.group(1))
        else:
            tokens.append(int(match.group(2)))
        position = match.end()
    if position != len(field_path) or not tokens:
        fail(f"Invalid field path: {field_path!r}")
    return tokens


def read_member(container: Any, token: Any) -> Any:
    if isinstance(token, int):
        if not isinstance(container, list):
            fail(f"Expected list before index [{token}], got {type(container).__name__}")
        if token < 0 or token >= len(container):
            fail(f"List index out of range: [{token}]")
        return container[token]
    if isinstance(container, collections.abc.Mapping):
        if token not in container:
            fail(f"Field does not exist: {token}")
        return container[token]
    if not hasattr(container, token):
        fail(f"Field does not exist: {token}")
    return getattr(container, token)


def write_member(container: Any, token: Any, value: Any) -> None:
    if isinstance(token, int):
        if not isinstance(container, list):
            fail(f"Expected list before index [{token}], got {type(container).__name__}")
        if token < 0 or token >= len(container):
            fail(f"List index out of range: [{token}]")
        container[token] = value
        return
    if isinstance(container, collections.abc.MutableMapping):
        if token not in container:
            fail(f"Refusing to create missing field: {token}")
        container[token] = value
        return
    if not hasattr(container, token):
        fail(f"Refusing to create missing field: {token}")
    setattr(container, token, value)


def get_field(entry: Any, field_path: str) -> Any:
    value = entry
    for token in parse_field_path(field_path):
        value = read_member(value, token)
    return value


def set_field(entry: Any, field_path: str, value: Any) -> Any:
    tokens = parse_field_path(field_path)
    container = entry
    for token in tokens[:-1]:
        container = read_member(container, token)
    old_value = read_member(container, tokens[-1])
    write_member(container, tokens[-1], value)
    return old_value


def json_safe(value: Any) -> Any:
    if isinstance(value, collections.abc.Mapping):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if hasattr(value, "get_serialized_properties_dict"):
        return {
            "className": value.__class__.__name__,
            "anchor": str(value.anchor),
            "fields": json_safe(value.get_serialized_properties_dict()),
        }
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def print_json(payload: Any) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def dump_to_bytes(document: UnityDocument, source_path: Path) -> bytes:
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{source_path.name}.", suffix=".yaml.tmp", dir=str(source_path.parent)
    )
    os.close(fd)
    temp_path = Path(temp_name)
    try:
        document.dump_yaml(str(temp_path))
        return temp_path.read_bytes()
    finally:
        temp_path.unlink(missing_ok=True)


def unified_diff(path: Path, before: bytes, after: bytes) -> str:
    before_text = before.decode("utf-8", errors="surrogateescape").splitlines(keepends=True)
    after_text = after.decode("utf-8", errors="surrogateescape").splitlines(keepends=True)
    return "".join(
        difflib.unified_diff(
            before_text,
            after_text,
            fromfile=f"{path} (before)",
            tofile=f"{path} (after)",
        )
    )


def default_backup_dir() -> Path:
    return Path(tempfile.gettempdir()) / "unity-prefab-source-editing-backups"


def write_atomically(path: Path, before: bytes, after: bytes, backup_dir: Path | None) -> Path:
    if path.read_bytes() != before:
        fail(f"Source changed after it was read; refusing to overwrite: {path}")

    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    digest = hashlib.sha256(str(path).encode("utf-8")).hexdigest()[:12]
    root = (backup_dir or default_backup_dir()).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    backup_path = root / f"{path.name}.{digest}.{timestamp}.bak"
    shutil.copy2(path, backup_path)

    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".write.tmp", dir=str(path.parent))
    os.close(fd)
    temp_path = Path(temp_name)
    try:
        temp_path.write_bytes(after)
        shutil.copystat(path, temp_path)
        os.replace(temp_path, path)
    except Exception:
        temp_path.unlink(missing_ok=True)
        if path.exists() and path.read_bytes() != before:
            path.write_bytes(before)
        raise
    return backup_path


def iter_mappings(value: Any) -> Iterable[collections.abc.Mapping]:
    if isinstance(value, collections.abc.Mapping):
        yield value
        for child in value.values():
            yield from iter_mappings(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            yield from iter_mappings(child)
    elif hasattr(value, "get_serialized_properties_dict"):
        yield from iter_mappings(value.get_serialized_properties_dict())


def validate_document(path: Path, document: UnityDocument) -> dict[str, Any]:
    anchors = [str(entry.anchor) for entry in document.entries]
    anchor_set = set(anchors)
    duplicates = sorted({anchor for anchor in anchors if anchors.count(anchor) > 1})
    missing_local_refs: list[dict[str, str]] = []

    for entry in document.entries:
        for mapping in iter_mappings(entry):
            if "fileID" not in mapping:
                continue
            file_id = str(mapping.get("fileID"))
            guid = str(mapping.get("guid", "")).strip()
            if file_id in {"", "0", "None"} or guid:
                continue
            if file_id not in anchor_set:
                missing_local_refs.append(
                    {
                        "ownerAnchor": str(entry.anchor),
                        "ownerClass": entry.__class__.__name__,
                        "missingFileID": file_id,
                    }
                )

    return {
        "path": str(path),
        "entryCount": len(document.entries),
        "duplicateAnchors": duplicates,
        "missingLocalReferences": missing_local_refs,
        "valid": not duplicates,
    }


def command_roundtrip(args: argparse.Namespace) -> int:
    path = require_yaml_path(args.path)
    before = path.read_bytes()
    document = load_document(path)
    after = dump_to_bytes(document, path)
    diff = unified_diff(path, before, after)
    print_json(
        {
            "path": str(path),
            "entryCount": len(document.entries),
            "byteIdentical": before == after,
            "beforeSha256": hashlib.sha256(before).hexdigest(),
            "afterSha256": hashlib.sha256(after).hexdigest(),
        }
    )
    if diff:
        print(diff)
        return 3
    return 0


def command_inspect(args: argparse.Namespace) -> int:
    path = require_yaml_path(args.path)
    document = load_document(path)
    entries = document.entries
    if args.anchor:
        entries = [entry_by_anchor(document, args.anchor)]
    if args.class_name:
        entries = [entry for entry in entries if entry.__class__.__name__ == args.class_name]

    result = []
    for entry in entries:
        fields = sorted(entry.get_attrs())
        item: dict[str, Any] = {
            "anchor": str(entry.anchor),
            "className": entry.__class__.__name__,
            "fields": fields,
        }
        for name in ("m_Name", "m_GameObject", "m_Script"):
            if hasattr(entry, name):
                item[name] = json_safe(getattr(entry, name))
        if args.field:
            item["value"] = json_safe(get_field(entry, args.field))
        result.append(item)
    print_json({"path": str(path), "count": len(result), "entries": result})
    return 0


def command_get(args: argparse.Namespace) -> int:
    path = require_yaml_path(args.path)
    document = load_document(path)
    entry = entry_by_anchor(document, args.anchor)
    value = get_field(entry, args.field)
    print_json(
        {
            "path": str(path),
            "anchor": str(entry.anchor),
            "className": entry.__class__.__name__,
            "field": args.field,
            "value": json_safe(value),
        }
    )
    return 0


def command_set(args: argparse.Namespace) -> int:
    path = require_yaml_path(args.path)
    tokens = parse_field_path(args.field)
    structural = sorted({str(token) for token in tokens if str(token) in STRUCTURAL_SEGMENTS})
    if structural and not args.allow_structural:
        fail(
            "Structural/reference field edit requires --allow-structural: "
            + ", ".join(structural)
        )

    if args.value_json is not None:
        try:
            new_value = json.loads(args.value_json)
        except json.JSONDecodeError as exc:
            fail(f"Invalid --value-json: {exc}")
    elif args.value is not None:
        new_value = args.value
    else:
        fail("Pass exactly one of --value or --value-json")

    before = path.read_bytes()
    document = load_document(path)
    entry = entry_by_anchor(document, args.anchor)
    old_value = set_field(entry, args.field, new_value)
    after = dump_to_bytes(document, path)
    diff = unified_diff(path, before, after)

    print_json(
        {
            "path": str(path),
            "anchor": str(entry.anchor),
            "className": entry.__class__.__name__,
            "field": args.field,
            "oldValue": json_safe(old_value),
            "newValue": json_safe(new_value),
            "changed": before != after,
            "mode": "write" if args.write else "dry-run",
        }
    )
    if diff:
        print(diff)
    if before == after:
        return 0
    if not args.write:
        return 0
    if not args.ack_source_edit:
        fail("Writing requires --ack-source-edit")

    backup_path = write_atomically(
        path,
        before,
        after,
        Path(args.backup_dir) if args.backup_dir else None,
    )
    print_json(
        {
            "written": True,
            "path": str(path),
            "backupPath": str(backup_path),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    )
    return 0


def command_validate(args: argparse.Namespace) -> int:
    path = require_yaml_path(args.path)
    document = load_document(path)
    result = validate_document(path, document)
    result["strictLocalReferences"] = bool(args.strict_local_refs)
    if args.strict_local_refs and result["missingLocalReferences"]:
        result["valid"] = False
    print_json(result)
    return 0 if result["valid"] else 4


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Directly inspect and narrowly edit Unity YAML source files without Unity."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    roundtrip = subparsers.add_parser("roundtrip", help="Check byte-identical parse and dump")
    roundtrip.add_argument("path")
    roundtrip.set_defaults(handler=command_roundtrip)

    inspect_parser = subparsers.add_parser("inspect", help="List YAML documents and key fields")
    inspect_parser.add_argument("path")
    inspect_parser.add_argument("--anchor")
    inspect_parser.add_argument("--class-name")
    inspect_parser.add_argument("--field")
    inspect_parser.set_defaults(handler=command_inspect)

    get_parser = subparsers.add_parser("get", help="Read one existing field")
    get_parser.add_argument("path")
    get_parser.add_argument("--anchor", required=True)
    get_parser.add_argument("--field", required=True)
    get_parser.set_defaults(handler=command_get)

    set_parser = subparsers.add_parser("set", help="Preview or apply one existing field edit")
    set_parser.add_argument("path")
    set_parser.add_argument("--anchor", required=True)
    set_parser.add_argument("--field", required=True)
    values = set_parser.add_mutually_exclusive_group(required=True)
    values.add_argument("--value", help="Set a scalar string value")
    values.add_argument("--value-json", help="Set a JSON scalar, list, or mapping")
    set_parser.add_argument("--allow-structural", action="store_true")
    set_parser.add_argument("--write", action="store_true")
    set_parser.add_argument("--ack-source-edit", action="store_true")
    set_parser.add_argument("--backup-dir")
    set_parser.set_defaults(handler=command_set)

    validate = subparsers.add_parser("validate", help="Validate anchors and report local fileID references")
    validate.add_argument("path")
    validate.add_argument(
        "--strict-local-refs",
        action="store_true",
        help="Treat unresolved local fileID references as errors instead of warnings",
    )
    validate.set_defaults(handler=command_validate)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
