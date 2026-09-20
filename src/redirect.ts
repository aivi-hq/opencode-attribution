// The redirect: the plugin's own permission deny, so no configuration is
// needed to point agents at the commit tool. The `evaluate` hook runs for
// every allow/ask decision after the configured rules; flipping `effect` to
// "deny" blocks the command and `message` becomes the reason the agent sees.
// Permission evaluation only exists for tool calls, so a person typing
// `git commit` in their own terminal is never affected.

export interface PermissionEvaluationLike {
	readonly action: string;
	readonly resources: readonly string[];
	effect: string;
	message?: string;
}

export const REDIRECT_MESSAGE =
	"git commit is disabled by opencode-attribution — use the commit tool instead (stage with git add first).";

/**
 * The same coverage as the `git commit *` permission rule: the bare command
 * or the command with arguments. OpenCode's scanner already split chained
 * commands into separate resources; whitespace inside one is collapsed here
 * so `git  commit` matches too.
 */
export function isGitCommit(resource: string): boolean {
	const command = resource.trim().replace(/\s+/g, " ");
	return command === "git commit" || command.startsWith("git commit ");
}

export function redirectGitCommit(event: PermissionEvaluationLike): void {
	if (event.action !== "shell") return;
	if (!event.resources.some(isGitCommit)) return;
	event.effect = "deny";
	event.message = REDIRECT_MESSAGE;
}
