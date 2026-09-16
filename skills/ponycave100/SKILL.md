---
name: ponycave100
description: >
  The three style rules this machine applies, and the control surface for their
  levels. Use when the user asks what the house style is, asks to change or turn
  off a style level, says "ponycave100", "house style", "caveman", "ponytail" or
  "STE", or asks why a hook injects style text into a session or a subagent.
  Also use when you must decide which style a surface takes: a chat reply, a
  file you write, or the code inside it.
license: MIT
---

# ponycave100

Three rules govern three surfaces. A reader must never blend them, because two
of them disagree on one point. ASD-STE100 needs the articles and a complete
sentence, and the terse prose rule drops both.

| Surface | Rule | Lifetime |
|---|---|---|
| A chat reply, and a subagent's report back | terse prose | the session |
| Every file the agent writes | ASD-STE100 | it outlives the session |
| The design decisions inside that file | the lazy ladder | the codebase |

**One genre leaves the artifact rule.** Marketing copy, a blog post and outreach
persuade a human reader, and ASD-STE100 does not govern them. The `no-ai-slop`
skill governs them, and this plugin ships it.

The two standards disagree, so never blend them either. ASD-STE100 asks for a
uniform sentence and no voice. `no-ai-slop` asks the writer to vary the cadence
and to keep the voice. The genre decides which one applies.

A short anti-slop rule reaches every artifact, because it contradicts neither
standard. Cut the empty word, name the source, and end on the last concrete
point.

## How the rules reach an agent

One hook carries all three: `hooks/ponycave100.js`. It answers three events.
`SessionStart` and `UserPromptSubmit` reach the main thread, and
`SubagentStart` reaches every agent that the Agent tool spawns.

A subagent inherits no context from its parent session, so a hook is the only
way a rule reaches it. A skill cannot do this, because the model invokes a
skill and nothing invokes one inside a fresh subagent.

## Levels

`~/.claude/.ponycave100.json` holds one level for each layer:

```json
{ "prose": "full", "code": "full" }
```

Each value is `off`, `lite`, `full` or `ultra`. A missing file means `full` for
both. **ASD-STE100 has no level.** A file is durable or it is not, so the
artifact rule is always on.

To change a level, edit that file. Write the value the user asked for, then
tell the user that the change reaches the next session, because a hook loads at
session start.

## What the hook does not send

An agent that writes no file needs no artifact rule and no code rule. `Explore`,
`Plan`, `cavecrew-investigator` and `cavecrew-reviewer` receive the prose rule
alone, because each one still reports back. An agent that already carries the
terse rule in its own definition receives no prose rule at all.

## It works beside the two plugins it draws from

The `caveman` plugin and the `ponytail` plugin are optional. This plugin needs
neither, and it carries a short form of each rule itself.

If you install one of them, **the hook yields rather than repeat a rule**. It
drops the matching section, so the agent reads one copy and never two.

To let this plugin serve all three layers for fewer tokens, set two variables in
`~/.claude/settings.json`:

```json
{ "env": { "CAVEMAN_DEFAULT_MODE": "off", "PONYTAIL_DEFAULT_MODE": "off" } }
```

Each plugin reads its environment variable before its config file, so each one
injects nothing and no plugin file changes. An upgrade of either plugin keeps
working, and the commands, the skills and the agents of both still work.

**Read the variable, never the flag file.** Both hooks fire on the same
`SessionStart` event, and a plugin deletes its own flag file there, so the two
hooks race. A hook that trusts the file reads a stale value and drops a rule for
the whole session.

## The cost

| Event | Three sources | One hook | Saved |
|---|---|---|---|
| `SessionStart` | ~2103 tokens | ~564 tokens | 73% |
| `SubagentStart`, each agent | ~1749 tokens | ~541 tokens | 69% |
| `UserPromptSubmit`, each turn | ~50 tokens | ~16 tokens | 68% |

The separate blocks each spent tokens on the boundary with the other two. One
router states that boundary once.
