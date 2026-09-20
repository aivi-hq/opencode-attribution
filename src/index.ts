// Plugin entry. All behaviour lives in commit-tool.ts and attribution.ts;
// this file only wires the OpenCode context (version, session lookup) into it.

import { Plugin } from "@opencode/plugin"
import { createCommitTool } from "./commit-tool.ts"

export default Plugin.define({
  id: "opencode-attribution",
  async setup(ctx) {
    const tool = createCommitTool({
      version: ctx.app.version,
      session: async (sessionID) => {
        const info = await ctx.session.get({ sessionID })
        return { directory: info.location.directory, model: info.model }
      },
    })

    await ctx.tool.transform((editor) => {
      editor.add(tool)
    })
  },
})
