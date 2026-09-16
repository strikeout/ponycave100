#!/usr/bin/env python3
# Check English prose against the mechanical ASD-STE100 rules.
#
# The checker covers the rules a regex can decide. It looks at sentence length,
# paragraph length, passive voice, gerund constructions and telegraphic
# fragments. It says nothing about word choice, because this file does not
# encode the STE approved dictionary. A human still reads for that.
#
# Markdown mode scans the prose. Source mode extracts the English from a source
# file and scans only that: comments, docstrings, error strings and log strings.
# Every other string literal stays out of the scan. A URL, a CSS class and a SQL
# fragment are not prose. A checker that flags them earns no trust.

import io
import re
import sys
import token as token_mod
import tokenize

PROSE_MAX = 25          # a limit for one descriptive sentence
PROCEDURAL_MAX = 20     # a limit for one step, one error string or one log line
PARAGRAPH_MAX = 6       # a limit for one procedural paragraph

IRREGULAR_PP = {
    "done", "made", "run", "seen", "given", "taken", "written", "built", "sent",
    "kept", "held", "found", "set", "put", "read", "shown", "known", "thrown",
    "drawn", "chosen", "broken", "left", "lost", "meant", "paid", "said", "told",
    "brought", "caught", "taught", "bought", "gone", "got", "hidden",
}
BE_VERB = r"(?:is|are|was|were|be|been|being|gets?|got)"
PASSIVE_RE = re.compile(
    rf"\b{BE_VERB}\b(?:\s+\w+ly)?\s+({'|'.join(sorted(IRREGULAR_PP))}|\w+ed)\b", re.I)

# A word that ends in "ing" but names a thing. STE allows these, so they must
# never reach the report.
NOT_GERUND = {
    "nothing", "something", "anything", "everything", "during", "morning",
    "evening", "ceiling", "string", "spring", "thing", "king", "ring", "wing",
    "sibling", "warning", "setting", "heading", "booking", "listing", "rating",
    "meeting", "building", "engineering", "marketing", "branding", "onboarding",
}
# A gerund counts only when one of these words introduces it. The guard keeps
# domain nouns such as "the booking system" out of the report.
GERUND_RE = re.compile(
    r"\b(?:by|when|while|after|before|without|for|of|in|on|is|are|was|were|be"
    r"|been|being|avoid|start|stop|begin|consider)\s+(\w{4,}ing)\b", re.I)
GERUND_LEAD_RE = re.compile(r"^(\w{4,}ing)\b", re.I)

# A past participle in IRREGULAR_PP is also a past tense, so it is also a finite
# verb. "The partition held." holds a verb, and the fragment rule must see it.
IRREGULAR_FINITE = {
    "wrote", "won", "ran", "came", "went", "took", "saw", "knew", "grew", "fell",
    "felt", "led", "met", "sat", "spoke", "stood", "understood", "began",
    "became", "chose", "drew", "threw", "hid", "sought", "wore", "rose",
}
FINITE_VERB = re.compile(
    rf"\b(?:{BE_VERB}|{'|'.join(sorted(IRREGULAR_PP | IRREGULAR_FINITE))}"
    r"|has|have|had|does|do|did|can|cannot|will|must|should|may|might"
    r"|needs?|makes?|takes?|gives?|runs?|uses?|holds?|keeps?|reads?|writes?"
    r"|returns?|fails?|passes?|calls?|sets?|adds?|shows?|means?|works?"
    r"|skips?|covers?|hides?|holds?|breaks?|falls?|joins?|splits?|opens?"
    r"|closes?|drops?|applies|apply|carries|carry|lives?|belongs?|counts?"
    r"|\w{2,}[^aeiou]s|\w{3,}es|\w{3,}ed)\b", re.I)
# An imperative sentence opens with a bare verb. A checker cannot list every
# verb, and an open list never closes. So list the words that never open an
# imperative instead. That list is closed.
NEVER_IMPERATIVE = {
    "the", "a", "an", "this", "that", "these", "those", "it", "he", "she",
    "they", "we", "you", "his", "her", "their", "our", "my", "its", "there",
    "here", "one", "two", "three", "no", "any", "some", "each", "every", "all",
    "both", "most", "more", "less", "few", "many", "such", "what", "which",
    "who", "whose", "when", "where", "why", "how", "if", "because", "although",
    "while", "after", "before", "since", "until", "unless", "and", "but", "or",
    "nor", "so", "yet", "in", "on", "at", "to", "of", "by", "with", "from",
    "into", "over", "under", "nothing", "something", "anything", "everything",
    "once", "only", "just", "per", "via",
}
# An adverb or a connective can precede the verb. Remove it before the test.
LEAD_IN_RE = re.compile(r"^(?:\w+ly|then|next|first|now|also|instead)\s+", re.I)

NUMBERED_RE = re.compile(r"^\s{0,3}(?:\d+[.)]|[-*+])\s+")
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'\-]*")

BLOCK_COMMENT_EXT = {".ts", ".tsx", ".astro", ".js", ".jsx", ".mjs", ".sql", ".css"}
LINE_COMMENT = {".ts": "//", ".tsx": "//", ".astro": "//", ".js": "//", ".jsx": "//",
                ".mjs": "//", ".py": "#", ".sh": "#", ".bash": "#", ".sql": "--"}
# A ruler and a tool pragma sit in a comment, and neither one is prose.
RULER_RE = re.compile(r"^[\s\-=*~_#/+.]*$")
PRAGMA_RE = re.compile(
    r"^(?:eslint|prettier|biome|oxlint|istanbul|c8|v8|jscpd|noinspection|@ts-"
    r"|ts-(?:ignore|expect-error|nocheck)|type:|pylint|noqa|ruff|mypy|flake8)",
    re.I)


def is_prose(body):
    """Say whether a comment body holds a sentence."""
    return bool(body.strip()) and not RULER_RE.match(body) and not PRAGMA_RE.match(body.strip())


STRING_CALL = re.compile(
    r"(?:throw\s+new\s+\w*Error|console\.(?:log|warn|error|info)|logger?\.\w+)"
    r"""\s*\(\s*(['"`])(.+?)\1""", re.S)


def strip_markdown(text):
    """Delete every span that is not prose and keep the line numbers.

    This function removes the unwanted spans from the input. It does not add an
    exemption rule, because an exemption does not scope. A rule that says
    "ignore the code blocks" still reaches into them.
    """
    result = []
    fenced = False
    in_front = False
    for number, line in enumerate(text.split("\n"), 1):
        if number == 1 and line.strip() == "---":
            in_front = True
            result.append((number, "", "break"))
            continue
        if in_front:
            if line.strip() == "---":
                in_front = False
            result.append((number, "", "break"))
            continue
        if line.lstrip().startswith(("```", "~~~")):
            fenced = not fenced
            result.append((number, "", "break"))
            continue
        if fenced or line.lstrip().startswith(("|", "<!--")) or line.startswith("    "):
            result.append((number, "", "break"))
            continue
        bare = line.strip()
        # A task line, an embed and a link index each carry a marker or a
        # filename, and none of them carries a sentence.
        if re.match(r"[-*+]\s+\[[ xX]\]", bare) or bare.startswith("!["):
            result.append((number, "", "break"))
            continue
        if bare.startswith(("\u2192", "\u00b7")) or bare.startswith("[["):
            if len(re.sub(r"!?\[\[[^\]]*\]\]|[\u2192\u00b7,\s]", "", bare)) < 3:
                result.append((number, "", "break"))
                continue
        if re.match(r"\s{0,3}#{1,6}\s", line):
            # A heading is a label, not a sentence. The prose rules skip it.
            result.append((number, "", "break"))
            continue
        # Substitute a placeholder word rather than whitespace. A bare space
        # leaves "lives in ." behind and the fragment rule then cries wolf.
        clean = re.sub(r"`[^`]*`", " item ", line)
        clean = re.sub(r"https?://\S+", " item ", clean)
        clean = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", clean)
        clean = re.sub(r"[*_#>]+", " ", clean)
        # A heading and a list item each open a new unit. Without the break the
        # joiner would fuse consecutive bullets into one false run-on sentence.
        opens = bool(re.match(r"\s{0,3}(?:#{1,6}\s|\d+[.)]\s|[-*+]\s)", line))
        result.append((number, clean, "break" if opens else "join"))
    return result


def pad(result, text):
    """Fill the gaps with blank entries, so a blank run breaks a paragraph."""
    found = {number: (prose, block) for number, prose, block in result}
    total = text.count("\n") + 1
    return [(number,) + found.get(number, ("", "join")) for number in range(1, total + 1)]


def extract_python(text):
    """Use the tokenizer, because a regex cannot track a Python string state."""
    result = []
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(text).readline))
    except (tokenize.TokenError, IndentationError):
        return [(1, "")]
    opener = (token_mod.INDENT, token_mod.DEDENT, token_mod.NEWLINE,
              token_mod.NL, token_mod.ENCODING)
    previous_type = token_mod.INDENT
    for item in tokens:
        kind, value, start, _, _ = item
        if kind == token_mod.COMMENT:
            body = value.lstrip("#").strip()
            if not (start[0] == 1 and value.startswith("#!")) and is_prose(body):
                result.append((start[0], body,
                               "join" if previous_type in opener else "isolate"))
        elif kind == token_mod.STRING and previous_type in opener:
            body = value.strip("rbuf").strip("\'\"").strip()
            result.append((start[0], body, "join"))
        if kind not in (token_mod.NL, token_mod.COMMENT):
            previous_type = kind
    return pad(result, text)


def extract_source(text, ext):
    """Pull the English out of a source file and keep its line numbers."""
    if ext == ".py":
        result = extract_python(text)
    else:
        result = []
        marker = LINE_COMMENT.get(ext, "//")
        in_block = False
        for number, line in enumerate(text.split("\n"), 1):
            prose = ""
            standalone = True
            stripped = line.strip()
            if in_block:
                prose = re.sub(r"\*/.*", "", stripped).lstrip("*").strip()
                if "*/" in stripped:
                    in_block = False
            elif "/*" in line and ext in BLOCK_COMMENT_EXT:
                body = line.split("/*", 1)[1]
                if "*/" not in body:
                    in_block = True
                prose = body.replace("*/", "").lstrip("*").strip()
            else:
                for match in re.finditer(re.escape(marker), line):
                    before = line[: match.start()]
                    if before.endswith(":"):
                        continue        # This is a URL, not a comment.
                    if before.count('"') % 2 or before.count("'") % 2:
                        continue        # This sits inside a string literal.
                    prose = line[match.start() + len(marker):].strip()
                    standalone = not before.strip()
                    break
            result.append((number, prose if is_prose(prose) else "",
                           "join" if standalone else "isolate"))

    for match in STRING_CALL.finditer(text):
        number = text[: match.start()].count("\n") + 1
        result.append((number, match.group(2), "isolate"))
    return result


def join_paragraph(chunk):
    """Join the lines of one paragraph and map each offset back to its line."""
    parts = []
    offsets = []
    cursor = 0
    for number, prose in chunk:
        text = prose.strip()
        if not text:
            continue
        parts.append(text)
        offsets.append((cursor, number))
        cursor += len(text) + 1
    return " ".join(parts), offsets


def line_of(offsets, position):
    result = offsets[0][1] if offsets else 1
    for start, number in offsets:
        if start <= position:
            result = number
    return result


def check_sentence(sentence, limit, path, number, findings):
    words = WORD_RE.findall(sentence)
    if len(words) > limit:
        findings.append((path, number, "LONG_SENTENCE",
                         f"{len(words)} words against a limit of {limit}: {sentence[:60]}"))
    match = PASSIVE_RE.search(sentence)
    if match:
        findings.append((path, number, "PASSIVE",
                         f'"{match.group(0)}" hides the actor. Name the actor.'))
    gerund = GERUND_RE.search(sentence) or GERUND_LEAD_RE.search(sentence)
    if gerund and gerund.group(1).lower() not in NOT_GERUND:
        findings.append((path, number, "GERUND",
                         f'"{gerund.group(1)}" needs a clause with a finite verb.'))
    head = LEAD_IN_RE.sub("", sentence.lstrip("\"'([-*+ 0123456789.)"))
    opener = WORD_RE.match(head)
    imperative = bool(opener) and opener.group(0).lower() not in NEVER_IMPERATIVE
    if 1 < len(words) <= 4 and not FINITE_VERB.search(sentence) and not imperative:
        findings.append((path, number, "FRAGMENT",
                         f'"{sentence[:50]}" needs a complete sentence.'))


def check_paragraph(chunk, path, numbered, is_markdown, findings):
    body, offsets = join_paragraph(chunk)
    if not body:
        return
    start_line = offsets[0][1]
    sentences = [s for s in SENTENCE_SPLIT.split(body) if s.strip()]
    if len(sentences) > PARAGRAPH_MAX:
        findings.append((path, start_line, "LONG_PARAGRAPH",
                         f"{len(sentences)} sentences against a limit of {PARAGRAPH_MAX}"))
    position = 0
    for sentence in sentences:
        position = body.find(sentence, position)
        number = line_of(offsets, position)
        position += len(sentence)
        limit = PROSE_MAX if (is_markdown and number not in numbered) else PROCEDURAL_MAX
        check_sentence(sentence.strip(), limit, path, number, findings)


def check_file(path):
    ext = "." + path.rsplit(".", 1)[-1] if "." in path else ""
    is_markdown = ext in (".md", ".markdown")
    with open(path, encoding="utf-8", errors="replace") as handle:
        text = handle.read()

    numbered = set()
    if is_markdown:
        pairs = strip_markdown(text)
        for number, raw, _ in pairs:
            if NUMBERED_RE.match(raw):
                numbered.add(number)
    else:
        pairs = extract_source(text, ext)

    findings = []
    chunk = []
    for number, prose, kind in sorted(pairs):
        if not prose.strip():
            check_paragraph(chunk, path, numbered, is_markdown, findings)
            chunk = []
            continue
        if kind == "isolate":
            # A trailing comment stands alone. Never join it to its neighbour.
            check_paragraph(chunk, path, numbered, is_markdown, findings)
            check_paragraph([(number, prose)], path, numbered, is_markdown, findings)
            chunk = []
            continue
        if kind == "break":
            check_paragraph(chunk, path, numbered, is_markdown, findings)
            chunk = []
        chunk.append((number, prose))
    check_paragraph(chunk, path, numbered, is_markdown, findings)
    return findings


def main(argv):
    if len(argv) < 2:
        print("usage: check.py FILE [FILE...]")
        return 2
    findings = []
    for path in argv[1:]:
        try:
            findings.extend(check_file(path))
        except OSError as error:
            print(f"{path}: SKIPPED: {error.strerror}.", file=sys.stderr)
    for path, number, rule, message in sorted(findings, key=lambda item: (item[0], item[1])):
        print(f"{path}:{number}: {rule}: {message}")
    counts = {}
    for _, _, rule, _ in findings:
        counts[rule] = counts.get(rule, 0) + 1
    summary = ", ".join(f"{key}={value}" for key, value in sorted(counts.items()))
    print(f"\n{len(findings)} finding(s): {summary or 'clean'}")
    print("A human must still read for article use and for word choice.")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
