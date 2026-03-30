const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readSkillMd() {
  const skillPath = path.resolve(__dirname, "..", "skills", "creator-cli", "SKILL.md");
  return fs.readFileSync(skillPath, "utf8");
}

function findCodeFences(md) {
  // Returns array of { fence, lang, content, startIdx, endIdx }
  const blocks = [];
  const re = /```([a-zA-Z0-9_-]*)\s*\r?\n([\s\S]*?)\r?\n```/g;
  let m;
  while ((m = re.exec(md))) {
    blocks.push({
      fence: m[0],
      lang: m[1] || "",
      content: m[2] || "",
      startIdx: m.index,
      endIdx: m.index + m[0].length,
    });
  }
  return blocks;
}

function precedingWindow(md, idx, maxChars = 2000) {
  const start = Math.max(0, idx - maxChars);
  return md.slice(start, idx);
}

function firstNonEmptyLine(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
}

test("skills/creator-cli/SKILL.md defaults to non-UUID examples", () => {
  const md = readSkillMd();

  // 1) It contains nodePath-first guidance (you generally don't need resolve-node first).
  const hasNodePathFirstBullet =
    /(^|\n)\s*[-*]\s*.*nodePath\s*優先.*不需要先.*`?\s*resolve-node\s*`?/m.test(md);
  const hasNodePathFirstSentence =
    /nodePath[\s\S]{0,120}(優先|先)[\s\S]{0,120}不需要先[\s\S]{0,120}resolve-node[\s\S]{0,120}(取|拿|取得|取得\s*uuid|UUID|uuid)/i.test(
      md
    );
  assert.ok(
    hasNodePathFirstBullet || hasNodePathFirstSentence,
    [
      "Expected nodePath-first guidance without requiring a specific header.",
      "Accept either:",
      "- A bullet line containing both 'nodePath 優先' and '不需要先 resolve-node', or",
      "- Any sentence indicating nodePath should be used first and you don't need resolve-node to get UUID.",
    ].join("\n")
  );

  // 2) It contains at least one example for remove-component using nodePath + component.
  assert.match(
    md,
    /creator-cli\s+remove-component\s+\S+\/\S+\s+\S+/,
    "Expected at least one remove-component example using nodePath + component."
  );

  // 3) It contains at least one example using @node:
  assert.match(
    md,
    /@node:/,
    "Expected at least one @node: example."
  );

  // 4) It does NOT contain long UUID-first workflows in SKILL.md.
  //
  // SKILL.md may mention resolve-node briefly (e.g. as fallback/debugging or as a link to API reference),
  // but it should NOT include long step-by-step workflows that extract UUID first and then do the real work.
  //
  // Those long workflows belong in API-REFERENCE.md (or can be linked), not in SKILL.md defaults.
  const codeBlocks = findCodeFences(md);
  const disallowed = [];

  for (const b of codeBlocks) {
    const content = b.content || "";
    const firstLine = firstNonEmptyLine(content);

    // Heuristics for "UUID-first workflow" snippets:
    // - PowerShell parsing patterns
    // - Shell/Node parsing patterns
    // - Variables like $uuid / $compUuid used after resolve-node/resolve-component
    // - Multiple-step blocks that effectively say "resolve first, then do X"
    const hasPowerShellUuidExtraction =
      /ConvertFrom-Json/i.test(content) ||
      /\$result\s*=\s*creator-cli\s+resolve-(node|component)\b/i.test(content) ||
      /\$uuid\b/.test(content) ||
      /\$compUuid\b/.test(content);

    const hasShellUuidExtraction =
      /\bUUID\s*=\s*\$\(\s*creator-cli\s+resolve-node\b/i.test(content) ||
      /\bCOMP_UUID\s*=\s*\$\(\s*creator-cli\s+resolve-component\b/i.test(content) ||
      /\bnode\s+-e\b/i.test(content);

    const startsWithResolveNodeOrComponent =
      /^creator-cli\s+resolve-(node|component)\b/.test(firstLine) ||
      /^\$result\s*=\s*creator-cli\s+resolve-(node|component)\b/.test(firstLine);

    const lineCount = content.split(/\r?\n/).filter((l) => l.trim().length > 0).length;

    // We only flag when it looks like an actual workflow (parsing/extraction + follow-up),
    // not when it's a short 1-3 line fallback snippet.
    const looksLikeLongWorkflow =
      hasPowerShellUuidExtraction ||
      hasShellUuidExtraction ||
      (startsWithResolveNodeOrComponent && lineCount >= 5);

    if (looksLikeLongWorkflow) {
      disallowed.push({ lang: b.lang, firstLine });
    }
  }

  assert.equal(
    disallowed.length,
    0,
    [
      "Found long UUID-first workflow code examples inside SKILL.md.",
      "Rewrite to nodePath-first defaults, or move the long UUID extraction workflow to API-REFERENCE.md and link to it:",
      ...disallowed.map((d) => `- [${d.lang || "code"}] ${d.firstLine}`),
    ].join("\n")
  );
});

