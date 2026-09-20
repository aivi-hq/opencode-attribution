// Plugin entry. All behaviour lives in attribution.ts, commit-tool.ts and
// redirect.ts; this file only wires the OpenCode context (version, session
// lookup) into them.

import { Plugin } from "@opencode/plugin";
import { createCommitTool } from "./commit-tool.ts";
import { redirectGitCommit } from "./redirect.ts";

export default Plugin.define({
	id: "opencode-attribution",
	async setup(ctx) {
		const tool = createCommitTool({
			version: ctx.app.version,
			harness: ctx.options.harness !== false,
			session: async (sessionID) => {
				const info = await ctx.session.get({ sessionID });
				return { directory: info.location.directory, model: info.model };
			},
		});

		await ctx.tool.transform((editor) => {
			editor.add(tool);
		});

		// The plugin's own permission deny — no configuration needed. It
		// follows the plugin everywhere; a person's terminal is never
		// permission-evaluated, so it is never denied.
		await ctx.permission.hook("evaluate", redirectGitCommit);
	},
});
