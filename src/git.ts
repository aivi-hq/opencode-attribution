// The only place that touches git. execFile without a shell, so arguments are
// arguments and the message is never re-parsed. Failures resolve with the
// exit status instead of rejecting: "nothing to commit" is an answer, not a
// crash.

import { execFile } from "node:child_process";

export interface GitResult {
	code: number;
	stdout: string;
	stderr: string;
}

/** Run git with these arguments, in this directory. */
export function run(args: string[], cwd: string): Promise<GitResult> {
	return new Promise((resolve) => {
		execFile(
			"git",
			args,
			{ cwd, maxBuffer: 16 * 1024 * 1024 },
			(error, stdout, stderr) => {
				// A nonzero exit arrives as `error`; a failed spawn (no git) has a string code.
				const code = error
					? typeof error.code === "number"
						? error.code
						: 1
					: 0;
				resolve({ code, stdout, stderr });
			},
		);
	});
}

/** The value of a git config key as seen from cwd; "" when it is unset. */
export async function configGet(key: string, cwd: string): Promise<string> {
	const result = await run(["config", "--get", key], cwd);
	return result.code === 0 ? result.stdout.trim() : "";
}
