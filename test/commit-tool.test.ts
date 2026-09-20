// The tool itself, called directly with a fake OpenCode context against real
// throwaway git repos. Everything above the git boundary is faked; git is not.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import type { ToolContext } from "@opencode/plugin/promise/tool";

import { createCommitTool, type Session } from "../src/commit-tool.ts";

const dirs: string[] = [];

after(async () => {
	await Promise.all(
		dirs.map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** A repo with one staged file and a human identity, isolated from the machine's git config. */
async function stagedRepo(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "opencode-attribution-test-"));
	dirs.push(dir);
	git(dir, "init", "-q", "-b", "main");
	git(dir, "config", "user.name", "Alice");
	git(dir, "config", "user.email", "alice@example.com");
	git(dir, "config", "commit.gpgsign", "false");
	git(dir, "config", "core.hooksPath", join(dir, "no-hooks"));
	await writeFile(join(dir, "a.txt"), "hello\n");
	git(dir, "add", "a.txt");
	return dir;
}

/** Build the real tool over a fake session and call its execute directly. */
async function committed(
	message: string,
	session: Partial<Session> & { directory: string },
	args?: string[],
): Promise<string> {
	const tool = createCommitTool({
		version: "2.0.11",
		session: async () => ({
			directory: session.directory,
			model: session.model,
		}),
	});
	const context = {
		sessionID: "ses_test",
		agent: "build",
		messageID: "msg_test",
		id: "call_test",
		progress: async () => {},
	} as unknown as ToolContext;
	const result = await tool.execute(
		{ message, ...(args ? { args } : {}) },
		context,
	);
	return typeof result.content === "string" ? result.content : "";
}

const model = { id: "Qwen3.8-Flash-Next", providerID: "mlx-serve" };

test("an attended commit gains the trailers; the person stays the author", async () => {
	const dir = await stagedRepo();
	const output = await committed("Add a file", { directory: dir, model });

	assert.match(output, /a\.txt/); // git's own report comes back to the agent
	assert.deepEqual(git(dir, "log", "-1", "--pretty=%B").split("\n"), [
		"Add a file",
		"",
		"Co-authored-by: OpenCode <noreply@opencode.ai>",
		"Harness: OpenCode v2.0.11, mlx-serve/Qwen3.8-Flash-Next",
	]);
	assert.equal(
		git(dir, "log", "-1", "--pretty=%an <%ae>"),
		"Alice <alice@example.com>",
	);
	assert.equal(
		git(dir, "log", "-1", "--pretty=%cn <%ce>"),
		"Alice <alice@example.com>",
	);
});

test("an existing message body is preserved, trailers are appended last", async () => {
	const dir = await stagedRepo();
	await committed("Add a file\n\nBecause the plan says so.", {
		directory: dir,
		model,
	});
	assert.deepEqual(git(dir, "log", "-1", "--pretty=%B").split("\n"), [
		"Add a file",
		"",
		"Because the plan says so.",
		"",
		"Co-authored-by: OpenCode <noreply@opencode.ai>",
		"Harness: OpenCode v2.0.11, mlx-serve/Qwen3.8-Flash-Next",
	]);
});

test("opencode.coauthor overrides the default co-author", async () => {
	const dir = await stagedRepo();
	const bot =
		"aivi-agent[bot] <331678708+aivi-agent[bot]@users.noreply.github.com>";
	git(dir, "config", "opencode.coauthor", bot);
	await committed("Add a file", { directory: dir, model });
	assert.ok(
		git(dir, "log", "-1", "--pretty=%B").includes(`Co-authored-by: ${bot}`),
	);
});

test("an autonomous worktree commits untouched, bot author intact", async () => {
	const dir = await stagedRepo();
	git(dir, "config", "agent.autonomous", "true");
	git(dir, "config", "user.name", "aivi-agent[bot]");
	git(
		dir,
		"config",
		"user.email",
		"331678708+aivi-agent[bot]@users.noreply.github.com",
	);
	await committed("Add a file", { directory: dir, model });

	assert.deepEqual(git(dir, "log", "-1", "--pretty=%B").split("\n"), [
		"Add a file",
	]);
	assert.equal(
		git(dir, "log", "-1", "--pretty=%an <%ae>"),
		"aivi-agent[bot] <331678708+aivi-agent[bot]@users.noreply.github.com>",
	);
});

test("a session without a model still gets a harness line", async () => {
	const dir = await stagedRepo();
	await committed("Add a file", { directory: dir });
	assert.match(
		git(dir, "log", "-1", "--pretty=%B"),
		/^Harness: OpenCode v2\.0\.11$/m,
	);
});

test("extra git arguments pass through", async () => {
	const dir = await stagedRepo();
	await committed("Add a file", { directory: dir, model });
	await committed("Add a file, amended", { directory: dir, model }, [
		"--amend",
		"--no-edit",
	]);
	assert.deepEqual(git(dir, "log", "-1", "--pretty=%B").split("\n"), [
		"Add a file, amended",
		"",
		"Co-authored-by: OpenCode <noreply@opencode.ai>",
		"Harness: OpenCode v2.0.11, mlx-serve/Qwen3.8-Flash-Next",
	]);
});

test("nothing staged fails with git's own message", async () => {
	const dir = await stagedRepo();
	await committed("Add a file", { directory: dir, model });
	await assert.rejects(
		() => committed("Nothing left", { directory: dir, model }),
		/nothing to commit/,
	);
});
