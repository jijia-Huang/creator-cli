/**
 * treeToMarkdown output including component summaries (compiled dist).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { treeToMarkdown } = require('../dist/bridge/node-tree-normalize.js');

describe('treeToMarkdown', () => {
    it('includes [cid, ...] when components have cid', () => {
        const root = {
            uuid: 'u1',
            name: 'Root',
            path: 'Root',
            children: [],
            components: [{ cid: 'cc.Canvas', name: 'Canvas' }],
        };
        const md = treeToMarkdown(root);
        assert.match(md, /- Root \[cc\.Canvas\]/);
        assert.match(md, /\(Root\)/);
    });

    it('falls back to name then ? when cid missing', () => {
        const root = {
            uuid: 'u1',
            name: 'N',
            path: 'N',
            children: [],
            components: [{ name: 'cc.Label' }, {}],
        };
        const md = treeToMarkdown(root);
        assert.match(md, /\[cc\.Label, \?\]/);
    });

    it('renders children with indentation and paths', () => {
        const tree = {
            uuid: 'r',
            name: 'Root',
            path: 'Root',
            children: [
                {
                    uuid: 'c',
                    name: 'Child',
                    path: 'Root/Child',
                    children: [],
                    components: [{ cid: 'cc.Sprite' }],
                },
            ],
        };
        const md = treeToMarkdown(tree);
        assert.ok(md.includes('- Root (Root)'));
        assert.ok(md.includes('  - Child [cc.Sprite] (Root/Child)'));
    });

    it('appends truncated markers when flags set', () => {
        const root = {
            uuid: 'u',
            name: 'R',
            path: 'R',
            children: [],
            truncated: true,
            truncatedChildren: true,
        };
        const md = treeToMarkdown(root);
        assert.ok(md.includes('truncated by maxDepth'));
        assert.ok(md.includes('truncated by maxChildren'));
    });
});
