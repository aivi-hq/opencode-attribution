# opencode-attribution

An [OpenCode](https://opencode.ai) plugin that adds a `commit` tool: every
commit an agent makes carries the right attribution automatically.

> [!WARNING]
> **Requires OpenCode 2 or newer.** This plugin is built on the V2 plugin API
> (tool transforms, session context, permission hooks). It will not load on
> OpenCode 1.

## Quick start

```sh
opencode plugin add opencode-attribution
```

Optional — who the co-author is (a repository may override it locally; the
default is `OpenCode <noreply@opencode.ai>`):

```sh
git config --global opencode.coauthor "aivi-agent[bot] <331678708+aivi-agent[bot]@users.noreply.github.com>"
```

That is all. No permission configuration: the plugin denies `git commit` in
the shell tool itself.

## The rule

Attribution follows **who launched the shell**, never what a prompt said:

| Launched by | Commit |
| --- | --- |
| An unattended agent (an [aivi](https://github.com/aivi-hq) worker) | the agent is the sole author and committer — **no trailers** |
| An agent with a person attending | the person is the author; the agent gets a `Co-authored-by` and a `Harness:` line |
| A person in their own terminal | **untouched** |

## What it does

- Registers the `commit` tool — thin over `git commit`: stage with `git add`,
  call the tool with a message (plus optional extra git commit arguments).
- An attended commit gets two trailers via `git commit --trailer`
  (git ≥ 2.22):

  ```text
  Co-authored-by: aivi-agent[bot] <331678708+aivi-agent[bot]@users.noreply.github.com>
  Harness: OpenCode v2.0.11, mlx-serve/Qwen3.8-Flash-Next
  ```

  `Harness:` is one line of debug metadata: the OpenCode version and the
  session's `providerID/modelID`. GitHub renders it as plain text; only
  `Co-authored-by` links to a profile.
- Denies `git commit` through the shell tool, with the commit tool named as
  the reason — agents are redirected, never stuck. OpenCode's permission
  scanner splits chained commands, so `git add x && git commit` is denied
  too. The deny follows the plugin: a global install covers every session on
  the machine; don't install it globally where you don't want it. A person's
  own terminal is never affected — permission evaluation only exists for
  tool calls.

## aivi and `agent.autonomous`

The plugin reads `git config --get agent.autonomous` in the session's working
directory. This is **the default in [aivi](https://github.com/aivi-hq) worker
worktrees**: when aivi launches an unattended worker it sets `user.name` and
`user.email` to the bot and `agent.autonomous = true` per worktree. With the
flag set, the commit tool adds no trailers — the bot is already the author
and committer, and a co-author trailer on the bot's own work would be wrong.

## Known gaps, stated not hidden

- `bash -c 'git commit'` and env-prefixed forms can slip past the deny; the
  plugin only sees what goes through the permission system.
- A machine without the plugin gets no attribution — correct: nothing there
  launched an agent either.
- An attended session inside an autonomous worktree gets no trailers, even
  though a person is attending.

## Development

Node ≥ 26 (the source is type-stripped TypeScript, executed directly), git ≥ 2.22.

```sh
npm install
npm run agentic:verify
```

## License

MIT
