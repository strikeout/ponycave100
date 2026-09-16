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

root=$(cd "$(dirname "$0")/../.." && pwd)
hook="$root/hooks/ponycave100.js"
if [ ! -f "$hook" ]; then
  echo "install.sh: no hook at $hook." >&2
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
