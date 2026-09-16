// ponycave100 for opencode.
//
// opencode gives a plugin no session-start event. It gives
// `experimental.chat.system.transform`, which hands the plugin the system
// prompt before each model call. The plugin appends the rules to that array.
//
// The install step replaces __PONYCAVE100_HOOK__ with an absolute path. Read
// the "Install on opencode" section of the README for the command.
//
// The hook runs once, when opencode loads this plugin. The rules do not change
// inside a session, so one spawn per session is enough.

import { execFileSync } from 'node:child_process'

const HOOK = '__PONYCAVE100_HOOK__'

export const Ponycave100 = async () => {
  let rules = ''
  try {
    rules = execFileSync('node', [HOOK, '--host=text', '--kind=session'], {
      input: '',
      encoding: 'utf8',
      timeout: 5000,
    }).trim()
  } catch (e) {
    // The path is wrong, or node failed. opencode keeps its own system prompt.
  }
  if (!rules) return {}

  return {
    'experimental.chat.system.transform': async (_input, output) => {
      // opencode calls this for each model call, and it calls it for the
      // internal title agent too. One copy per prompt is correct, so test
      // before the push.
      if (!output.system.some((s) => s.startsWith('HOUSE STYLE'))) {
        output.system.push(rules)
      }
    },
  }
}
