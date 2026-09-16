#!/bin/sh
# Write the three rules into an instruction file, between two markers.
#
# Use this for an agent that reads a file and runs no hook. The script is
# idempotent: it replaces the block when the markers are present, and it appends
# the block when they are absent.
#
#   sh adapters/agents-md/install.sh ~/.codex/AGENTS.md
#
# Run the script again after an upgrade of the plugin. The block does not
# refresh itself, because no hook runs.

set -eu

target="${1:-}"
if [ -z "$target" ]; then
  echo "usage: install.sh PATH_TO_INSTRUCTION_FILE" >&2
  exit 2
fi

# Find the hook. The environment wins, then the repository layout, then the
# two-file install. The script therefore works from a clone and on its own.
hook="${PONYCAVE100_HOOK:-}"
if [ -z "$hook" ]; then
  for candidate in \
    "$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)/hooks/ponycave100.js" \
    "$HOME/.ponycave100/ponycave100.js"
  do
    if [ -f "$candidate" ]; then hook="$candidate"; break; fi
  done
fi
if [ ! -f "$hook" ]; then
  echo "install.sh: no hook found. Set PONYCAVE100_HOOK to its path." >&2
  exit 1
fi

rules=$(node "$hook" --host=text --kind=session </dev/null)
export PONYCAVE_TARGET="$target" PONYCAVE_RULES="$rules"

python3 - <<'PY'
import os
import pathlib
import re

target = pathlib.Path(os.environ["PONYCAVE_TARGET"]).expanduser()
start, end = "<!-- ponycave100:start -->", "<!-- ponycave100:end -->"
block = f"{start}\n{os.environ['PONYCAVE_RULES']}\n{end}"

target.parent.mkdir(parents=True, exist_ok=True)
text = target.read_text() if target.exists() else ""
pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)

if pattern.search(text):
    text = pattern.sub(lambda _: block, text, count=1)
    action = "replaced the block in"
else:
    text = (text.rstrip("\n") + "\n\n" if text.strip() else "") + block + "\n"
    action = "added the block to"

target.write_text(text)
print(f"ponycave100 {action} {target}.")
PY
