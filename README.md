# ponycave100

One hook carries three style rules to every session and to every subagent:
terse prose, ASD-STE100 files, and lazy code.

## The problem it solves

Three separate sources used to inject three rulesets. Each one spent tokens to
explain its boundary with the other two, and one of them sent its full ruleset
into every subagent. A fan-out of twelve agents paid that twelve times.

This plugin states the boundary once, so it costs about 70 percent less.

| Event | Three sources | One hook | Saved |
|---|---|---|---|
| `SessionStart` | ~2103 tokens | ~564 tokens | 73% |
| `SubagentStart`, each agent | ~1749 tokens | ~541 tokens | 69% |
| `UserPromptSubmit`, each turn | ~50 tokens | ~16 tokens | 68% |

## Three surfaces, three rules

| Surface | Rule | Lifetime |
|---|---|---|
| A chat reply, and a subagent's report back | terse prose | the session |
| Every file the agent writes | ASD-STE100 | it outlives the session |
| The design decisions inside that file | the lazy ladder | the codebase |

The rules disagree on one point, so a reader must never blend them. ASD-STE100
needs the articles and a complete sentence, and the terse prose rule drops
both. The hook names the surface before each rule for that reason.

## Why it is a plugin and not a skill

A subagent inherits no context from its parent session. A skill cannot reach
one, because the model invokes a skill and nothing invokes one inside a fresh
subagent. Only a `SubagentStart` hook reaches it, and a plugin is the unit that
carries a hook.

## Install

```bash
claude plugin marketplace add strikeout/ponycave100
claude plugin install ponycave100@ponycave100 --scope user
```

A local directory works in place of the repository name.

**A hook loads at session start, so the plugin changes nothing in the session
that installs it.** Open a new session, and confirm there.

**`claude plugin install` reports the download, never the load.** Run
`claude plugin list` after it, and read the status line. A plugin that fails to
load still appears as enabled in `settings.json`.

## Verify

```bash
echo '{"hook_event_name":"SessionStart"}' \
  | CLAUDE_PLUGIN_ROOT=/path/to/ponycave100 \
    node /path/to/ponycave100/hooks/ponycave100.js
```

The command prints one JSON object. `additionalContext` holds the three rules.

## What it contains

| Path | What it is |
|---|---|
| `hooks/ponycave100.js` | the one hook, for three events |
| `hooks/hooks.json` | the event registration |
| `skills/ponycave100/` | the rules in full, and the level control |
| `skills/simplified-technical-english/` | the ASD-STE100 skill and its checker |

The checker needs `python3`. The hook needs `node`. Both ship with Claude Code
on a normal developer machine.

```bash
python3 skills/simplified-technical-english/check.py FILE
```

The checker reads a markdown file or a source file. From a source file it takes
the comments, the docstrings, the error strings and the log strings. It reports
the sentence length, the paragraph length, the passive voice, the gerund and the
fragment.

**The checker reports a false positive on some correct sentences.** It decides
its rules with regular expressions, and six gaps produce one:

- It misses an imperative verb outside its list.
- It reads `cannot` as no verb.
- It misses an irregular past tense such as "held".
- It misses a regular verb that ends in "-es", such as "accumulates".
- It reads a past continuous as a bare gerund.
- It anchors the imperative test to the start of the sentence, so "Then check
  the data." fails.

Keep the sentence and record the finding. Never damage a good sentence to clear
the checker.

## Levels

`~/.claude/.ponycave100.json` holds one level for each layer:

```json
{ "prose": "full", "code": "full" }
```

Each value is `off`, `lite`, `full` or `ultra`. A missing file means `full` for
both. ASD-STE100 has no level, because a file is durable or it is not.

## It works beside caveman and ponytail

Both plugins are optional, and this plugin needs neither. If you install one,
the hook drops the matching section rather than send a second copy.

To let this plugin serve all three layers for fewer tokens, add two variables to
`~/.claude/settings.json`:

```json
{ "env": { "CAVEMAN_DEFAULT_MODE": "off", "PONYTAIL_DEFAULT_MODE": "off" } }
```

Each plugin reads its variable before its config file, so each one injects
nothing. No plugin file changes, an upgrade keeps working, and the commands, the
skills and the agents of both plugins still work.

## Credit

The prose rule compresses the `caveman` plugin by Julius Brussee. The code rule
compresses the `ponytail` plugin by Dietrich Gebert. Both are MIT. See
`LICENSE`.
