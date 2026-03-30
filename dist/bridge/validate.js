"use strict";
/**
 * Bridge 參數驗證（對齊安全策略：UUID 格式、無路徑穿越）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUuid = isValidUuid;
exports.isValidCreatorId = isValidCreatorId;
exports.requireUuid = requireUuid;
exports.requireNodePathOrUuid = requireNodePathOrUuid;
exports.optionalNodePathOrUuid = optionalNodePathOrUuid;
exports.requireRestoreUuids = requireRestoreUuids;
exports.requirePath = requirePath;
exports.requireCreateComponentParams = requireCreateComponentParams;
exports.requireResolveComponentParams = requireResolveComponentParams;
exports.requireRemoveComponentParams = requireRemoveComponentParams;
exports.requireCreateNodeParams = requireCreateNodeParams;
exports.requireRemoveNodeParams = requireRemoveNodeParams;
exports.requireSetPropertyParams = requireSetPropertyParams;
exports.requirePrefabInstantiateParams = requirePrefabInstantiateParams;
exports.requirePrefabCreateParams = requirePrefabCreateParams;
exports.requireSceneCreateParams = requireSceneCreateParams;
exports.requireSceneOpenParams = requireSceneOpenParams;
exports.requireResetPropertyParams = requireResetPropertyParams;
exports.requireNodeFindParams = requireNodeFindParams;
exports.requireNodeDuplicateParams = requireNodeDuplicateParams;
exports.requirePrefabCopyParams = requirePrefabCopyParams;
/** Cocos Creator 節點／資源 UUID：32 個十六進位字元 */
const UUID_REGEX = /^[a-fA-F0-9]{32}$/;
/** Creator 編輯器常見的 base64 風格 id（約 22 字元），用於節點／組件識別 */
const CREATOR_ID_REGEX = /^[A-Za-z0-9+/=-]{20,44}$/;
/**
 * 驗證是否為合法 UUID 格式（32 位 hex），防止路徑穿越或非法輸入。
 * @param value 待驗證字串
 * @returns 是否通過驗證
 */
function isValidUuid(value) {
    return typeof value === 'string' && UUID_REGEX.test(value);
}
/**
 * 驗證是否為 Creator 可接受的 id：32 位 hex 或編輯器常見的 base64 風格 id。
 * 用於 create-component、remove-component、set-property、reset-property 等，因編輯器可能傳回 base64 格式。
 */
function isValidCreatorId(value) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 64)
        return false;
    return UUID_REGEX.test(value) || CREATOR_ID_REGEX.test(value);
}
/**
 * 驗證 params 中必填的單一 uuid 欄位；失敗時拋出錯誤碼供上層回傳。
 */
function requireUuid(params, field) {
    const v = params[field];
    if (!isValidUuid(v)) {
        const err = new Error('INVALID_PARAMS');
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    return v;
}
/**
 * 驗證 params 提供 uuid 或 nodePath 二選一（用於 set-property、reset-property 等可依路徑尋址的 method）。
 * @returns 若為 uuid 則 { uuid }，若為 nodePath 則 { nodePath }；僅能其一。
 */
function requireNodePathOrUuid(params) {
    const hasUuid = isValidUuid(params.uuid);
    const nodePath = params.nodePath;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasUuid && !hasNodePath) {
        return { uuid: params.uuid };
    }
    if (hasNodePath && !hasUuid) {
        return { nodePath: nodePath.trim() };
    }
    throwInvalidParams();
}
/**
 * 可選的 uuid 或 nodePath（用於 create-node 的 parent：可省略表示根節點）。
 * @returns {} 當兩者皆無；否則 { uuid } 或 { nodePath } 其一。
 */
function optionalNodePathOrUuid(params) {
    const hasUuid = isValidUuid(params.uuid);
    const nodePath = params.nodePath;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasUuid && !hasNodePath) {
        return { uuid: params.uuid };
    }
    if (hasNodePath && !hasUuid) {
        return { nodePath: nodePath.trim() };
    }
    return {};
}
/**
 * 驗證 params 為 restore 用：單一 uuid、uuids 陣列，或單一 nodePath。
 */
function requireRestoreUuids(params) {
    const uuid = params.uuid;
    const uuids = params.uuids;
    const nodePath = params.nodePath;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasNodePath) {
        if (isValidUuid(uuid) || (Array.isArray(uuids) && uuids.length > 0)) {
            throwInvalidParams();
        }
        return { nodePath: nodePath.trim() };
    }
    if (isValidUuid(uuid)) {
        return [uuid];
    }
    if (Array.isArray(uuids) && uuids.length > 0) {
        const out = [];
        for (const u of uuids) {
            if (!isValidUuid(u)) {
                throwInvalidParams();
            }
            out.push(u);
        }
        return out;
    }
    throwInvalidParams();
}
function throwInvalidParams() {
    const err = new Error('INVALID_PARAMS');
    err.code = 'INVALID_PARAMS';
    throw err;
}
/**
 * 驗證 path 為非空字串（set-property / reset-property 用）。
 * path 可為型別 path（如 cc.Sprite.spriteFrame）或既有 __comps__.N.xxx / name 等。
 */
function requirePath(params, field) {
    const v = params[field];
    if (typeof v !== 'string' || v.trim() === '') {
        throwInvalidParams();
    }
    return v;
}
/**
 * 驗證 params 中必填的 Creator id（32 hex 或 base64 風格）；失敗時拋出 INVALID_PARAMS。
 */
function requireCreatorId(params, field) {
    const v = params[field];
    if (!isValidCreatorId(v)) {
        const err = new Error('INVALID_PARAMS');
        err.code = 'INVALID_PARAMS';
        throw err;
    }
    return v;
}
/**
 * 驗證 create-component 參數：節點為 uuid 或 nodePath 二選一、component（類名字串）。
 */
function requireCreateComponentParams(params) {
    const ref = requireNodePathOrUuid(params);
    const component = params.component;
    if (typeof component !== 'string' || component.trim() === '') {
        throwInvalidParams();
    }
    return Object.assign(Object.assign({}, ref), { component: component.trim() });
}
/**
 * 驗證 resolve-component 參數：節點為 uuid 或 nodePath 二選一、component（組件類名，如 cc.Sprite）。
 */
function requireResolveComponentParams(params) {
    const ref = requireNodePathOrUuid(params);
    const component = params.component;
    if (typeof component !== 'string' || component.trim() === '') {
        throwInvalidParams();
    }
    return Object.assign(Object.assign({}, ref), { component: component.trim() });
}
/**
 * 驗證 remove-component：單一組件 uuid，或 nodePath|nodeUuid + component 類名。
 */
function requireRemoveComponentParams(params) {
    const hasComponent = typeof params.component === 'string' && params.component.trim() !== '';
    if (hasComponent) {
        return Object.assign(Object.assign({}, requireNodePathOrUuid(params)), { component: params.component.trim() });
    }
    return { uuid: requireCreatorId(params, 'uuid') };
}
/**
 * 驗證 create-node 參數：可選 parent 為 uuid 或 nodePath；其餘與 Editor CreateNodeOptions 相容。
 */
function requireCreateNodeParams(params) {
    if (params === null || typeof params !== 'object' || Array.isArray(params)) {
        throwInvalidParams();
    }
    const ref = optionalNodePathOrUuid(params);
    return Object.assign(Object.assign({}, params), ref);
}
/**
 * 驗證 remove-node 參數：uuid 單一或陣列，或 nodePath（單一節點）；可選 keepWorldTransform。
 */
function requireRemoveNodeParams(params) {
    const uuid = params.uuid;
    const nodePath = params.nodePath;
    const keepWorldTransform = params.keepWorldTransform;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasNodePath && (uuid === undefined || uuid === null)) {
        return Object.assign({ nodePath: nodePath.trim() }, (typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {}));
    }
    if (isValidCreatorId(uuid)) {
        return Object.assign({ uuid }, (typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {}));
    }
    if (Array.isArray(uuid) && uuid.length > 0) {
        for (const u of uuid) {
            if (!isValidCreatorId(u)) {
                throwInvalidParams();
            }
        }
        return Object.assign({ uuid }, (typeof keepWorldTransform === 'boolean' ? { keepWorldTransform } : {}));
    }
    throwInvalidParams();
}
/**
 * set-property 參數：節點為 uuid 或 nodePath 二選一、path 必填；dump 與 value 二選一，若同時存在以 dump 為準。
 * value 允許 string（資源路徑 db: / db:// / assets/）或物件（如 { __uuid__ }）；向後相容既有 __uuid__ 寫法。
 */
function requireSetPropertyParams(params) {
    const ref = requireNodePathOrUuid(params);
    const path = requirePath(params, 'path');
    const hasDump = params.dump !== undefined && params.dump !== null && typeof params.dump === 'object' && !Array.isArray(params.dump);
    const hasValue = params.value !== undefined;
    if (!hasDump && !hasValue) {
        throwInvalidParams();
    }
    const record = params.record;
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, ref), { path }), (hasDump ? { dump: params.dump } : {})), (hasDump ? {} : { value: params.value })), (typeof record === 'boolean' ? { record } : {}));
}
/**
 * prefab.instantiate 參數：prefab 必填（prefab 資源 uuid 或 assetPath）；parent 可選（節點 uuid 或 nodePath，省略則掛在根節點下）。
 */
function requirePrefabInstantiateParams(params) {
    if (params === null || typeof params !== 'object' || Array.isArray(params)) {
        throwInvalidParams();
    }
    const prefabUuid = params.prefabUuid;
    const prefabAssetPath = params.prefabAssetPath;
    const hasPrefabUuid = isValidUuid(prefabUuid);
    const hasPrefabPath = typeof prefabAssetPath === 'string' && prefabAssetPath.trim() !== '';
    if (!hasPrefabUuid && !hasPrefabPath) {
        throwInvalidParams();
    }
    if (hasPrefabUuid && hasPrefabPath) {
        throwInvalidParams();
    }
    const parent = params.parent;
    const parentPath = params.parentPath;
    const hasParent = isValidUuid(parent);
    const hasParentPath = typeof parentPath === 'string' && parentPath.trim() !== '' && !String(parentPath).startsWith('db:');
    if (hasPrefabUuid) {
        if (hasParent)
            return { prefabUuid: prefabUuid, parent: parent };
        if (hasParentPath)
            return { prefabUuid: prefabUuid, parentPath: parentPath.trim() };
        return { prefabUuid: prefabUuid };
    }
    if (hasPrefabPath) {
        if (hasParent)
            return { prefabAssetPath: prefabAssetPath.trim(), parent: parent };
        if (hasParentPath)
            return { prefabAssetPath: prefabAssetPath.trim(), parentPath: parentPath.trim() };
        return { prefabAssetPath: prefabAssetPath.trim() };
    }
    throwInvalidParams();
}
/**
 * prefab.create 參數：nodeUuid 或 nodePath 二選一（根節點）、assetPath 必填（新 prefab 資源路徑）。
 */
function requirePrefabCreateParams(params) {
    const assetPath = params.assetPath;
    if (typeof assetPath !== 'string' || assetPath.trim() === '') {
        throwInvalidParams();
    }
    const hasNodeUuid = isValidUuid(params.nodeUuid);
    const nodePath = params.nodePath;
    const hasNodePath = typeof nodePath === 'string' && nodePath.trim() !== '' && !nodePath.startsWith('db:');
    if (hasNodeUuid && !hasNodePath) {
        return { nodeUuid: params.nodeUuid, assetPath: assetPath.trim() };
    }
    if (hasNodePath && !hasNodeUuid) {
        return { nodePath: nodePath.trim(), assetPath: assetPath.trim() };
    }
    throwInvalidParams();
}
/**
 * scene.create 參數：assetPath 必填；open 可選（建立後是否開啟）。
 */
function requireSceneCreateParams(params) {
    const assetPath = params.assetPath;
    if (typeof assetPath !== 'string' || assetPath.trim() === '') {
        throwInvalidParams();
    }
    const open = params.open;
    return Object.assign({ assetPath: assetPath.trim() }, (typeof open === 'boolean' ? { open } : {}));
}
/**
 * scene.open 參數：uuid 或 assetPath 二選一。assetPath 可為 db:、db:// 或專案相對路徑。
 */
function requireSceneOpenParams(params) {
    const hasUuid = isValidUuid(params.uuid);
    const assetPath = params.assetPath;
    const hasAssetPath = typeof assetPath === 'string' && assetPath.trim() !== '';
    if (hasUuid && !hasAssetPath) {
        return { uuid: params.uuid };
    }
    if (hasAssetPath && !hasUuid) {
        return { assetPath: assetPath.trim() };
    }
    throwInvalidParams();
}
/**
 * reset-property 參數：節點為 uuid 或 nodePath 二選一、path 必填；可選 dump、record。
 */
function requireResetPropertyParams(params) {
    const ref = requireNodePathOrUuid(params);
    const path = requirePath(params, 'path');
    const hasDump = params.dump !== undefined && params.dump !== null && typeof params.dump === 'object' && !Array.isArray(params.dump);
    const record = params.record;
    return Object.assign(Object.assign(Object.assign(Object.assign({}, ref), { path }), (hasDump ? { dump: params.dump } : {})), (typeof record === 'boolean' ? { record } : {}));
}
/** node.find：至少 name 或 component 其一 */
function requireNodeFindParams(params) {
    const name = params.name;
    const component = params.component;
    const hasName = typeof name === 'string' && name.trim() !== '';
    const hasComp = typeof component === 'string' && component.trim() !== '';
    if (!hasName && !hasComp) {
        throwInvalidParams();
    }
    return Object.assign(Object.assign({}, (hasName ? { name: name.trim() } : {})), (hasComp ? { component: component.trim() } : {}));
}
/** node.duplicate：來源節點 uuid|nodePath；可選 parentUuid|parentPath、name */
function requireNodeDuplicateParams(params) {
    const source = requireNodePathOrUuid(params);
    const parentUuid = params.parentUuid;
    const parentPath = params.parentPath;
    let parent;
    const hasPU = isValidUuid(parentUuid);
    const hasPP = typeof parentPath === 'string' && parentPath.trim() !== '' && !parentPath.startsWith('db:');
    if (hasPU && !hasPP) {
        parent = { uuid: parentUuid };
    }
    else if (hasPP && !hasPU) {
        parent = { nodePath: parentPath.trim() };
    }
    else if (hasPU && hasPP) {
        throwInvalidParams();
    }
    const name = params.name;
    return Object.assign(Object.assign({ source }, (parent !== undefined ? { parent } : {})), (typeof name === 'string' && name.trim() !== '' ? { name: name.trim() } : {}));
}
/** prefab.copy：來源 uuid 或 assetPath；dest 必填 */
function requirePrefabCopyParams(params) {
    const destAssetPath = params.destAssetPath;
    if (typeof destAssetPath !== 'string' || destAssetPath.trim() === '') {
        throwInvalidParams();
    }
    const dest = destAssetPath.trim();
    const srcUuid = params.srcUuid;
    const srcAssetPath = params.srcAssetPath;
    if (typeof srcAssetPath === 'string' && srcAssetPath.trim() !== '') {
        if (isValidUuid(srcUuid)) {
            throwInvalidParams();
        }
        return { srcAssetPath: srcAssetPath.trim(), destAssetPath: dest };
    }
    if (isValidUuid(srcUuid)) {
        return { srcUuid: srcUuid, destAssetPath: dest };
    }
    throwInvalidParams();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvYnJpZGdlL3ZhbGlkYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7QUFhSCxrQ0FFQztBQU1ELDRDQUdDO0FBS0Qsa0NBUUM7QUFNRCxzREFXQztBQU1ELHdEQVdDO0FBUUQsa0RBeUJDO0FBWUQsa0NBTUM7QUFxQkQsb0VBT0M7QUFLRCxzRUFPQztBQUtELG9FQVFDO0FBS0QsMERBTUM7QUFLRCwwREFnQ0M7QUFNRCw0REFxQkM7QUFLRCx3RUErQkM7QUFLRCw4REFpQkM7QUFLRCw0REFVQztBQUtELHdEQVdDO0FBS0QsZ0VBZUM7QUFHRCxzREFZQztBQUdELGdFQXdCQztBQUdELDBEQWtCQztBQXBhRCwwQ0FBMEM7QUFDMUMsTUFBTSxVQUFVLEdBQUcsbUJBQW1CLENBQUM7QUFFdkMscURBQXFEO0FBQ3JELE1BQU0sZ0JBQWdCLEdBQUcsMEJBQTBCLENBQUM7QUFFcEQ7Ozs7R0FJRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxLQUFjO0lBQ3RDLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDL0QsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLGdCQUFnQixDQUFDLEtBQWM7SUFDM0MsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxFQUFFO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDckYsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixXQUFXLENBQUMsTUFBK0IsRUFBRSxLQUFhO0lBQ3RFLE1BQU0sQ0FBQyxHQUFH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ronlhajnrZbnlaXvvJpVVUlEIOagvOW8j+OAgeeEoei3r+W+keepv+i2iu+8iVxyXG4gKi9cclxuXHJcbi8qKiBDb2NvcyBDcmVhdG9yIOevgOm7nu+8j+izh+a6kCBVVUlE77yaMzIg5YCL5Y2B5YWt6YCy5L2N5a2X5YWDICovXHJcbmNvbnN0IFVVSURfUkVHRVggPSAvXlthLWZBLUYwLTldezMyfSQvO1xyXG5cclxuLyoqIENyZWF0b3Ig57eo6Lyv5Zmo5bi46KaL55qEIGJhc2U2NCDpoqjmoLwgaWTvvIjntIQgMjIg5a2X5YWD77yJ77yM55So5pa856+A6bue77yP57WE5Lu26K2Y5YilICovXHJcbmNvbnN0IENSRUFUT1JfSURfUkVHRVggPSAvXltBLVphLXowLTkrLz0tXXsyMCw0NH0kLztcclxuXHJcbi8qKlxyXG4gKiDpqZforYnmmK/lkKbngrrlkIjms5UgVVVJRCDmoLzlvI/vvIgzMiDkvY0gaGV477yJ77yM6Ziy5q2i6Lev5b6R56m/6LaK5oiW6Z2e5rOV6Ly45YWl44CCXHJcbiAqIEBwYXJhbSB2YWx1ZSDlvoXpqZforYnlrZfkuLJcclxuICogQHJldHVybnMg5piv5ZCm6YCa6YGO6amX6K2JXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZFV1aWQodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgVVVJRF9SRUdFWC50ZXN0KHZhbHVlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIOmpl+itieaYr+WQpueCuiBDcmVhdG9yIOWPr+aOpeWPl+eahCBpZO+8mjMyIOS9jSBoZXgg5oiW57eo6Lyv5Zmo5bi46KaL55qEIGJhc2U2NCDpoqjmoLwgaWTjgIJcclxuICog55So5pa8IGNyZWF0ZS1jb21wb25lbnTjgIFyZW1vdmUtY29tcG9uZW5044CBc2V0LXByb3BlcnR544CBcmVzZXQtcHJvcGVydHkg562J77yM5Zug57eo6Lyv5Zmo5Y+v6IO95YKz5ZueIGJhc2U2NCDmoLzlvI/jgIJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkQ3JlYXRvcklkKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcclxuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnIHx8IHZhbHVlLmxlbmd0aCA8IDEgfHwgdmFsdWUubGVuZ3RoID4gNjQpIHJldHVybiBmYWxzZTtcclxuICAgIHJldHVybiBVVUlEX1JFR0VYLnRlc3QodmFsdWUpIHx8IENSRUFUT1JfSURfUkVHRVgudGVzdCh2YWx1ZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDpqZforYkgcGFyYW1zIOS4reW/heWhq+eahOWWruS4gCB1dWlkIOashOS9je+8m+WkseaVl+aZguaLi+WHuumMr+iqpOeivOS+m+S4iuWxpOWbnuWCs+OAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVVdWlkKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIGZpZWxkOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgdiA9IHBhcmFtc1tmaWVsZF07XHJcbiAgICBpZiAoIWlzVmFsaWRVdWlkKHYpKSB7XHJcbiAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdJTlZBTElEX1BBUkFNUycpIGFzIEVycm9yICYgeyBjb2RlPzogc3RyaW5nIH07XHJcbiAgICAgICAgZXJyLmNvZGUgPSAnSU5WQUxJRF9QQVJBTVMnO1xyXG4gICAgICAgIHRocm93IGVycjtcclxuICAgIH1cclxuICAgIHJldHVybiB2O1xyXG59XHJcblxyXG4vKipcclxuICog6amX6K2JIHBhcmFtcyDmj5DkvpsgdXVpZCDmiJYgbm9kZVBhdGgg5LqM6YG45LiA77yI55So5pa8IHNldC1wcm9wZXJ0eeOAgXJlc2V0LXByb3BlcnR5IOetieWPr+S+nei3r+W+keWwi+WdgOeahCBtZXRob2TvvInjgIJcclxuICogQHJldHVybnMg6Iul54K6IHV1aWQg5YmHIHsgdXVpZCB977yM6Iul54K6IG5vZGVQYXRoIOWJhyB7IG5vZGVQYXRoIH3vvJvlg4Xog73lhbbkuIDjgIJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlTm9kZVBhdGhPclV1aWQocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHsgdXVpZDogc3RyaW5nIH0gfCB7IG5vZGVQYXRoOiBzdHJpbmcgfSB7XHJcbiAgICBjb25zdCBoYXNVdWlkID0gaXNWYWxpZFV1aWQocGFyYW1zLnV1aWQpO1xyXG4gICAgY29uc3Qgbm9kZVBhdGggPSBwYXJhbXMubm9kZVBhdGg7XHJcbiAgICBjb25zdCBoYXNOb2RlUGF0aCA9IHR5cGVvZiBub2RlUGF0aCA9PT0gJ3N0cmluZycgJiYgbm9kZVBhdGgudHJpbSgpICE9PSAnJyAmJiAhbm9kZVBhdGguc3RhcnRzV2l0aCgnZGI6Jyk7XHJcbiAgICBpZiAoaGFzVXVpZCAmJiAhaGFzTm9kZVBhdGgpIHtcclxuICAgICAgICByZXR1cm4geyB1dWlkOiBwYXJhbXMudXVpZCBhcyBzdHJpbmcgfTtcclxuICAgIH1cclxuICAgIGlmIChoYXNOb2RlUGF0aCAmJiAhaGFzVXVpZCkge1xyXG4gICAgICAgIHJldHVybiB7IG5vZGVQYXRoOiAobm9kZVBhdGggYXMgc3RyaW5nKS50cmltKCkgfTtcclxuICAgIH1cclxuICAgIHRocm93SW52YWxpZFBhcmFtcygpO1xyXG59XHJcblxyXG4vKipcclxuICog5Y+v6YG455qEIHV1aWQg5oiWIG5vZGVQYXRo77yI55So5pa8IGNyZWF0ZS1ub2RlIOeahCBwYXJlbnTvvJrlj6/nnIHnlaXooajnpLrmoLnnr4Dpu57vvInjgIJcclxuICogQHJldHVybnMge30g55W25YWp6ICF55qG54Sh77yb5ZCm5YmHIHsgdXVpZCB9IOaIliB7IG5vZGVQYXRoIH0g5YW25LiA44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gb3B0aW9uYWxOb2RlUGF0aE9yVXVpZChwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KToge30gfCB7IHV1aWQ6IHN0cmluZyB9IHwgeyBub2RlUGF0aDogc3RyaW5nIH0ge1xyXG4gICAgY29uc3QgaGFzVXVpZCA9IGlzVmFsaWRVdWlkKHBhcmFtcy51dWlkKTtcclxuICAgIGNvbnN0IG5vZGVQYXRoID0gcGFyYW1zLm5vZGVQYXRoO1xyXG4gICAgY29uc3QgaGFzTm9kZVBhdGggPSB0eXBlb2Ygbm9kZVBhdGggPT09ICdzdHJpbmcnICYmIG5vZGVQYXRoLnRyaW0oKSAhPT0gJycgJiYgIW5vZGVQYXRoLnN0YXJ0c1dpdGgoJ2RiOicpO1xyXG4gICAgaWYgKGhhc1V1aWQgJiYgIWhhc05vZGVQYXRoKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgdXVpZDogcGFyYW1zLnV1aWQgYXMgc3RyaW5nIH07XHJcbiAgICB9XHJcbiAgICBpZiAoaGFzTm9kZVBhdGggJiYgIWhhc1V1aWQpIHtcclxuICAgICAgICByZXR1cm4geyBub2RlUGF0aDogKG5vZGVQYXRoIGFzIHN0cmluZykudHJpbSgpIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4ge307XHJcbn1cclxuXHJcbi8qKiByZXN0b3Jl77ya5Zau5LiA77yP5aSa5YCLIHV1aWTvvIzmiJbllq7kuIAgbm9kZVBhdGjvvIjkuI3lkKsgZGI677yJICovXHJcbmV4cG9ydCB0eXBlIFJlc3RvcmVVdWlkc0lucHV0ID0gc3RyaW5nW10gfCB7IG5vZGVQYXRoOiBzdHJpbmcgfTtcclxuXHJcbi8qKlxyXG4gKiDpqZforYkgcGFyYW1zIOeCuiByZXN0b3JlIOeUqO+8muWWruS4gCB1dWlk44CBdXVpZHMg6Zmj5YiX77yM5oiW5Zau5LiAIG5vZGVQYXRo44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVJlc3RvcmVVdWlkcyhwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUmVzdG9yZVV1aWRzSW5wdXQge1xyXG4gICAgY29uc3QgdXVpZCA9IHBhcmFtcy51dWlkO1xyXG4gICAgY29uc3QgdXVpZHMgPSBwYXJhbXMudXVpZHM7XHJcbiAgICBjb25zdCBub2RlUGF0aCA9IHBhcmFtcy5ub2RlUGF0aDtcclxuICAgIGNvbnN0IGhhc05vZGVQYXRoID0gdHlwZW9mIG5vZGVQYXRoID09PSAnc3RyaW5nJyAmJiBub2RlUGF0aC50cmltKCkgIT09ICcnICYmICFub2RlUGF0aC5zdGFydHNXaXRoKCdkYjonKTtcclxuICAgIGlmIChoYXNOb2RlUGF0aCkge1xyXG4gICAgICAgIGlmIChpc1ZhbGlkVXVpZCh1dWlkKSB8fCAoQXJyYXkuaXNBcnJheSh1dWlkcykgJiYgdXVpZHMubGVuZ3RoID4gMCkpIHtcclxuICAgICAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB7IG5vZGVQYXRoOiAobm9kZVBhdGggYXMgc3RyaW5nKS50cmltKCkgfTtcclxuICAgIH1cclxuICAgIGlmIChpc1ZhbGlkVXVpZCh1dWlkKSkge1xyXG4gICAgICAgIHJldHVybiBbdXVpZF07XHJcbiAgICB9XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh1dWlkcykgJiYgdXVpZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBmb3IgKGNvbnN0IHUgb2YgdXVpZHMpIHtcclxuICAgICAgICAgICAgaWYgKCFpc1ZhbGlkVXVpZCh1KSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3V0LnB1c2godSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBvdXQ7XHJcbiAgICB9XHJcbiAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gdGhyb3dJbnZhbGlkUGFyYW1zKCk6IG5ldmVyIHtcclxuICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignSU5WQUxJRF9QQVJBTVMnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgZXJyLmNvZGUgPSAnSU5WQUxJRF9QQVJBTVMnO1xyXG4gICAgdGhyb3cgZXJyO1xyXG59XHJcblxyXG4vKipcclxuICog6amX6K2JIHBhdGgg54K66Z2e56m65a2X5Liy77yIc2V0LXByb3BlcnR5IC8gcmVzZXQtcHJvcGVydHkg55So77yJ44CCXHJcbiAqIHBhdGgg5Y+v54K65Z6L5YilIHBhdGjvvIjlpoIgY2MuU3ByaXRlLnNwcml0ZUZyYW1l77yJ5oiW5pei5pyJIF9fY29tcHNfXy5OLnh4eCAvIG5hbWUg562J44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVBhdGgocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgZmllbGQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCB2ID0gcGFyYW1zW2ZpZWxkXTtcclxuICAgIGlmICh0eXBlb2YgdiAhPT0gJ3N0cmluZycgfHwgdi50cmltKCkgPT09ICcnKSB7XHJcbiAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdjtcclxufVxyXG5cclxuLyoqXHJcbiAqIOmpl+itiSBwYXJhbXMg5Lit5b+F5aGr55qEIENyZWF0b3IgaWTvvIgzMiBoZXgg5oiWIGJhc2U2NCDpoqjmoLzvvInvvJvlpLHmlZfmmYLmi4vlh7ogSU5WQUxJRF9QQVJBTVPjgIJcclxuICovXHJcbmZ1bmN0aW9uIHJlcXVpcmVDcmVhdG9ySWQocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgZmllbGQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCB2ID0gcGFyYW1zW2ZpZWxkXTtcclxuICAgIGlmICghaXNWYWxpZENyZWF0b3JJZCh2KSkge1xyXG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignSU5WQUxJRF9QQVJBTVMnKSBhcyBFcnJvciAmIHsgY29kZT86IHN0cmluZyB9O1xyXG4gICAgICAgIGVyci5jb2RlID0gJ0lOVkFMSURfUEFSQU1TJztcclxuICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdjtcclxufVxyXG5cclxuLyoqIGNyZWF0ZS1jb21wb25lbnQgLyBzZXQtcHJvcGVydHkgLyByZXNldC1wcm9wZXJ0eSAvIGNyZWF0ZS1ub2RlIC8gcmVtb3ZlLW5vZGUg55qE56+A6bue6K2Y5Yil77yadXVpZCDmiJYgbm9kZVBhdGgg5LqM6YG45LiAICovXHJcbmV4cG9ydCB0eXBlIE5vZGVSZWYgPSB7IHV1aWQ6IHN0cmluZyB9IHwgeyBub2RlUGF0aDogc3RyaW5nIH07XHJcblxyXG4vKipcclxuICog6amX6K2JIGNyZWF0ZS1jb21wb25lbnQg5Y+D5pW477ya56+A6bue54K6IHV1aWQg5oiWIG5vZGVQYXRoIOS6jOmBuOS4gOOAgWNvbXBvbmVudO+8iOmhnuWQjeWtl+S4su+8ieOAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVDcmVhdGVDb21wb25lbnRQYXJhbXMocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IE5vZGVSZWYgJiB7IGNvbXBvbmVudDogc3RyaW5nIH0ge1xyXG4gICAgY29uc3QgcmVmID0gcmVxdWlyZU5vZGVQYXRoT3JVdWlkKHBhcmFtcyk7XHJcbiAgICBjb25zdCBjb21wb25lbnQgPSBwYXJhbXMuY29tcG9uZW50O1xyXG4gICAgaWYgKHR5cGVvZiBjb21wb25lbnQgIT09ICdzdHJpbmcnIHx8IGNvbXBvbmVudC50cmltKCkgPT09ICcnKSB7XHJcbiAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyAuLi5yZWYsIGNvbXBvbmVudDogY29tcG9uZW50LnRyaW0oKSB9O1xyXG59XHJcblxyXG4vKipcclxuICog6amX6K2JIHJlc29sdmUtY29tcG9uZW50IOWPg+aVuO+8muevgOm7nueCuiB1dWlkIOaIliBub2RlUGF0aCDkuozpgbjkuIDjgIFjb21wb25lbnTvvIjntYTku7bpoZ7lkI3vvIzlpoIgY2MuU3ByaXRl77yJ44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVJlc29sdmVDb21wb25lbnRQYXJhbXMocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IE5vZGVSZWYgJiB7IGNvbXBvbmVudDogc3RyaW5nIH0ge1xyXG4gICAgY29uc3QgcmVmID0gcmVxdWlyZU5vZGVQYXRoT3JVdWlkKHBhcmFtcyk7XHJcbiAgICBjb25zdCBjb21wb25lbnQgPSBwYXJhbXMuY29tcG9uZW50O1xyXG4gICAgaWYgKHR5cGVvZiBjb21wb25lbnQgIT09ICdzdHJpbmcnIHx8IGNvbXBvbmVudC50cmltKCkgPT09ICcnKSB7XHJcbiAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyAuLi5yZWYsIGNvbXBvbmVudDogY29tcG9uZW50LnRyaW0oKSB9O1xyXG59XHJcblxyXG4vKipcclxuICog6amX6K2JIHJlbW92ZS1jb21wb25lbnTvvJrllq7kuIDntYTku7YgdXVpZO+8jOaIliBub2RlUGF0aHxub2RlVXVpZCArIGNvbXBvbmVudCDpoZ7lkI3jgIJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlUmVtb3ZlQ29tcG9uZW50UGFyYW1zKFxyXG4gICAgcGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxyXG4pOiB7IHV1aWQ6IHN0cmluZyB9IHwgKE5vZGVSZWYgJiB7IGNvbXBvbmVudDogc3RyaW5nIH0pIHtcclxuICAgIGNvbnN0IGhhc0NvbXBvbmVudCA9IHR5cGVvZiBwYXJhbXMuY29tcG9uZW50ID09PSAnc3RyaW5nJyAmJiBwYXJhbXMuY29tcG9uZW50LnRyaW0oKSAhPT0gJyc7XHJcbiAgICBpZiAoaGFzQ29tcG9uZW50KSB7XHJcbiAgICAgICAgcmV0dXJuIHsgLi4ucmVxdWlyZU5vZGVQYXRoT3JVdWlkKHBhcmFtcyksIGNvbXBvbmVudDogKHBhcmFtcy5jb21wb25lbnQgYXMgc3RyaW5nKS50cmltKCkgfTtcclxuICAgIH1cclxuICAgIHJldHVybiB7IHV1aWQ6IHJlcXVpcmVDcmVhdG9ySWQocGFyYW1zLCAndXVpZCcpIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDpqZforYkgY3JlYXRlLW5vZGUg5Y+D5pW477ya5Y+v6YG4IHBhcmVudCDngrogdXVpZCDmiJYgbm9kZVBhdGjvvJvlhbbppJjoiIcgRWRpdG9yIENyZWF0ZU5vZGVPcHRpb25zIOebuOWuueOAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVDcmVhdGVOb2RlUGFyYW1zKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiAmICh7fSB8IHsgdXVpZDogc3RyaW5nIH0gfCB7IG5vZGVQYXRoOiBzdHJpbmcgfSkge1xyXG4gICAgaWYgKHBhcmFtcyA9PT0gbnVsbCB8fCB0eXBlb2YgcGFyYW1zICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHBhcmFtcykpIHtcclxuICAgICAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJlZiA9IG9wdGlvbmFsTm9kZVBhdGhPclV1aWQocGFyYW1zKTtcclxuICAgIHJldHVybiB7IC4uLnBhcmFtcywgLi4ucmVmIH0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gJiAoe30gfCB7IHV1aWQ6IHN0cmluZyB9IHwgeyBub2RlUGF0aDogc3RyaW5nIH0pO1xyXG59XHJcblxyXG4vKipcclxuICog6amX6K2JIHJlbW92ZS1ub2RlIOWPg+aVuO+8mnV1aWQg5Zau5LiA5oiW6Zmj5YiX77yM5oiWIG5vZGVQYXRo77yI5Zau5LiA56+A6bue77yJ77yb5Y+v6YG4IGtlZXBXb3JsZFRyYW5zZm9ybeOAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVSZW1vdmVOb2RlUGFyYW1zKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiAoXHJcbiAgICB8IHsgdXVpZDogc3RyaW5nIHwgc3RyaW5nW107IGtlZXBXb3JsZFRyYW5zZm9ybT86IGJvb2xlYW4gfVxyXG4gICAgfCB7IG5vZGVQYXRoOiBzdHJpbmc7IGtlZXBXb3JsZFRyYW5zZm9ybT86IGJvb2xlYW4gfVxyXG4pIHtcclxuICAgIGNvbnN0IHV1aWQgPSBwYXJhbXMudXVpZDtcclxuICAgIGNvbnN0IG5vZGVQYXRoID0gcGFyYW1zLm5vZGVQYXRoO1xyXG4gICAgY29uc3Qga2VlcFdvcmxkVHJhbnNmb3JtID0gcGFyYW1zLmtlZXBXb3JsZFRyYW5zZm9ybTtcclxuICAgIGNvbnN0IGhhc05vZGVQYXRoID0gdHlwZW9mIG5vZGVQYXRoID09PSAnc3RyaW5nJyAmJiBub2RlUGF0aC50cmltKCkgIT09ICcnICYmICFub2RlUGF0aC5zdGFydHNXaXRoKCdkYjonKTtcclxuICAgIGlmIChoYXNOb2RlUGF0aCAmJiAodXVpZCA9PT0gdW5kZWZpbmVkIHx8IHV1aWQgPT09IG51bGwpKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgbm9kZVBhdGg6IChub2RlUGF0aCBhcyBzdHJpbmcpLnRyaW0oKSxcclxuICAgICAgICAgICAgLi4uKHR5cGVvZiBrZWVwV29ybGRUcmFuc2Zvcm0gPT09ICdib29sZWFuJyA/IHsga2VlcFdvcmxkVHJhbnNmb3JtIH0gOiB7fSksXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIGlmIChpc1ZhbGlkQ3JlYXRvcklkKHV1aWQpKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgdXVpZCxcclxuICAgICAgICAgICAgLi4uKHR5cGVvZiBrZWVwV29ybGRUcmFuc2Zvcm0gPT09ICdib29sZWFuJyA/IHsga2VlcFdvcmxkVHJhbnNmb3JtIH0gOiB7fSksXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIGlmIChBcnJheS5pc0FycmF5KHV1aWQpICYmIHV1aWQubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGZvciAoY29uc3QgdSBvZiB1dWlkKSB7XHJcbiAgICAgICAgICAgIGlmICghaXNWYWxpZENyZWF0b3JJZCh1KSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgdXVpZCxcclxuICAgICAgICAgICAgLi4uKHR5cGVvZiBrZWVwV29ybGRUcmFuc2Zvcm0gPT09ICdib29sZWFuJyA/IHsga2VlcFdvcmxkVHJhbnNmb3JtIH0gOiB7fSksXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuICAgIHRocm93SW52YWxpZFBhcmFtcygpO1xyXG59XHJcblxyXG4vKipcclxuICogc2V0LXByb3BlcnR5IOWPg+aVuO+8muevgOm7nueCuiB1dWlkIOaIliBub2RlUGF0aCDkuozpgbjkuIDjgIFwYXRoIOW/heWhq++8m2R1bXAg6IiHIHZhbHVlIOS6jOmBuOS4gO+8jOiLpeWQjOaZguWtmOWcqOS7pSBkdW1wIOeCuua6luOAglxyXG4gKiB2YWx1ZSDlhYHoqLEgc3RyaW5n77yI6LOH5rqQ6Lev5b6RIGRiOiAvIGRiOi8vIC8gYXNzZXRzL++8ieaIlueJqeS7tu+8iOWmgiB7IF9fdXVpZF9fIH3vvInvvJvlkJHlvoznm7jlrrnml6LmnIkgX191dWlkX18g5a+r5rOV44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVNldFByb3BlcnR5UGFyYW1zKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBOb2RlUmVmICYge1xyXG4gICAgcGF0aDogc3RyaW5nO1xyXG4gICAgZHVtcD86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgdmFsdWU/OiB1bmtub3duO1xyXG4gICAgcmVjb3JkPzogYm9vbGVhbjtcclxufSB7XHJcbiAgICBjb25zdCByZWYgPSByZXF1aXJlTm9kZVBhdGhPclV1aWQocGFyYW1zKTtcclxuICAgIGNvbnN0IHBhdGggPSByZXF1aXJlUGF0aChwYXJhbXMsICdwYXRoJyk7XHJcbiAgICBjb25zdCBoYXNEdW1wID0gcGFyYW1zLmR1bXAgIT09IHVuZGVmaW5lZCAmJiBwYXJhbXMuZHVtcCAhPT0gbnVsbCAmJiB0eXBlb2YgcGFyYW1zLmR1bXAgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHBhcmFtcy5kdW1wKTtcclxuICAgIGNvbnN0IGhhc1ZhbHVlID0gcGFyYW1zLnZhbHVlICE9PSB1bmRlZmluZWQ7XHJcbiAgICBpZiAoIWhhc0R1bXAgJiYgIWhhc1ZhbHVlKSB7XHJcbiAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICB9XHJcbiAgICBjb25zdCByZWNvcmQgPSBwYXJhbXMucmVjb3JkO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICAuLi5yZWYsXHJcbiAgICAgICAgcGF0aCxcclxuICAgICAgICAuLi4oaGFzRHVtcCA/IHsgZHVtcDogcGFyYW1zLmR1bXAgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfSA6IHt9KSxcclxuICAgICAgICAuLi4oaGFzRHVtcCA/IHt9IDogeyB2YWx1ZTogcGFyYW1zLnZhbHVlIH0pLFxyXG4gICAgICAgIC4uLih0eXBlb2YgcmVjb3JkID09PSAnYm9vbGVhbicgPyB7IHJlY29yZCB9IDoge30pLFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHByZWZhYi5pbnN0YW50aWF0ZSDlj4PmlbjvvJpwcmVmYWIg5b+F5aGr77yIcHJlZmFiIOizh+a6kCB1dWlkIOaIliBhc3NldFBhdGjvvInvvJtwYXJlbnQg5Y+v6YG477yI56+A6bueIHV1aWQg5oiWIG5vZGVQYXRo77yM55yB55Wl5YmH5o6b5Zyo5qC556+A6bue5LiL77yJ44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVByZWZhYkluc3RhbnRpYXRlUGFyYW1zKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiAoXHJcbiAgICB7IHByZWZhYlV1aWQ6IHN0cmluZzsgcGFyZW50Pzogc3RyaW5nIH0gfCB7IHByZWZhYlV1aWQ6IHN0cmluZzsgcGFyZW50UGF0aDogc3RyaW5nIH0gfCB7IHByZWZhYkFzc2V0UGF0aDogc3RyaW5nOyBwYXJlbnQ/OiBzdHJpbmcgfSB8IHsgcHJlZmFiQXNzZXRQYXRoOiBzdHJpbmc7IHBhcmVudFBhdGg6IHN0cmluZyB9XHJcbikge1xyXG4gICAgaWYgKHBhcmFtcyA9PT0gbnVsbCB8fCB0eXBlb2YgcGFyYW1zICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHBhcmFtcykpIHtcclxuICAgICAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHByZWZhYlV1aWQgPSBwYXJhbXMucHJlZmFiVXVpZDtcclxuICAgIGNvbnN0IHByZWZhYkFzc2V0UGF0aCA9IHBhcmFtcy5wcmVmYWJBc3NldFBhdGg7XHJcbiAgICBjb25zdCBoYXNQcmVmYWJVdWlkID0gaXNWYWxpZFV1aWQocHJlZmFiVXVpZCk7XHJcbiAgICBjb25zdCBoYXNQcmVmYWJQYXRoID0gdHlwZW9mIHByZWZhYkFzc2V0UGF0aCA9PT0gJ3N0cmluZycgJiYgcHJlZmFiQXNzZXRQYXRoLnRyaW0oKSAhPT0gJyc7XHJcbiAgICBpZiAoIWhhc1ByZWZhYlV1aWQgJiYgIWhhc1ByZWZhYlBhdGgpIHtcclxuICAgICAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxuICAgIH1cclxuICAgIGlmIChoYXNQcmVmYWJVdWlkICYmIGhhc1ByZWZhYlBhdGgpIHtcclxuICAgICAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHBhcmVudCA9IHBhcmFtcy5wYXJlbnQ7XHJcbiAgICBjb25zdCBwYXJlbnRQYXRoID0gcGFyYW1zLnBhcmVudFBhdGg7XHJcbiAgICBjb25zdCBoYXNQYXJlbnQgPSBpc1ZhbGlkVXVpZChwYXJlbnQpO1xyXG4gICAgY29uc3QgaGFzUGFyZW50UGF0aCA9IHR5cGVvZiBwYXJlbnRQYXRoID09PSAnc3RyaW5nJyAmJiBwYXJlbnRQYXRoLnRyaW0oKSAhPT0gJycgJiYgIVN0cmluZyhwYXJlbnRQYXRoKS5zdGFydHNXaXRoKCdkYjonKTtcclxuICAgIGlmIChoYXNQcmVmYWJVdWlkKSB7XHJcbiAgICAgICAgaWYgKGhhc1BhcmVudCkgcmV0dXJuIHsgcHJlZmFiVXVpZDogcHJlZmFiVXVpZCBhcyBzdHJpbmcsIHBhcmVudDogcGFyZW50IGFzIHN0cmluZyB9O1xyXG4gICAgICAgIGlmIChoYXNQYXJlbnRQYXRoKSByZXR1cm4geyBwcmVmYWJVdWlkOiBwcmVmYWJVdWlkIGFzIHN0cmluZywgcGFyZW50UGF0aDogKHBhcmVudFBhdGggYXMgc3RyaW5nKS50cmltKCkgfTtcclxuICAgICAgICByZXR1cm4geyBwcmVmYWJVdWlkOiBwcmVmYWJVdWlkIGFzIHN0cmluZyB9O1xyXG4gICAgfVxyXG4gICAgaWYgKGhhc1ByZWZhYlBhdGgpIHtcclxuICAgICAgICBpZiAoaGFzUGFyZW50KSByZXR1cm4geyBwcmVmYWJBc3NldFBhdGg6IChwcmVmYWJBc3NldFBhdGggYXMgc3RyaW5nKS50cmltKCksIHBhcmVudDogcGFyZW50IGFzIHN0cmluZyB9O1xyXG4gICAgICAgIGlmIChoYXNQYXJlbnRQYXRoKSByZXR1cm4geyBwcmVmYWJBc3NldFBhdGg6IChwcmVmYWJBc3NldFBhdGggYXMgc3RyaW5nKS50cmltKCksIHBhcmVudFBhdGg6IChwYXJlbnRQYXRoIGFzIHN0cmluZykudHJpbSgpIH07XHJcbiAgICAgICAgcmV0dXJuIHsgcHJlZmFiQXNzZXRQYXRoOiAocHJlZmFiQXNzZXRQYXRoIGFzIHN0cmluZykudHJpbSgpIH07XHJcbiAgICB9XHJcbiAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHByZWZhYi5jcmVhdGUg5Y+D5pW477yabm9kZVV1aWQg5oiWIG5vZGVQYXRoIOS6jOmBuOS4gO+8iOagueevgOm7nu+8ieOAgWFzc2V0UGF0aCDlv4XloavvvIjmlrAgcHJlZmFiIOizh+a6kOi3r+W+ke+8ieOAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVQcmVmYWJDcmVhdGVQYXJhbXMocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IChcclxuICAgIHsgbm9kZVV1aWQ6IHN0cmluZzsgYXNzZXRQYXRoOiBzdHJpbmcgfSB8IHsgbm9kZVBhdGg6IHN0cmluZzsgYXNzZXRQYXRoOiBzdHJpbmcgfVxyXG4pIHtcclxuICAgIGNvbnN0IGFzc2V0UGF0aCA9IHBhcmFtcy5hc3NldFBhdGg7XHJcbiAgICBpZiAodHlwZW9mIGFzc2V0UGF0aCAhPT0gJ3N0cmluZycgfHwgYXNzZXRQYXRoLnRyaW0oKSA9PT0gJycpIHtcclxuICAgICAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGhhc05vZGVVdWlkID0gaXNWYWxpZFV1aWQocGFyYW1zLm5vZGVVdWlkKTtcclxuICAgIGNvbnN0IG5vZGVQYXRoID0gcGFyYW1zLm5vZGVQYXRoO1xyXG4gICAgY29uc3QgaGFzTm9kZVBhdGggPSB0eXBlb2Ygbm9kZVBhdGggPT09ICdzdHJpbmcnICYmIG5vZGVQYXRoLnRyaW0oKSAhPT0gJycgJiYgIW5vZGVQYXRoLnN0YXJ0c1dpdGgoJ2RiOicpO1xyXG4gICAgaWYgKGhhc05vZGVVdWlkICYmICFoYXNOb2RlUGF0aCkge1xyXG4gICAgICAgIHJldHVybiB7IG5vZGVVdWlkOiBwYXJhbXMubm9kZVV1aWQgYXMgc3RyaW5nLCBhc3NldFBhdGg6IChhc3NldFBhdGggYXMgc3RyaW5nKS50cmltKCkgfTtcclxuICAgIH1cclxuICAgIGlmIChoYXNOb2RlUGF0aCAmJiAhaGFzTm9kZVV1aWQpIHtcclxuICAgICAgICByZXR1cm4geyBub2RlUGF0aDogKG5vZGVQYXRoIGFzIHN0cmluZykudHJpbSgpLCBhc3NldFBhdGg6IChhc3NldFBhdGggYXMgc3RyaW5nKS50cmltKCkgfTtcclxuICAgIH1cclxuICAgIHRocm93SW52YWxpZFBhcmFtcygpO1xyXG59XHJcblxyXG4vKipcclxuICogc2NlbmUuY3JlYXRlIOWPg+aVuO+8mmFzc2V0UGF0aCDlv4XloavvvJtvcGVuIOWPr+mBuO+8iOW7uueri+W+jOaYr+WQpumWi+WVn++8ieOAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVTY2VuZUNyZWF0ZVBhcmFtcyhwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogeyBhc3NldFBhdGg6IHN0cmluZzsgb3Blbj86IGJvb2xlYW4gfSB7XHJcbiAgICBjb25zdCBhc3NldFBhdGggPSBwYXJhbXMuYXNzZXRQYXRoO1xyXG4gICAgaWYgKHR5cGVvZiBhc3NldFBhdGggIT09ICdzdHJpbmcnIHx8IGFzc2V0UGF0aC50cmltKCkgPT09ICcnKSB7XHJcbiAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBvcGVuID0gcGFyYW1zLm9wZW47XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGFzc2V0UGF0aDogKGFzc2V0UGF0aCBhcyBzdHJpbmcpLnRyaW0oKSxcclxuICAgICAgICAuLi4odHlwZW9mIG9wZW4gPT09ICdib29sZWFuJyA/IHsgb3BlbiB9IDoge30pLFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHNjZW5lLm9wZW4g5Y+D5pW477yadXVpZCDmiJYgYXNzZXRQYXRoIOS6jOmBuOS4gOOAgmFzc2V0UGF0aCDlj6/ngrogZGI644CBZGI6Ly8g5oiW5bCI5qGI55u45bCN6Lev5b6R44CCXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZVNjZW5lT3BlblBhcmFtcyhwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogeyB1dWlkOiBzdHJpbmcgfSB8IHsgYXNzZXRQYXRoOiBzdHJpbmcgfSB7XHJcbiAgICBjb25zdCBoYXNVdWlkID0gaXNWYWxpZFV1aWQocGFyYW1zLnV1aWQpO1xyXG4gICAgY29uc3QgYXNzZXRQYXRoID0gcGFyYW1zLmFzc2V0UGF0aDtcclxuICAgIGNvbnN0IGhhc0Fzc2V0UGF0aCA9IHR5cGVvZiBhc3NldFBhdGggPT09ICdzdHJpbmcnICYmIGFzc2V0UGF0aC50cmltKCkgIT09ICcnO1xyXG4gICAgaWYgKGhhc1V1aWQgJiYgIWhhc0Fzc2V0UGF0aCkge1xyXG4gICAgICAgIHJldHVybiB7IHV1aWQ6IHBhcmFtcy51dWlkIGFzIHN0cmluZyB9O1xyXG4gICAgfVxyXG4gICAgaWYgKGhhc0Fzc2V0UGF0aCAmJiAhaGFzVXVpZCkge1xyXG4gICAgICAgIHJldHVybiB7IGFzc2V0UGF0aDogKGFzc2V0UGF0aCBhcyBzdHJpbmcpLnRyaW0oKSB9O1xyXG4gICAgfVxyXG4gICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiByZXNldC1wcm9wZXJ0eSDlj4PmlbjvvJrnr4Dpu57ngrogdXVpZCDmiJYgbm9kZVBhdGgg5LqM6YG45LiA44CBcGF0aCDlv4XloavvvJvlj6/pgbggZHVtcOOAgXJlY29yZOOAglxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVSZXNldFByb3BlcnR5UGFyYW1zKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBOb2RlUmVmICYge1xyXG4gICAgcGF0aDogc3RyaW5nO1xyXG4gICAgZHVtcD86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgcmVjb3JkPzogYm9vbGVhbjtcclxufSB7XHJcbiAgICBjb25zdCByZWYgPSByZXF1aXJlTm9kZVBhdGhPclV1aWQocGFyYW1zKTtcclxuICAgIGNvbnN0IHBhdGggPSByZXF1aXJlUGF0aChwYXJhbXMsICdwYXRoJyk7XHJcbiAgICBjb25zdCBoYXNEdW1wID0gcGFyYW1zLmR1bXAgIT09IHVuZGVmaW5lZCAmJiBwYXJhbXMuZHVtcCAhPT0gbnVsbCAmJiB0eXBlb2YgcGFyYW1zLmR1bXAgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHBhcmFtcy5kdW1wKTtcclxuICAgIGNvbnN0IHJlY29yZCA9IHBhcmFtcy5yZWNvcmQ7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIC4uLnJlZixcclxuICAgICAgICBwYXRoLFxyXG4gICAgICAgIC4uLihoYXNEdW1wID8geyBkdW1wOiBwYXJhbXMuZHVtcCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB9IDoge30pLFxyXG4gICAgICAgIC4uLih0eXBlb2YgcmVjb3JkID09PSAnYm9vbGVhbicgPyB7IHJlY29yZCB9IDoge30pLFxyXG4gICAgfTtcclxufVxyXG5cclxuLyoqIG5vZGUuZmluZO+8muiHs+WwkSBuYW1lIOaIliBjb21wb25lbnQg5YW25LiAICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlTm9kZUZpbmRQYXJhbXMocGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHsgbmFtZT86IHN0cmluZzsgY29tcG9uZW50Pzogc3RyaW5nIH0ge1xyXG4gICAgY29uc3QgbmFtZSA9IHBhcmFtcy5uYW1lO1xyXG4gICAgY29uc3QgY29tcG9uZW50ID0gcGFyYW1zLmNvbXBvbmVudDtcclxuICAgIGNvbnN0IGhhc05hbWUgPSB0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycgJiYgbmFtZS50cmltKCkgIT09ICcnO1xyXG4gICAgY29uc3QgaGFzQ29tcCA9IHR5cGVvZiBjb21wb25lbnQgPT09ICdzdHJpbmcnICYmIGNvbXBvbmVudC50cmltKCkgIT09ICcnO1xyXG4gICAgaWYgKCFoYXNOYW1lICYmICFoYXNDb21wKSB7XHJcbiAgICAgICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIC4uLihoYXNOYW1lID8geyBuYW1lOiAobmFtZSBhcyBzdHJpbmcpLnRyaW0oKSB9IDoge30pLFxyXG4gICAgICAgIC4uLihoYXNDb21wID8geyBjb21wb25lbnQ6IChjb21wb25lbnQgYXMgc3RyaW5nKS50cmltKCkgfSA6IHt9KSxcclxuICAgIH07XHJcbn1cclxuXHJcbi8qKiBub2RlLmR1cGxpY2F0Ze+8muS+hua6kOevgOm7niB1dWlkfG5vZGVQYXRo77yb5Y+v6YG4IHBhcmVudFV1aWR8cGFyZW50UGF0aOOAgW5hbWUgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVOb2RlRHVwbGljYXRlUGFyYW1zKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiB7XHJcbiAgICBzb3VyY2U6IE5vZGVSZWY7XHJcbiAgICBwYXJlbnQ/OiBOb2RlUmVmO1xyXG4gICAgbmFtZT86IHN0cmluZztcclxufSB7XHJcbiAgICBjb25zdCBzb3VyY2UgPSByZXF1aXJlTm9kZVBhdGhPclV1aWQocGFyYW1zKTtcclxuICAgIGNvbnN0IHBhcmVudFV1aWQgPSBwYXJhbXMucGFyZW50VXVpZDtcclxuICAgIGNvbnN0IHBhcmVudFBhdGggPSBwYXJhbXMucGFyZW50UGF0aDtcclxuICAgIGxldCBwYXJlbnQ6IE5vZGVSZWYgfCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBoYXNQVSA9IGlzVmFsaWRVdWlkKHBhcmVudFV1aWQpO1xyXG4gICAgY29uc3QgaGFzUFAgPSB0eXBlb2YgcGFyZW50UGF0aCA9PT0gJ3N0cmluZycgJiYgcGFyZW50UGF0aC50cmltKCkgIT09ICcnICYmICFwYXJlbnRQYXRoLnN0YXJ0c1dpdGgoJ2RiOicpO1xyXG4gICAgaWYgKGhhc1BVICYmICFoYXNQUCkge1xyXG4gICAgICAgIHBhcmVudCA9IHsgdXVpZDogcGFyZW50VXVpZCBhcyBzdHJpbmcgfTtcclxuICAgIH0gZWxzZSBpZiAoaGFzUFAgJiYgIWhhc1BVKSB7XHJcbiAgICAgICAgcGFyZW50ID0geyBub2RlUGF0aDogKHBhcmVudFBhdGggYXMgc3RyaW5nKS50cmltKCkgfTtcclxuICAgIH0gZWxzZSBpZiAoaGFzUFUgJiYgaGFzUFApIHtcclxuICAgICAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxuICAgIH1cclxuICAgIGNvbnN0IG5hbWUgPSBwYXJhbXMubmFtZTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgc291cmNlLFxyXG4gICAgICAgIC4uLihwYXJlbnQgIT09IHVuZGVmaW5lZCA/IHsgcGFyZW50IH0gOiB7fSksXHJcbiAgICAgICAgLi4uKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJyAmJiBuYW1lLnRyaW0oKSAhPT0gJycgPyB7IG5hbWU6IG5hbWUudHJpbSgpIH0gOiB7fSksXHJcbiAgICB9O1xyXG59XHJcblxyXG4vKiogcHJlZmFiLmNvcHnvvJrkvobmupAgdXVpZCDmiJYgYXNzZXRQYXRo77ybZGVzdCDlv4XloasgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVQcmVmYWJDb3B5UGFyYW1zKHBhcmFtczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiB7IHNyY1V1aWQ6IHN0cmluZzsgZGVzdEFzc2V0UGF0aDogc3RyaW5nIH0gfCB7IHNyY0Fzc2V0UGF0aDogc3RyaW5nOyBkZXN0QXNzZXRQYXRoOiBzdHJpbmcgfSB7XHJcbiAgICBjb25zdCBkZXN0QXNzZXRQYXRoID0gcGFyYW1zLmRlc3RBc3NldFBhdGg7XHJcbiAgICBpZiAodHlwZW9mIGRlc3RBc3NldFBhdGggIT09ICdzdHJpbmcnIHx8IGRlc3RBc3NldFBhdGgudHJpbSgpID09PSAnJykge1xyXG4gICAgICAgIHRocm93SW52YWxpZFBhcmFtcygpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgZGVzdCA9IGRlc3RBc3NldFBhdGgudHJpbSgpO1xyXG4gICAgY29uc3Qgc3JjVXVpZCA9IHBhcmFtcy5zcmNVdWlkO1xyXG4gICAgY29uc3Qgc3JjQXNzZXRQYXRoID0gcGFyYW1zLnNyY0Fzc2V0UGF0aDtcclxuICAgIGlmICh0eXBlb2Ygc3JjQXNzZXRQYXRoID09PSAnc3RyaW5nJyAmJiBzcmNBc3NldFBhdGgudHJpbSgpICE9PSAnJykge1xyXG4gICAgICAgIGlmIChpc1ZhbGlkVXVpZChzcmNVdWlkKSkge1xyXG4gICAgICAgICAgICB0aHJvd0ludmFsaWRQYXJhbXMoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHsgc3JjQXNzZXRQYXRoOiBzcmNBc3NldFBhdGgudHJpbSgpLCBkZXN0QXNzZXRQYXRoOiBkZXN0IH07XHJcbiAgICB9XHJcbiAgICBpZiAoaXNWYWxpZFV1aWQoc3JjVXVpZCkpIHtcclxuICAgICAgICByZXR1cm4geyBzcmNVdWlkOiBzcmNVdWlkIGFzIHN0cmluZywgZGVzdEFzc2V0UGF0aDogZGVzdCB9O1xyXG4gICAgfVxyXG4gICAgdGhyb3dJbnZhbGlkUGFyYW1zKCk7XHJcbn1cclxuIl19