# AI code security review reference

Use this reference after the deterministic diff screen. The core question is not only “does the code work?” but “what can untrusted input influence, with which authority, and where can data leave?”

## Three independent gates

| Gate | Protects | Typical failure | Evidence required |
|---|---|---|---|
| Agent execution | workstation, credentials, tools, external systems | prompt injection steers file reads, commands, writes, or outbound calls | trust labels, least-privilege tools, approval boundary, audit receipt |
| Produced code | application and its users | insecure authorization, injection, unsafe parsing, path/command/network abuse | diff review, focused tests, SAST/SCA, semantic source-to-sink reasoning |
| Release | repository, package, deployment, public data | secrets/private data shipped; reviewed source differs from artifact | exact commit, clean re-scan, reproducible build, package-content and checksum evidence |

Passing one gate never substitutes for another.

## Risk surfaces

### Identity and authority

- Every state-changing endpoint authenticates the caller.
- Every object/action separately checks authorization and ownership.
- Security modes, allowlists, roles, and sandbox flags cannot be changed through a lower-trust API.
- Local/developer bypasses are unreachable in packaged or remote modes.

### Commands and tools

- Prefer argument arrays and direct process creation; avoid shells.
- If a shell is unavoidable, use a fixed executable and fixed command shape with validated values.
- Tool permissions are narrow, time-bounded, and scoped to the requested workspace/target.
- Untrusted text cannot select tools that read secrets, write files, publish, message, or control devices.

### Files and paths

- Reject absolute paths, parent traversal, alternate streams, device paths, and unsafe symlink/junction escapes where relevant.
- Resolve the final path and verify containment in an explicit allowed root.
- Treat archive extraction, upload names, log paths, cache paths, and configuration-selected directories as inputs.
- Use atomic writes for state and make destructive targets explicit.

### Network and SSRF

- Use an immutable provider allowlist owned by trusted configuration.
- Restrict schemes, hosts, ports, redirects, DNS/IP classes, response sizes, and timeouts.
- Never forward credentials to a destination selected by request data or mutable user configuration.
- Remote listeners require authentication, explicit opt-in, and a narrow bind address.

### Parsing, rendering, and queries

- Choose non-executable parsers and safe loader modes.
- Parameterize data values; allowlist identifiers that cannot be parameterized.
- Escape output for its exact context; avoid raw HTML sinks.
- Enforce resource limits for archives, regexes, parsers, uploads, and generated content.

### Secrets and privacy

- Keep secrets out of source, prompts, logs, URLs, errors, fixtures, screenshots, packages, and generated reports.
- Test data must be unmistakably fake.
- Redact by structure before logging; do not rely on later cleanup.
- Review package contents, not only tracked source.

### Dependencies, CI, and release

- Review manifest and lockfile changes together.
- Inspect install/build hooks before running them.
- Use dependency audit/SCA and secret scanning when available.
- CI jobs processing untrusted issues/PRs must not also hold write tokens or repository secrets.
- Release from the reviewed commit and verify hashes and privacy exclusions.

## Suggested evidence by risk

| Change | Minimum evidence |
|---|---|
| ordinary pure logic | focused tests + diff review |
| external input or parser | negative/limit tests + source-to-sink review |
| auth/authz or sensitive object access | caller/owner matrix tests + denial-path evidence |
| filesystem/process/network | boundary tests + platform-specific containment/argument evidence |
| Agent/MCP/automation tool | prompt-injection trust analysis + tool/secret/output separation |
| install/build/release | manifest/hook review + dependency/secret scan + exact artifact evidence |

## Finding format

```text
[Severity] Short title
Location: file:line
Boundary: untrusted source -> transformation/policy -> privileged sink
Impact: what an attacker or mistaken Agent could cause
Evidence: code path, test, or scanner result
Required action: smallest safe fix
Verification: command/test/review that proves closure
```

Do not include secret values, exploit payloads, private user data, or unsupported certainty.
