# ponycave100

**One hook makes your agent write terse in chat and rigorous in files, and it
carries that split into every subagent.**

An agent has one voice. It gives you a six-paragraph chat reply, and then it
writes a commit message that says `fix: resolve issue`. You want the opposite: a
reply that you can scan in three seconds, and a file that a stranger can still
read in six months.

Those two goals contradict each other, so one style cannot serve both. This
plugin carries both, names the surface before each rule, and reaches the
subagents that a skill and a `CLAUDE.md` never reach.

### In a chat reply

```text
before   Great question! I've gone ahead and installed the plugin for you.
         Unfortunately, it looks like there may have been an issue with the
         installation. When I ran `claude plugin list`, I noticed that the
         plugin is showing a "failed to load" status. This appears to be
         related to a duplicate hooks file being detected...

after    Plugin installed but dead. `.claude-plugin/plugin.json` declares
         "hooks": "./hooks/hooks.json". Claude Code loads that path by
         itself. Fix = delete the key.
```

### In a file that you commit

```text
before   This commit fixes an issue where the plugin was failing to load due
         to a duplicate hooks file being detected. By removing the redundant
         hooks key, we're now able to successfully load the plugin.

after    Claude Code loads `hooks/hooks.json` from a plugin root by itself.
         The manifest also declared that path in its `hooks` key, so the
         loader saw the same file twice. It rejected the whole plugin.
```

The second one is longer, and that is correct. A reader of a file was not in the
session. [`example.md`](example.md) shows all three surfaces this way.

## Install

```bash
claude plugin marketplace add strikeout/ponycave100
claude plugin install ponycave100@ponycave100 --scope user
```

Then open a new session. A hook loads at session start, so the session that
installs the plugin does not change.

opencode and Copilot CLI need one file each. Read
[Install on opencode](#install-on-opencode) and
[Install on Copilot CLI](#install-on-copilot-cli).

## The name, and the three rules it merges

| Part | The rule | It comes from |
|---|---|---|
| **pony** | the lazy-code ladder | the `ponytail` plugin |
| **cave** | terse prose | the `caveman` plugin |
| **100** | ASD-STE100 for every file | the aerospace writing standard |

This plugin needs neither of those two plugins. It carries a short form of each
rule itself, and it yields if you install one of them.

## The problem it solves

The three rulesets used to arrive from three separate sources. Each source
spent tokens to explain its boundary with the other two, and one of them sent
its full ruleset into every subagent. A fan-out of twelve agents paid that cost
twelve times.

The three also disagree, so a blend of them is wrong. ASD-STE100 needs the
articles and a complete sentence, and the terse prose rule drops both. A merge
must therefore name the surface before it gives a rule.

This plugin names the boundary once, so it costs about 70 percent less.

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

The hook names the surface before it gives a rule, because two of the rules
disagree. [`example.md`](example.md) shows each surface twice: once without the
plugin, and once with it.

## When not to use this

- **You want one voice everywhere.** This plugin exists to split the voice by
  surface. A single style guide in `CLAUDE.md` costs less and does that better.
- **You never dispatch a subagent.** A hook earns its place at the subagent
  boundary. For one main thread, a skill or a `CLAUDE.md` section is enough.
- **You write your files in another language.** ASD-STE100 is an English
  standard. The prose rule keeps the language of the user, and the artifact rule
  does not.
- **You want a brand voice with personality in your docs.** ASD-STE100 is plain
  on purpose. It optimises for one reading, by a stranger, under time pressure.

The prose layer and the code layer each switch off in
[`~/.claude/.ponycave100.json`](#levels). The artifact layer has no switch,
because a file is durable or it is not. To turn that layer off, uninstall the
plugin.

## Why it is a plugin and not a skill

A subagent inherits no context from its parent session. A skill cannot reach
one, because the model invokes a skill and nothing invokes one inside a fresh
subagent. Only a `SubagentStart` hook reaches it, and a plugin is the unit that
carries a hook.

## Install on Claude Code

The two commands sit in [Install](#install) above. A local directory works in
place of the repository name.

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

## Install on opencode

Verified against opencode 1.14.33.

opencode gives a plugin no session-start event. It gives
`experimental.chat.system.transform`, which hands the plugin the system prompt
before each model call. The adapter appends the rules to that array.

**Clone this repository to a stable path first.** The adapter holds an absolute
path to the hook, and a move of the repository breaks it.

```bash
R=~/src/ponycave100        # the path you cloned to
mkdir -p ~/.config/opencode/plugins
sed "s|__PONYCAVE100_HOOK__|$R/hooks/ponycave100.js|" \
  "$R/adapters/opencode/ponycave100.js" > ~/.config/opencode/plugins/ponycave100.js
```

opencode loads every `*.js` file in that directory by itself, so the file
`opencode.json` needs no entry. Confirm the install in a new session:

```bash
opencode run "Quote the first line of the HOUSE STYLE block in your context."
```

The model answers `HOUSE STYLE. Three surfaces. Never blend them.`

**opencode never trims the rules for an agent.** The hook receives `sessionID`
and `model` alone, and it runs before `chat.params`, which is the one hook that
names the agent. Every model call therefore reads the full block. This includes
a read-only agent, and it includes the internal title agent.

## Install on Copilot CLI

**A live session did not verify this.** The author has no Copilot CLI
installation. The command follows the documented hook contract, and a test
proves the hook's own output. Report a failure as an issue.

Copilot CLI reads a flat `{"additionalContext": "..."}` from the stdout of a
hook. It merges every `*.json` file in the hooks directory.

```bash
R=~/src/ponycave100        # the path you cloned to
mkdir -p ~/.copilot/hooks
sed "s|__PONYCAVE100_HOOK__|$R/hooks/ponycave100.js|" \
  "$R/adapters/copilot/ponycave100.json" > ~/.copilot/hooks/ponycave100.json
```

The adapter registers two events. `sessionStart` carries the full ruleset.
`subagentStart` carries the subagent form, and Copilot runs it before the
subagent starts.

**Copilot CLI drops the output of a `userPromptSubmitted` command hook**, so the
per-turn reminder has no equivalent there. Only an SDK hook modifies a prompt.

## What each host receives

| | Claude Code | opencode | Copilot CLI |
|---|---|---|---|
| Session rules | yes | yes, on each model call | yes |
| Subagent rules | yes, trimmed per agent | the full block, never trimmed | yes, trimmed per agent |
| Per-turn reminder | yes | each call repeats the rules | no |
| Install | a plugin | one file, copied | one file, copied |
| Verified | a live session | a live session | the contract alone |

The hook itself serves all three. `--host` selects the envelope, and `--kind`
names the surface when the host sends no event name:

```bash
node hooks/ponycave100.js --host=text --kind=session    # the rules, as text
```

Give `--host=text` to any other agent. Append its output to that agent's
`AGENTS.md` between two markers, and generate it again after an upgrade.

## Uninstall

Each host keeps the plugin in one place, so each one removes it in one step.

```bash
# Claude Code
claude plugin uninstall ponycave100@ponycave100
claude plugin marketplace remove ponycave100

# opencode
rm ~/.config/opencode/plugins/ponycave100.js

# Copilot CLI
rm ~/.copilot/hooks/ponycave100.json
```

The plugin writes one other file, and only when you change a level:
`~/.claude/.ponycave100.json`. Delete it too, or keep it for the next install.

## What it contains

| Path | What it is |
|---|---|
| `hooks/ponycave100.js` | the one hook, for three events |
| `hooks/hooks.json` | the event registration |
| `skills/ponycave100/` | the rules in full, and the level control |
| `skills/simplified-technical-english/` | the ASD-STE100 skill and its checker |
| `example.md` | each rule in use, without the plugin and with it |
| `adapters/opencode/` | the opencode plugin, as a template |
| `adapters/copilot/` | the Copilot CLI hook config, as a template |

The checker needs `python3`. The hook needs `node`. Both ship with Claude Code
on a normal developer machine.

```bash
python3 skills/simplified-technical-english/check.py FILE
```

The checker reads a markdown file or a source file. From a source file it takes
the comments, the docstrings, the error strings and the log strings. It reports
the sentence length, the paragraph length, the passive voice, the gerund and the
fragment.

Version 1.2.0 closed five gaps that reported a correct sentence as a fragment.
The fragment rule used an open list of verbs, and an open list never closes. The
checker now tests a closed list of words that never open an imperative sentence.
It also skips a line that carries no sentence: a task line, an image embed, a
link index, a comment ruler and a tool pragma.

Against a corpus of 142 markdown files the fragment findings fell from 114 to 6,
and the six that remain are real. Against 120 TypeScript files they fell from
310 to 31. Every other rule reported the same findings before and after.

One gap stays open, and it is a judgment call. The checker reads a past
continuous such as "the agent was writing" as a bare gerund. ASD-STE100 asks for
the present tense, so the finding is correct and the rule name is wrong.

**The checker still cannot see article use or word choice.** Keep a sentence that
you can defend, and name why the finding is wrong. Never damage a good sentence
to clear the checker.

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
