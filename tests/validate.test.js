/**
 * Unit tests for bridge validate helpers (compiled dist; no Editor).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    requireRemoveComponentParams,
    requireRestoreUuids,
    requireNodeFindParams,
} = require('../dist/bridge/validate.js');

const U32 = 'a1b2c3d4e5f6789012345678abcdef01';
const U32B = 'b2c3d4e5f6789012345678abcdef0123';

function assertInvalidParams(fn) {
    assert.throws(
        fn,
        (err) => err instanceof Error && err.code === 'INVALID_PARAMS',
        'expected INVALID_PARAMS'
    );
}

describe('requireRemoveComponentParams', () => {
    it('returns node ref + component when component is set (uuid path)', () => {
        const r = requireRemoveComponentParams({ uuid: U32, component: ' cc.Sprite ' });
        assert.deepEqual(r, { uuid: U32, component: 'cc.Sprite' });
    });

    it('returns node ref + component when component is set (nodePath path)', () => {
        const r = requireRemoveComponentParams({ nodePath: 'Root/Canvas', component: 'cc.Label' });
        assert.deepEqual(r, { nodePath: 'Root/Canvas', component: 'cc.Label' });
    });

    it('returns single component uuid when component omitted (32 hex)', () => {
        const r = requireRemoveComponentParams({ uuid: U32 });
        assert.deepEqual(r, { uuid: U32 });
    });

    it('returns single component id when component omitted (creator base64-style id)', () => {
        const cid = 'abcdefghijklmnopqrst'; // 20 chars, matches CREATOR_ID_REGEX
        const r = requireRemoveComponentParams({ uuid: cid });
        assert.deepEqual(r, { uuid: cid });
    });

    it('throws when component omitted and uuid is not a valid creator id', () => {
        assertInvalidParams(() => requireRemoveComponentParams({ uuid: 'short' }));
    });

    it('throws when both uuid and nodePath for node+component mode', () => {
        assertInvalidParams(() =>
            requireRemoveComponentParams({ uuid: U32, nodePath: 'Root', component: 'cc.Sprite' })
        );
    });

    it('throws when no valid branch (empty params)', () => {
        assertInvalidParams(() => requireRemoveComponentParams({}));
    });
});

describe('requireRestoreUuids', () => {
    it('returns single uuid array element for uuid', () => {
        const r = requireRestoreUuids({ uuid: U32 });
        assert.deepEqual(r, [U32]);
    });

    it('returns validated uuids array', () => {
        const r = requireRestoreUuids({ uuids: [U32, U32B] });
        assert.deepEqual(r, [U32, U32B]);
    });

    it('returns nodePath when nodePath set and no uuid/uuids conflict', () => {
        const r = requireRestoreUuids({ nodePath: 'Root/MyNode' });
        assert.deepEqual(r, { nodePath: 'Root/MyNode' });
    });

    it('throws when nodePath combined with uuid', () => {
        assertInvalidParams(() => requireRestoreUuids({ nodePath: 'Root', uuid: U32 }));
    });

    it('throws when nodePath combined with non-empty uuids', () => {
        assertInvalidParams(() => requireRestoreUuids({ nodePath: 'Root', uuids: [U32] }));
    });

    it('throws when nothing provided', () => {
        assertInvalidParams(() => requireRestoreUuids({}));
    });

    it('throws when uuids array has invalid entry', () => {
        assertInvalidParams(() => requireRestoreUuids({ uuids: [U32, 'bad'] }));
    });
});

describe('requireNodeFindParams', () => {
    it('accepts name only', () => {
        assert.deepEqual(requireNodeFindParams({ name: ' Foo ' }), { name: 'Foo' });
    });

    it('accepts component only', () => {
        assert.deepEqual(requireNodeFindParams({ component: ' cc.Sprite ' }), { component: 'cc.Sprite' });
    });

    it('accepts both name and component', () => {
        assert.deepEqual(requireNodeFindParams({ name: 'a', component: 'b' }), { name: 'a', component: 'b' });
    });

    it('throws when both missing or empty', () => {
        assertInvalidParams(() => requireNodeFindParams({}));
        assertInvalidParams(() => requireNodeFindParams({ name: '', component: '  ' }));
    });
});
