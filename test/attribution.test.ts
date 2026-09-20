// The decision logic, with no git and no OpenCode in sight.

import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_COAUTHOR,
	harness,
	isAutonomous,
	trailers,
} from "../src/attribution.ts";

test("isAutonomous interprets git config booleans", () => {
	for (const value of ["true", "True", "TRUE", " true ", "yes", "on", "1"]) {
		assert.equal(isAutonomous(value), true, value);
	}
	for (const value of ["", "false", "no", "off", "0", "banana"]) {
		assert.equal(isAutonomous(value), false, JSON.stringify(value));
	}
});

test("an autonomous (worker-launched) commit gets no trailers", () => {
	assert.deepEqual(
		trailers({
			autonomous: true,
			coauthor: DEFAULT_COAUTHOR,
			version: "2.0.11",
			model: { id: "Qwen3.8-Flash-Next", providerID: "mlx-serve" },
			harness: true,
		}),
		[],
	);
});

test("an attended commit gets the co-author and the harness line, in order", () => {
	assert.deepEqual(
		trailers({
			autonomous: false,
			coauthor: DEFAULT_COAUTHOR,
			version: "2.0.11",
			model: { id: "Qwen3.8-Flash-Next", providerID: "mlx-serve" },
			harness: true,
		}),
		[
			{ token: "Co-authored-by", value: "OpenCode <noreply@opencode.ai>" },
			{
				token: "Harness",
				value: "OpenCode v2.0.11, mlx-serve/Qwen3.8-Flash-Next",
			},
		],
	);
});

test("a configured co-author is used verbatim", () => {
	const bot =
		"aivi-agent[bot] <331678708+aivi-agent[bot]@users.noreply.github.com>";
	const [first] = trailers({
		autonomous: false,
		coauthor: bot,
		version: "2.0.11",
		harness: true,
	});
	assert.deepEqual(first, { token: "Co-authored-by", value: bot });
});

test("the harness option off keeps only the co-author", () => {
	assert.deepEqual(
		trailers({
			autonomous: false,
			coauthor: DEFAULT_COAUTHOR,
			version: "2.0.11",
			model: { id: "m", providerID: "p" },
			harness: false,
		}),
		[{ token: "Co-authored-by", value: "OpenCode <noreply@opencode.ai>" }],
	);
});

test("the harness line normalizes the version and survives a missing model", () => {
	assert.equal(harness("2.0.11"), "OpenCode v2.0.11");
	assert.equal(harness("v2.0.11"), "OpenCode v2.0.11");
	assert.equal(
		harness("2.1.0", { id: "m", providerID: "p" }),
		"OpenCode v2.1.0, p/m",
	);
	assert.equal(harness("2.1.0"), "OpenCode v2.1.0");
});
