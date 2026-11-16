# Security

This is an early preview. Use synthetic documents for evaluation until the compatibility and security contract has been validated for your application.

Document input, clipboard HTML, URLs, sidecars and native messages are untrusted. The editor sanitizes supported HTML, validates URL schemes and gates native operations. No arbitrary script/native command execution, default telemetry or hosted document store is part of the library.

Remote image previews are disabled by default. Host callbacks own storage credentials, authorization, asset resolution and publication policy. Temporary delivery URLs belong to view state; persist durable asset identity and source-bound metadata instead. A client editor does not replace server publication sanitization or ownership checks.

Native adapters load bundled assets, validate the expected main-frame origin and restrict navigation. Keep the engine version, bridge protocol and resource manifest together. Use protected runtime configuration for backend credentials; never embed storage keys or signing secrets in browser/native bundles.

To report a vulnerability, use GitHub private vulnerability reporting when enabled on the repository. Avoid posting an exploit containing private documents or credentials in a public issue. If private reporting is unavailable, open a minimal issue requesting a private channel without sensitive details.
