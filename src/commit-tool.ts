// The `commit` tool: thin over `git commit` — message in, trailers via
// `git commit --trailer`, no message-file surgery. This module has no runtime
// import of the OpenCode SDK (types only), so tests can build and call the
// tool directly.

import type { Info as ToolInfo } from "@opencode/plugin/promise/tool";
import { DEFAULT_COAUTHOR, isAutonomous, trailers } from "./attribution.ts";
import { configGet, run } from "./git.ts";

export interface Session {
	/** The session's working directory — git runs here. */
	directory: string;
	/** The session's model, when it has one. */
	model?: { id: string; providerID: string } | undefined;
}

export interface CommitToolDeps {
	/** OpenCode version, from `ctx.app.version`. */
	version: string;
	/** Resolve the session behind a tool call: directory and model, from `ctx.session.get`. */
	session: (sessionID: string) => Promise<Session>;
}

const input = {
	type: "object",
	properties: {
		message: {
			type: "string",
			description: "Commit message. Stage the changes first (git add).",
		},
		args: {
			type: "array",
			items: { type: "string" },
			description:
				'Extra git commit arguments, e.g. ["-a"] or ["--amend", "--no-edit"].',
		},
	},
	required: ["message"],
	additionalProperties: false,
};

export function createCommitTool(deps: CommitToolDeps): ToolInfo<typeof input> {
	return {
		name: "commit",
		description:
			"Create a git commit with the correct attribution automatically. Use this for all commits; direct `git commit` commands are disabled.",
		input,
		execute: async (parameters, context) => {
			const { message, args } = parameters as {
				message: string;
				args?: string[];
			};
			const session = await deps.session(context.sessionID);
			const cwd = session.directory;

			const autonomous = isAutonomous(await configGet("agent.autonomous", cwd));
			const coauthor =
				(await configGet("opencode.coauthor", cwd)) || DEFAULT_COAUTHOR;

			const trailerArgs: string[] = [];
			for (const trailer of trailers({
				autonomous,
				coauthor,
				version: deps.version,
				model: session.model,
			})) {
				trailerArgs.push("--trailer", `${trailer.token}: ${trailer.value}`);
			}

			const result = await run(
				["commit", "-m", message, ...trailerArgs, ...(args ?? [])],
				cwd,
			);
			const output = [result.stdout, result.stderr]
				.map((part) => part.trim())
				.filter(Boolean)
				.join("\n");
			if (result.code !== 0) {
				throw new Error(
					output || `git commit failed (exit code ${result.code})`,
				);
			}
			return { content: output || "Committed." };
		},
	};
}
