// Publish the static editor to GitHub Pages without changing the source branch.
// Git uses the operator's existing login; no credentials enter the build.
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedRemote = "https://github.com/moderngentlemen-sudo/signature-studio.git";
const siteUrl = "https://moderngentlemen-sudo.github.io/signature-studio/";
const publishBranch = "gh-pages";
const marker = "signature-studio-public-preview";
const git = (args, cwd = repo) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const run = (script, args = []) =>
  execFileSync(process.execPath, [path.join(repo, script), ...args], { cwd: repo, stdio: "inherit" });

if (git(["status", "--porcelain"])) throw new Error("Commit source changes before publishing.");
if (git(["remote", "get-url", "origin"]) !== expectedRemote) throw new Error("Unexpected origin repository.");
if (process.env.VITE_TEST_HOST === "1") throw new Error("A public preview cannot use the local test image host.");
const sourceCommit = git(["rev-parse", "HEAD"]);
const sourceBranch = git(["branch", "--show-current"]);
const remoteSource = git(["ls-remote", "--heads", "origin", sourceBranch]).split(/\s/)[0];
if (sourceCommit !== remoteSource) throw new Error("Push the source branch before publishing.");

run("node_modules/typescript/bin/tsc", ["-b"]);
// Relative URLs support both the repository subdirectory and static preview hosts.
run("node_modules/vite/bin/vite.js", ["build", "--base=./"]);
const staging = await mkdtemp(path.join(tmpdir(), "signature-studio-pages-"));
git(["init", "--initial-branch=" + publishBranch, staging]);
git(["remote", "add", "origin", expectedRemote], staging);
git(["config", "user.name", git(["config", "user.name"])], staging);
git(["config", "user.email", git(["config", "user.email"])], staging);

if (git(["ls-remote", "--heads", "origin", publishBranch], staging)) {
  git(["fetch", "--depth=1", "origin", publishBranch], staging);
  git(["checkout", "-B", publishBranch, "FETCH_HEAD"], staging);
  const previous = JSON.parse(await readFile(path.join(staging, "version.json"), "utf8"));
  if (previous.deployment !== marker) throw new Error("Refusing to replace an unrelated Pages deployment.");
  for (const entry of await readdir(staging)) {
    if (entry === ".git") continue;
    const target = path.resolve(staging, entry);
    if (path.dirname(target) !== staging) throw new Error("Invalid staging cleanup path.");
    await rm(target, { recursive: true, force: true });
  }
}

await cp(path.join(repo, "dist"), staging, { recursive: true });
await writeFile(path.join(staging, ".nojekyll"), "");
await writeFile(path.join(staging, "version.json"), JSON.stringify({
  deployment: marker, version: "3.0.0-alpha.1", sourceCommit, sourceBranch,
  publishedAt: new Date().toISOString(),
}, null, 2) + "\n");
git(["add", "--all"], staging);
git(["commit", "-m", "Deploy Signature Studio preview from " + sourceCommit.slice(0, 7)], staging);
// A regular push protects against overwriting a concurrent publication.
console.log(git(["push", "origin", publishBranch], staging));
console.log(JSON.stringify({ sourceCommit, pagesCommit: git(["rev-parse", "HEAD"], staging), siteUrl }));
