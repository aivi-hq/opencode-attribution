// The redirect decision, pure: matcher, chained commands, non-cases.

import assert from "node:assert/strict";
import test from "node:test";

import {
	isGitCommit,
	type PermissionEvaluationLike,
	redirectGitCommit,
} from "../src/redirect.ts";

test("isGitCommit matches the command with or without arguments", () => {
	for (const resource of [
		"git commit",
		"git commit -m x",
		"git  commit\t-m x",
		" git commit -a ",
	]) {
		assert.equal(isGitCommit(resource), true, JSON.stringify(resource));
	}
	for (const resource of [
		"git push",
		"git commit-tree x",
		"echo git commit",
		"git",
		"git log --oneline",
	]) {
		assert.equal(isGitCommit(resource), false, JSON.stringify(resource));
	}
});

test("a chained commit is denied with a redirect reason", () => {
	const event: PermissionEvaluationLike = {
		action: "shell",
		resources: ["git add x", 'git commit -m "y"'],
		effect: "allow",
	};
	redirectGitCommit(event);
	assert.equal(event.effect, "deny");
	assert.match(event.message ?? "", /commit tool/);
});

test("everything else passes through untouched", () => {
	for (const resources of [["git push"], ["git add x", "git log"], ["bash"]]) {
		const event: PermissionEvaluationLike = {
			action: "shell",
			resources,
			effect: "allow",
		};
		redirectGitCommit(event);
		assert.equal(event.effect, "allow");
		assert.equal(event.message, undefined);
	}
	const edit: PermissionEvaluationLike = {
		action: "edit",
		resources: ["git commit"],
		effect: "ask",
	};
	redirectGitCommit(edit);
	assert.equal(edit.effect, "ask");
});
