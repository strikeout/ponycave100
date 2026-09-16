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
//
// One script serves three hosts. `--host` selects the output envelope, and
// `--kind` names the surface when the host sends no event name.
//
//   --host=claude    (default) {hookSpecificOutput:{hookEventName,additionalContext}}
//   --host=copilot   {additionalContext}
//   --host=text      the rules as plain text, for a host with no JSON contract

const fs = require('fs')
const os = require('os')
const path = require('path')

const ARGV = process.argv.slice(2)
function arg(name, fallback) {
  const hit = ARGV.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const HOST = arg('host', 'claude')

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
const STATE = path.join(CLAUDE_DIR, '.ponycave100.json')

// A read-only agent writes no file, so the artifact rule and the code rule cost
// it tokens and change nothing.
const READ_ONLY = ['Explore', 'Plan', 'cavecrew-investigator', 'cavecrew-reviewer']
// These agents carry the terse rule in their own definition already.
const TERSE_ALREADY = ['cavecrew-investigator', 'cavecrew-builder', 'cavecrew-reviewer']

// Find the checker. Claude Code sets CLAUDE_PLUGIN_ROOT for a plugin hook. The
// repository keeps the checker one directory up. A two-file install keeps the
// checker beside the hook. An agent that reads a file has no checker at all.
function checkerPath() {
  const candidates = []
  if (process.env.PONYCAVE100_CHECKER) candidates.push(process.env.PONYCAVE100_CHECKER)
  const nested = (root) => path.join(root, 'skills', 'simplified-technical-english', 'check.py')
  if (process.env.CLAUDE_PLUGIN_ROOT) candidates.push(nested(process.env.CLAUDE_PLUGIN_ROOT))
  candidates.push(nested(path.join(__dirname, '..')))
  candidates.push(path.join(__dirname, 'check.py'))
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return ''
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
${verifyStep()}`
}

// Name the checker only when the checker exists. A path that resolves to
// nothing costs tokens and sends the agent to a file that is not there.
function verifyStep() {
  const checker = checkerPath()
  if (!checker) return 'Read the artifact once more against these rules before you deliver it.'
  return `Verify: python3 ${checker} FILE
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

// Each host reads a different envelope. Copilot CLI reads a flat
// `additionalContext`. A host with no JSON contract reads the text itself.
function emit(event, text) {
  if (HOST === 'text') {
    process.stdout.write(text)
    return
  }
  if (HOST === 'copilot') {
    process.stdout.write(JSON.stringify({ additionalContext: text }))
    return
  }
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })
  )
}

// A host that calls this script directly sends no payload. Read the terminal
// and the script blocks for ever, so test the descriptor first.
function readPayload() {
  try {
    if (process.stdin.isTTY) return {}
    return JSON.parse(fs.readFileSync(0, 'utf8')) || {}
  } catch (e) {
    // A missing payload costs only the agent-type exemption.
    return {}
  }
}

function main() {
  const payload = readPayload()
  const event = payload.hook_event_name || payload.hookEventName || 'SessionStart'

  // Claude Code names the event in the payload. Another host names the surface
  // on the command line, because its payload carries no event name.
  let kind = arg('kind', '')
  if (!kind) {
    kind = 'session'
    if (event === 'SubagentStart') kind = 'subagent'
    else if (event === 'UserPromptSubmit') kind = 'turn'
  }

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

  // Each host names the agent differently, and one of them may name it not at
  // all. An empty name only costs the read-only exemption.
  const agent =
    payload.agent_type || payload.agentType || payload.agentName || payload.agent || ''
  const text = build(kind, agent)
  if (text) emit(event, text)
}

main()
