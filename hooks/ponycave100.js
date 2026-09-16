#!/usr/bin/env node
// ponycave100 — one hook that carries three style rules to every surface.
//
// Three rules govern three surfaces, and a reader must never blend them:
//
//   prose      a chat reply, and a subagent's report back. It is ephemeral.
//   artifact   every file the agent writes. It is durable, so it takes STE.
//   code       the design decisions inside that file. It takes the lazy ladder.
//
// A subagent inherits no context from its parent session, so a hook is the only
// way a rule reaches it. A skill cannot do this, because the model invokes a
// skill and nothing invokes one inside a fresh subagent.
//
// The three rules used to arrive as separate injections. Each one spent tokens
// to explain the boundary with the other two. This file states the boundary
// once, so it costs about 70 percent less than the sum it replaces.

const fs = require('fs')
const os = require('os')
const path = require('path')

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
const STATE = path.join(CLAUDE_DIR, '.ponycave100.json')

// A read-only agent writes no file, so the artifact rule and the code rule cost
// it tokens and change nothing.
const READ_ONLY = ['Explore', 'Plan', 'cavecrew-investigator', 'cavecrew-reviewer']
// These agents carry the terse rule in their own definition already.
const TERSE_ALREADY = ['cavecrew-investigator', 'cavecrew-builder', 'cavecrew-reviewer']

// The checker ships beside this hook. Claude Code sets CLAUDE_PLUGIN_ROOT for a
// plugin hook. The second candidate covers a copy that somebody installs by hand.
function checkerPath() {
  const roots = []
  if (process.env.CLAUDE_PLUGIN_ROOT) roots.push(process.env.CLAUDE_PLUGIN_ROOT)
  roots.push(path.join(__dirname, '..'))
  for (const root of roots) {
    const candidate = path.join(root, 'skills', 'simplified-technical-english', 'check.py')
    if (fs.existsSync(candidate)) return candidate
  }
  return path.join(roots[0], 'skills', 'simplified-technical-english', 'check.py')
}

// Read the level for each layer. A missing file means both layers run at full.
function levels() {
  let state = {}
  try {
    state = JSON.parse(fs.readFileSync(STATE, 'utf8').replace(/^﻿/, '')) || {}
  } catch (e) {
    // The file is absent or invalid, so both layers keep the default.
  }
  const pick = (value) =>
    ['off', 'lite', 'full', 'ultra'].includes(String(value).toLowerCase())
      ? String(value).toLowerCase()
      : 'full'
  return { prose: pick(state.prose), code: pick(state.code) }
}

// Say whether the caveman plugin or the ponytail plugin serves a layer already.
// This plugin needs neither. The check prevents a second copy when the user
// installs one of them and keeps it active.
//
// The environment variable comes first, and it settles the question alone. Both
// plugins read it before any file, so "off" means the plugin injects nothing.
// The flag file cannot answer this at SessionStart. The plugin deletes the file
// in the same event, so the two hooks race.
function pluginActive(which) {
  const env = which === 'prose' ? process.env.CAVEMAN_DEFAULT_MODE : process.env.PONYTAIL_DEFAULT_MODE
  if (String(env).toLowerCase() === 'off') return false

  const files = []
  if (which === 'prose') {
    files.push(path.join(CLAUDE_DIR, '.caveman-active'))
  } else {
    const dir = process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'ponytail')
      : path.join(os.homedir(), '.config', 'ponytail')
    files.push(path.join(dir, 'state'), path.join(CLAUDE_DIR, '.ponytail-active'))
  }
  for (const file of files) {
    try {
      const flag = fs.readFileSync(file, 'utf8').trim()
      if (flag && flag !== 'off') return true
    } catch (e) {
      // The file is absent, so the plugin does not serve this layer.
    }
  }
  return false
}

const PROSE = `PROSE — your chat reply, and a subagent's report back. Terse.
Drop articles, filler, pleasantries, hedging. Fragments are fine. Lead with the
answer. Give no preamble, no restatement of the task and no closing summary.
Write the shortest version that loses no fact. Skip what nobody asked for.
Keep the user's language. Never name or announce this style.`

function artifact() {
  return `ARTIFACTS — every file you write or edit is durable: a code comment, a
docstring, an error string, a log line, a doc page, a README, an AGENTS.md
section, a spec, a changelog entry, a commit body, a PR body.
Write those in ASD-STE100. Invoke the \`simplified-technical-english\` skill
first, and follow it. If the skill does not load, apply the short form: write
complete sentences and keep the articles; give one instruction per sentence;
use the active voice and name the actor; keep a step under 20 words and a
description under 25; replace an "-ing" clause with a finite verb; write the
present tense; put the condition before the action; put a warning before the
step it guards.
Verify: python3 ${checkerPath()} FILE
The checker reports a false positive on some correct sentences. Fix what it
finds, or name why the finding is wrong. Never damage a good sentence for it.`
}

const CODE = `CODE — take the laziest solution that works. Climb the ladder and
stop at the first rung that holds: does this need to exist at all; does this
codebase already hold it; does the standard library do it; does a native
platform feature cover it; does an installed dependency solve it; can it be one
line. Understand the problem first, then climb.
Add no abstraction that nobody asked for. Prefer deletion over addition, and
boring over clever. A bug fix repairs the root cause, so grep every caller
before you edit. Mark a deliberate corner-cut with a \`ponytail:\` comment that
names the ceiling and the upgrade path.`

const VERBATIM = `VERBATIM everywhere: a file path, a line number, a symbol, a
command, an error string and a code block. Normal prose everywhere: a security
warning, and a confirmation of an action you cannot reverse.`

// Assemble only the layers that this hook still owns.
function build(kind, agentType) {
  const level = levels()
  const parts = []
  const wantProse =
    level.prose !== 'off' &&
    !pluginActive('prose') &&
    !(kind === 'subagent' && TERSE_ALREADY.includes(agentType))
  const writes = !(kind === 'subagent' && READ_ONLY.includes(agentType))
  const wantCode = writes && level.code !== 'off' && !pluginActive('code')

  if (wantProse) parts.push(PROSE)
  if (writes) parts.push(artifact())
  if (wantCode) parts.push(CODE)
  if (!parts.length) return ''
  parts.push(VERBATIM)

  const head =
    kind === 'subagent'
      ? 'HOUSE STYLE (subagent). Three surfaces. Never blend them.'
      : 'HOUSE STYLE. Three surfaces. Never blend them.'
  const tail =
    kind === 'session'
      ? '\n\nThe full rules are the `ponycave100` skill. Change a level in ' +
        STATE + '.'
      : ''
  return `${head}\n\n${parts.join('\n\n')}${tail}`
}

function emit(event, text) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })
  )
}

function main() {
  let payload = {}
  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf8')) || {}
  } catch (e) {
    // A missing payload costs only the agent-type exemption.
  }
  const event = payload.hook_event_name || 'SessionStart'
  let kind = 'session'
  if (event === 'SubagentStart') kind = 'subagent'
  else if (event === 'UserPromptSubmit') kind = 'turn'

  // The per-turn event repeats only the persistence reminder. The full ruleset
  // is already in the session context, and a second copy each turn is waste.
  if (kind === 'turn') {
    const level = levels()
    const bits = []
    if (level.prose !== 'off' && !pluginActive('prose')) bits.push('prose terse')
    if (level.code !== 'off' && !pluginActive('code')) bits.push('code lazy')
    bits.push('files ASD-STE100')
    emit('UserPromptSubmit', `HOUSE STYLE still active: ${bits.join(', ')}.`)
    return
  }

  const text = build(kind, payload.agent_type || '')
  if (text) emit(event, text)
}

main()
