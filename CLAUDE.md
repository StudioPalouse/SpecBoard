# Project instructions for Claude

## Building philosophy

- **Tracer bullets.** When building a feature, first build the smallest possible
  end-to-end slice that runs through every layer of the system (UI, API, data,
  and any integration it touches), even if each layer is thin or stubbed. Get it
  working and visible, seek feedback, then expand outward from that proven path.
  The goal is the fastest possible feedback: a thin slice that actually runs
  surfaces architectural problems and wrong assumptions early, while they are
  cheap to fix, and confirms the overall shape is sound before we invest in
  breadth or polish. Prefer a working narrow slice over a complete-but-untested
  layer. (From The Pragmatic Programmer.)

## Writing style

- **Never use em dashes (`—`).** This applies everywhere: code comments, docs,
  Markdown, UI copy, commit messages, and PR descriptions. Rewrite the sentence
  instead, using a comma, colon, parentheses, or a hyphen (`-`) as appropriate.
  En dashes (`–`) are also out for prose; use a hyphen.
