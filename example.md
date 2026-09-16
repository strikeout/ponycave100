# Examples

Three rules govern three surfaces. This page shows each surface twice: once
without the plugin, and once with it.

Every specimen sits in a code block. The ASD-STE100 checker skips a code block,
so it reads the explanation here and never the specimen.

The material comes from one real session. That session replaced a hand-rolled
house style with this plugin, and it found the manifest defect that
`git show 4e36779` records.

## 1. Prose — a chat reply, and a subagent's report back

A reply is ephemeral. The prose rule drops the articles, the filler and the
hedging, and it puts the answer first.

The agent installed the plugin. The install reported success, and the plugin
then failed to load.

The agent answers this without the plugin:

```
Great question! I've gone ahead and installed the plugin for you.
Unfortunately, it looks like there may have been an issue with the
installation. When I ran `claude plugin list`, I noticed that the plugin is
showing a "failed to load" status. This appears to be related to a duplicate
hooks file being detected. I believe this might be because the plugin's
manifest is declaring a hooks file that Claude Code already loads
automatically. Would you like me to try fixing this for you?
```

The agent answers this with the plugin:

```
Plugin installed but dead. `claude plugin list`:

    Status: ✘ failed to load
    Error: Hook load failed: Duplicate hooks file detected:
    ./hooks/hooks.json resolves to already-loaded file .../hooks/hooks.json.

`.claude-plugin/plugin.json` declares "hooks": "./hooks/hooks.json".
Claude Code loads that path by itself. Fix = delete the key.
```

The reply falls from 77 words to 38. The error text is the same in both,
because the rule never compresses an error string.

## 2. Artifacts — every file you write

A file outlives the session, and a stranger reads it next. ASD-STE100 therefore
asks for a complete sentence, the articles, the active voice and a named actor.

An artifact is longer than a reply, and that is correct. The reader was not
present.

Without the plugin, a commit body for the same fix:

```
fix: resolve plugin loading issue

This commit fixes an issue where the plugin was failing to load due to a
duplicate hooks file being detected. By removing the redundant hooks key
from the manifest, we're now able to successfully load the plugin. This
should resolve the problem for users who were experiencing this issue.
```

That body holds four defects. The phrases "was failing" and "being detected"
hide the actor. The phrase "this should resolve" hedges a fact that the author
verified. The body quotes no error text, and it names no version.

With the plugin, the commit that this repository actually carries:

```
Drop the hooks key that made the plugin refuse to load (1.0.1)

Claude Code loads `hooks/hooks.json` from a plugin root by itself. The manifest
also declared that path in its `hooks` key, so the loader saw the same file
twice. It rejected the whole plugin.

`claude plugin marketplace add` and `claude plugin install` both reported
success. `claude plugin list` then reported `failed to load`. The plugin stayed
enabled in `settings.json` and carried no hook, so a session started with no
style rule and with no error.

Declare a hook file in the manifest only when its name is not the standard one.
```

Each sentence names its actor: Claude Code loads, the loader saw, the plugin
stayed.

The same rule reaches a shorter artifact:

| The artifact | Without the plugin | With the plugin |
|---|---|---|
| an error string | `"Invalid config"` | `"The hooks key names the standard path. Delete it."` |
| a code comment | `// handle the edge case` | `// A plugin that ships no hook sets no CLAUDE_PLUGIN_ROOT. Fall back to __dirname.` |

Check any artifact with the checker. The session-start block gives its absolute
path:

```bash
python3 <the path from the session-start block> FILE
```

## 3. Code — the design decisions inside that file

The code rule is a ladder. Climb it, and stop at the first rung that holds.

The same session held a real decision. The checker moved into the plugin, so its
path now carries a version number. The path moves at each upgrade, and four
documents held the old one.

Without the plugin, the reflex is an indirection layer:

```bash
# ~/.claude/bin/ste-check — a stable path that survives a plugin upgrade
d=$(ls -dt ~/.claude/plugins/cache/ponycave100/ponycave100/*/ | head -1)
exec python3 "$d/skills/simplified-technical-english/check.py" "$@"
```

The four documents then point at the wrapper. That answer adds one file, one
more thing that rots, and one more way to be wrong.

With the plugin, rung one answers it. Ask whether the thing needs to exist at
all. The hook already prints the live absolute path into every session:

```
Verify: python3 /Users/.../ponycave100/1.1.0/skills/simplified-technical-english/check.py FILE
```

So delete the path from the four documents, and write "the session-start block
gives the path". The answer adds no file, and it corrects itself at the next
upgrade. The bump from 1.0.1 to 1.1.0 proved that an hour later.

The same ladder governed the defect itself. The fix deleted one line from
`plugin.json`. It added no guard, and it added no work-around.

When you stop short on purpose, mark the rung you stopped at:

```js
// ponytail: globs the newest cache directory. This breaks if two versions
//           coexist. Upgrade path — read the version from
//           installed_plugins.json.
```

## Why the two prose rules never blend

ASD-STE100 needs the articles and a complete sentence. The terse rule drops
both. One fact therefore takes two forms.

A chat reply states it like this:

```
Install reports the download, not the load. Run plugin list after.
```

A README states the same fact like this:

```
**`claude plugin install` reports the download, never the load.** Run
`claude plugin list` after it, and read the status line.
```

Write the first into a README, and a stranger cannot parse it in six months.
Write the second into a chat reply, and you pay for the word "the" forty times
in one session. The hook names the surface before each rule for that reason.
