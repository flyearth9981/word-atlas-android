#!/usr/bin/env node
/** Validate the public Word Atlas dataset: structure, references and media files. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public/atlas");
const index = JSON.parse(fs.readFileSync(path.join(pub, "index.json"), "utf8"));
const errors = [];
const warn = { headwordNotInExample: 0, missingIpa: 0, oneExample: 0 };
const fail = (msg) => errors.length < 50 && errors.push(msg);

if (index.words.length !== index.count) fail(`count ${index.count} != rows ${index.words.length}`);
const ids = new Set();
index.words.forEach((r, i) => {
  const [id, word, zh, , cefr, topic, media] = r;
  if (!/^[a-z0-9-]{1,64}$/.test(id) || ids.has(id)) fail(`bad or duplicate id at ${i}: ${id}`);
  ids.add(id);
  if (!word || !zh) fail(`empty word or meaning: ${id}`);
  if (!(cefr >= 0 && cefr < index.cefr.length)) fail(`bad level: ${id}`);
  if (!(topic >= 0 && topic < index.topics.length)) fail(`bad topic: ${id}`);
  const need = [
    [1, `img/${id}.webp`],
    [1, `thumb/${id}.webp`],
    [2, `audio/uk/${id}.mp3`],
    [4, `audio/us/${id}.mp3`],
    [8, `audio/ex/${id}.mp3`],
    [16, `audio/ex2/${id}.mp3`],
  ];
  for (const [bit, file] of need) if (media & bit && !fs.existsSync(path.join(pub, file))) fail(`missing ${file}`);
});

let entries = 0;
let examples = 0;
for (let n = 0; n * index.chunk < index.count; n++) {
  const chunk = JSON.parse(fs.readFileSync(path.join(pub, `entries/${n}.json`), "utf8"));
  chunk.forEach((e, k) => {
    const row = index.words[n * index.chunk + k];
    if (!row || row[0] !== e.id) return fail(`chunk ${n} out of order at ${e.id}`);
    entries++;
    if (!Array.isArray(e.senses) || !e.senses.length || e.senses.some((s) => !s.zh)) fail(`no senses: ${e.id}`);
    if (!Array.isArray(e.ex) || !e.ex.length || e.ex.some((x) => !x.en || !x.zh)) fail(`bad examples: ${e.id}`);
    examples += e.ex.length;
    if (e.ex.length < 2) warn.oneExample++;
    if (!e.uk && !e.us) warn.missingIpa++;
    const stem = e.w.toLowerCase().split(" ")[0].replace(/(e|y)$/, "").slice(0, 5);
    if (e.ex[0] && !e.ex[0].en.toLowerCase().includes(stem)) warn.headwordNotInExample++;
    for (const k of ["col", "fam", "syn", "ant"]) if (!Array.isArray(e[k])) fail(`${k} not array: ${e.id}`);
  });
}
if (entries !== index.count) fail(`entries ${entries} != count ${index.count}`);
if (examples !== index.examples) fail(`examples ${examples} != ${index.examples}`);

const bits = (b) => index.words.filter((r) => r[6] & b).length;
console.log(
  JSON.stringify(
    { words: index.count, examples, illustrated: bits(1), ukAudio: bits(2), usAudio: bits(4), sentenceAudio: bits(8), ieltsSentenceAudio: bits(16), warnings: warn, errors: errors.length },
    null,
    1,
  ),
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
