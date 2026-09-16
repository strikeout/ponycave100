---
name: simplified-technical-english
description: Use when writing durable prose that outlives the session — an AGENTS.md section, a wiki finding page, a PR body, a changelog entry, a commit message body, a README or docs page, a runbook, release notes, a procedure, a code comment, a docstring, an error string or a log line — or when the user names ASD-STE100, STE100, STE or Simplified Technical English.
---

# Simplified Technical English

ASD-STE100 is the writing standard for aerospace maintenance documentation. It holds about 57
rules and an approved dictionary of about 900 words. This skill carries the rules, not the
dictionary. Prefer a plain word; no list here polices your choice.

Write every durable artifact this way. An artifact is durable when it outlives the session, and
another reader meets it later.

## Which surface takes which style

| Surface | Style |
|---|---|
| A chat reply | the conversational style of the session |
| An AGENTS.md section, a wiki page, a doc page, a README, a runbook | STE |
| A PR body, a changelog entry, a commit message body | STE |
| A code comment, a docstring, an error string, a log line | STE |
| An identifier | STE, for the choice of word only |
| Syntax, casing, format, import order | the repo convention — STE says nothing |

## The recipe

The output is a sequence of complete sentences. Each sentence states one fact, or it gives one
instruction. A reader can act on each sentence alone.

### Words

- Choose one term for one idea. Keep that term through the whole document.
- Give each word one part of speech. Do not turn a noun into a verb.
- Write the articles. Write "the pump". Never write "pump".
- Replace an "-ing" form with a clause. Write "when you connect the cable".
- Limit a noun cluster to three words.
- Write in the present tense. Avoid the future tense and the conditional.

### Sentences

- Keep a step under 20 words. Keep a description under 25 words.
- Give one instruction per sentence. Two actions need two sentences.
- Use the active voice in a step, and name the actor.
- Start a step with its verb. Write "Run the migration."
- Write a complete sentence. A fragment is the one habit STE rejects that terse chat style keeps.

### Order

- Limit a procedural paragraph to six sentences. Give it one topic, and put that topic first.
- Put a warning before the step it guards. Never put a warning after its step.
- Put the condition before the action. Write "If the gate fails, revert the PR."
- Number a sequence. Use bullets for a set that has no order.

## In code

- A comment is a sentence. It takes the articles, the active voice and the present tense.
- STE governs how you write a comment. Your project rule governs whether you write one. The two
  rules stack, and they do not compete.
- An error string and a log line are procedural. Keep each one under 20 words.
- One term for one idea also governs an identifier. Pick "event" or "gig", then keep it.
- STE is an English standard. It governs en.ts. It does not govern de.ts.
- STE says nothing about syntax, casing or format. The repo and its linter own those.

## Check the result — this step is required

Write the artifact, then run the checker over it, then fix every finding it reports. A long
document dilutes these rules, so the last pass is the one that holds them. Deliver the artifact
only after the checker reports a clean run, or after you can name why a finding is wrong.

```bash
python3 ~/.claude/skills/simplified-technical-english/check.py FILE [FILE...]
```

The checker reads a markdown file or a source file. From a source file it takes only the comments, the
docstrings, the error strings and the log strings. It reports the sentence length, the paragraph
length, the passive voice, the gerund and the fragment. It cannot see article use or word choice,
so read the artifact for those two.

## After the artifact

Return to the style of the session for the next reply. STE governs the artifact. It does not
govern the conversation.
