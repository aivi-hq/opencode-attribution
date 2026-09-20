// The attribution decision, as pure logic: no I/O, no git, trivially testable.
//
// The rule: attribution follows who launched the shell, never what a prompt
// said. An unattended worker (aivi) launched it → the bot is already the sole
// author and committer via per-worktree git config, so nothing is added. A
// person is attending the agent → the person is the author, the agent a
// co-author, plus one harness line for debugging.

export const DEFAULT_COAUTHOR = "OpenCode <noreply@opencode.ai>";

/** Interpret the value of `git config --get agent.autonomous` (git booleans are case-insensitive). */
export function isAutonomous(value: string): boolean {
	return ["true", "yes", "on", "1"].includes(value.trim().toLowerCase());
}

export interface Model {
	id: string;
	providerID: string;
}

export interface Decision {
	/** `agent.autonomous` in the effective git config of the session's directory. */
	autonomous: boolean;
	/** `opencode.coauthor`, already defaulted to DEFAULT_COAUTHOR when unset. */
	coauthor: string;
	/** OpenCode version, with or without a leading "v". */
	version: string;
	/** The session's model, when the session has one. */
	model?: Model | undefined;
	/** Plugin option `harness`: include the `Harness:` debug line. */
	harness: boolean;
}

export interface Trailer {
	token: string;
	value: string;
}

/** One debug-metadata line, e.g. `OpenCode v2.0.11, mlx-serve/Qwen3.8-Flash-Next`. */
export function harness(version: string, model?: Model | undefined): string {
	const v = version.startsWith("v") ? version : `v${version}`;
	return model
		? `OpenCode ${v}, ${model.providerID}/${model.id}`
		: `OpenCode ${v}`;
}

/** The trailers a commit gets, in order; empty for autonomous (bot-authored) commits. */
export function trailers(decision: Decision): Trailer[] {
	if (decision.autonomous) return [];
	const result: Trailer[] = [
		{ token: "Co-authored-by", value: decision.coauthor },
	];
	if (decision.harness) {
		result.push({
			token: "Harness",
			value: harness(decision.version, decision.model),
		});
	}
	return result;
}
