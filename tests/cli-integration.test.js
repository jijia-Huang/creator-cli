/**
 * CLI integration: spawn bin/creator-cli.js to verify parse/usage paths without Editor TCP.
 * Does not cover successful Bridge calls (would need a running Creator).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'bin', 'creator-cli.js');

function runCli(args) {
    return spawnSync(process.execPath, [CLI, ...args], {
        encoding: 'utf8',
        env: { ...process.env, CREATOR_CLI_PORT: '6868' },
    });
}

describe('creator-cli.js (spawn)', () => {
    it('exits 0 for --help', () => {
        const r = runCli(['--help']);
        assert.equal(r.status, 0);
        assert.match(r.stdout || '', /CreatorCLI|子命令/);
    });

    it('exits 1 for unknown subcommand', () => {
        const r = runCli(['not-a-real-subcommand-ever']);
        assert.equal(r.status, 1);
    });

    it('exits 1 when init port not in whitelist', () => {
        const r = runCli(['init', '9999']);
        assert.equal(r.status, 1);
        assert.match(r.stderr || '', /6868|6870|6872|用法/);
    });

    it('exits 1 when resolve-node has no path (buildParams null)', () => {
        const r = runCli(['resolve-node']);
        assert.equal(r.status, 1);
        assert.match(r.stderr || '', /用法/);
    });

    it('exits 1 when node.find missing --name and --component', () => {
        const r = runCli(['node.find']);
        assert.equal(r.status, 1);
    });

    it('exits 1 when scene.create missing assetPath', () => {
        const r = runCli(['scene.create']);
        assert.equal(r.status, 1);
    });

    it('exits 1 when prefab.create missing arguments', () => {
        const r = runCli(['prefab.create']);
        assert.equal(r.status, 1);
    });
});
