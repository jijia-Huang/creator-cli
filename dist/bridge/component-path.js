"use strict";
/**
 * 組件 path 解析：型別 path（如 cc.Sprite.spriteFrame）轉成 Editor 用的 __comps__.N.xxx。
 * 供 set-property / reset-property 使用。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isResolvedComponentPath = isResolvedComponentPath;
exports.resolveComponentPath = resolveComponentPath;
exports.getComponentUuid = getComponentUuid;
/** 判斷 path 是否已是 __comps__.N 或 __comps__.N.xxx 格式 */
function isResolvedComponentPath(path) {
    return /^__comps__\.\d+/.test(path.trim());
}
/**
 * 在 nodeDump.__comps__ 中依序找 value.type 或 cid 符合 componentType 的項目索引。
 * @param comps __comps__ 陣列
 * @param componentType 如 "cc.Sprite"
 */
function findComponentIndex(comps, componentType) {
    const typeTrim = componentType.trim();
    for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        if (c == null || typeof c !== 'object')
            continue;
        const o = c;
        const value = o.value;
        const typeMatch = value != null &&
            typeof value === 'object' &&
            'type' in value &&
            typeof value.type === 'string' &&
            value.type === typeTrim;
        const cidMatch = typeof o.cid === 'string' && o.cid === typeTrim;
        const nameMatch = value != null &&
            typeof value === 'object' &&
            'name' in value &&
            typeof value.name === 'string' &&
            value.name === typeTrim;
        if (typeMatch || cidMatch || nameMatch)
            return i;
    }
    return -1;
}
/**
 * 將型別 path 解析為 __comps__.N 或 __comps__.N.xxx。
 * - typePath 已是 __comps__.N 或 __comps__.N.xxx 時直接回傳。
 * - typePath 格式為 "ComponentType"（如 cc.Sprite）或 "ComponentType.propPath"（如 cc.Sprite.spriteFrame）。
 * - 在 nodeDump.__comps__ 中依序以 value.type 或 cid 符合 ComponentType 找索引 N，回傳 "__comps__.N" 或 "__comps__.N.propPath"。
 *
 * @param nodeDump 節點 dump（含 __comps__ 陣列）
 * @param typePath 型別 path 或已解析的 __comps__.N.xxx
 * @returns 解析後的 path，找不到組件時回傳 null
 */
function resolveComponentPath(nodeDump, typePath) {
    const path = typePath.trim();
    if (path === '')
        return null;
    if (isResolvedComponentPath(path))
        return path;
    const comps = nodeDump.__comps__;
    if (!Array.isArray(comps))
        return null;
    const dot = path.indexOf('.');
    const componentType = dot === -1 ? path : path.slice(0, dot);
    const propSuffix = dot === -1 ? '' : path.slice(dot + 1);
    const index = findComponentIndex(comps, componentType);
    if (index < 0)
        return null;
    return propSuffix ? `__comps__.${index}.${propSuffix}` : `__comps__.${index}`;
}
/** 從 IProperty 或直接值取出字串（與 node-tree-normalize 一致） */
function getStr(prop) {
    if (prop == null)
        return '';
    if (typeof prop === 'string')
        return prop;
    if (typeof prop === 'object' && 'value' in prop && typeof prop.value === 'string') {
        return prop.value;
    }
    return String(prop);
}
/**
 * 依組件類型從節點 dump 的 __comps__ 中取得該組件的 UUID。
 * 供 resolve-component 使用（remove-component、set-property 等需組件 UUID 時可先呼叫此方法）。
 *
 * @param nodeDump 節點 dump（含 __comps__ 陣列，來自 prefab.query-node）
 * @param componentType 組件類名，如 "cc.Sprite"、"PlayerController"
 * @returns 組件 UUID 字串，找不到時回傳 null
 */
function getComponentUuid(nodeDump, componentType) {
    const comps = nodeDump.__comps__;
    if (!Array.isArray(comps))
        return null;
    const typeTrim = componentType.trim();
    if (typeTrim === '')
        return null;
    const index = findComponentIndex(comps, typeTrim);
    if (index < 0)
        return null;
    const c = comps[index];
    if (c == null || typeof c !== 'object')
        return null;
    const value = c.value;
    if (value == null || typeof value !== 'object' || !('uuid' in value))
        return null;
    const uuid = getStr(value.uuid);
    return uuid || null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXBhdGguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvYnJpZGdlL2NvbXBvbmVudC1wYXRoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7O0FBR0gsMERBRUM7QUEwQ0Qsb0RBaUJDO0FBb0JELDRDQWVDO0FBakdELG9EQUFvRDtBQUNwRCxTQUFnQix1QkFBdUIsQ0FBQyxJQUFZO0lBQ2hELE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxLQUFnQixFQUFFLGFBQXFCO0lBQy9ELE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN0QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3BDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUTtZQUFFLFNBQVM7UUFDakQsTUFBTSxDQUFDLEdBQUcsQ0FBNEIsQ0FBQztRQUN2QyxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3RCLE1BQU0sU0FBUyxHQUNYLEtBQUssSUFBSSxJQUFJO1lBQ2IsT0FBTyxLQUFLLEtBQUssUUFBUTtZQUN6QixNQUFNLElBQUksS0FBSztZQUNmLE9BQVEsS0FBMkIsQ0FBQyxJQUFJLEtBQUssUUFBUTtZQUNwRCxLQUEwQixDQUFDLElBQUksS0FBSyxRQUFRLENBQUM7UUFDbEQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsR0FBRyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLFFBQVEsQ0FB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O0lBQ3ZCLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDcEQsTUFBTSxLQUFLLEdBQUksQ0FBNkIsQ0FBQyxLQUFLLENBQUM7SUFDbkQsSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQ2xGLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBRSxLQUEyQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZELE9BQU8sSUFBSSxJQUFJLElBQUksQ0FBQztBQUN4QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIOe1hOS7tiBwYXRoIOino+aekO+8muWei+WIpSBwYXRo77yI5aaCIGNjLlNwcml0ZS5zcHJpdGVGcmFtZe+8iei9ieaIkCBFZGl0b3Ig55So55qEIF9fY29tcHNfXy5OLnh4eOOAglxyXG4gKiDkvpsgc2V0LXByb3BlcnR5IC8gcmVzZXQtcHJvcGVydHkg5L2/55So44CCXHJcbiAqL1xyXG5cclxuLyoqIOWIpOaWtyBwYXRoIOaYr+WQpuW3suaYryBfX2NvbXBzX18uTiDmiJYgX19jb21wc19fLk4ueHh4IOagvOW8jyAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXNSZXNvbHZlZENvbXBvbmVudFBhdGgocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gL15fX2NvbXBzX19cXC5cXGQrLy50ZXN0KHBhdGgudHJpbSgpKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIOWcqCBub2RlRHVtcC5fX2NvbXBzX18g5Lit5L6d5bqP5om+IHZhbHVlLnR5cGUg5oiWIGNpZCDnrKblkIggY29tcG9uZW50VHlwZSDnmoTpoIXnm67ntKLlvJXjgIJcclxuICogQHBhcmFtIGNvbXBzIF9fY29tcHNfXyDpmaPliJdcclxuICogQHBhcmFtIGNvbXBvbmVudFR5cGUg5aaCIFwiY2MuU3ByaXRlXCJcclxuICovXHJcbmZ1bmN0aW9uIGZpbmRDb21wb25lbnRJbmRleChjb21wczogdW5rbm93bltdLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBudW1iZXIge1xyXG4gICAgY29uc3QgdHlwZVRyaW0gPSBjb21wb25lbnRUeXBlLnRyaW0oKTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBjb25zdCBjID0gY29tcHNbaV07XHJcbiAgICAgICAgaWYgKGMgPT0gbnVsbCB8fCB0eXBlb2YgYyAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xyXG4gICAgICAgIGNvbnN0IG8gPSBjIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG4gICAgICAgIGNvbnN0IHZhbHVlID0gby52YWx1ZTtcclxuICAgICAgICBjb25zdCB0eXBlTWF0Y2ggPVxyXG4gICAgICAgICAgICB2YWx1ZSAhPSBudWxsICYmXHJcbiAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcclxuICAgICAgICAgICAgJ3R5cGUnIGluIHZhbHVlICYmXHJcbiAgICAgICAgICAgIHR5cGVvZiAodmFsdWUgYXMgeyB0eXBlOiB1bmtub3duIH0pLnR5cGUgPT09ICdzdHJpbmcnICYmXHJcbiAgICAgICAgICAgICh2YWx1ZSBhcyB7IHR5cGU6IHN0cmluZyB9KS50eXBlID09PSB0eXBlVHJpbTtcclxuICAgICAgICBjb25zdCBjaWRNYXRjaCA9IHR5cGVvZiBvLmNpZCA9PT0gJ3N0cmluZycgJiYgby5jaWQgPT09IHR5cGVUcmltO1xyXG4gICAgICAgIGNvbnN0IG5hbWVNYXRjaCA9XHJcbiAgICAgICAgICAgIHZhbHVlICE9IG51bGwgJiZcclxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxyXG4gICAgICAgICAgICAnbmFtZScgaW4gdmFsdWUgJiZcclxuICAgICAgICAgICAgdHlwZW9mICh2YWx1ZSBhcyB7IG5hbWU6IHVua25vd24gfSkubmFtZSA9PT0gJ3N0cmluZycgJiZcclxuICAgICAgICAgICAgKHZhbHVlIGFzIHsgbmFtZTogc3RyaW5nIH0pLm5hbWUgPT09IHR5cGVUcmltO1xyXG4gICAgICAgIGlmICh0eXBlTWF0Y2ggfHwgY2lkTWF0Y2ggfHwgbmFtZU1hdGNoKSByZXR1cm4gaTtcclxuICAgIH1cclxuICAgIHJldHVybiAtMTtcclxufVxyXG5cclxuLyoqXHJcbiAqIOWwh+Wei+WIpSBwYXRoIOino+aekOeCuiBfX2NvbXBzX18uTiDmiJYgX19jb21wc19fLk4ueHh444CCXHJcbiAqIC0gdHlwZVBhdGgg5bey5pivIF9fY29tcHNfXy5OIOaIliBfX2NvbXBzX18uTi54eHgg5pmC55u05o6l5Zue5YKz44CCXHJcbiAqIC0gdHlwZVBhdGgg5qC85byP54K6IFwiQ29tcG9uZW50VHlwZVwi77yI5aaCIGNjLlNwcml0Ze+8ieaIliBcIkNvbXBvbmVudFR5cGUucHJvcFBhdGhcIu+8iOWmgiBjYy5TcHJpdGUuc3ByaXRlRnJhbWXvvInjgIJcclxuICogLSDlnKggbm9kZUR1bXAuX19jb21wc19fIOS4reS+neW6j+S7pSB2YWx1ZS50eXBlIOaIliBjaWQg56ym5ZCIIENvbXBvbmVudFR5cGUg5om+57Si5byVIE7vvIzlm57lgrMgXCJfX2NvbXBzX18uTlwiIOaIliBcIl9fY29tcHNfXy5OLnByb3BQYXRoXCLjgIJcclxuICpcclxuICogQHBhcmFtIG5vZGVEdW1wIOevgOm7niBkdW1w77yI5ZCrIF9fY29tcHNfXyDpmaPliJfvvIlcclxuICogQHBhcmFtIHR5cGVQYXRoIOWei+WIpSBwYXRoIOaIluW3suino+aekOeahCBfX2NvbXBzX18uTi54eHhcclxuICogQHJldHVybnMg6Kej5p6Q5b6M55qEIHBhdGjvvIzmib7kuI3liLDntYTku7bmmYLlm57lgrMgbnVsbFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVDb21wb25lbnRQYXRoKG5vZGVEdW1wOiBvYmplY3QsIHR5cGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IHBhdGggPSB0eXBlUGF0aC50cmltKCk7XHJcbiAgICBpZiAocGF0aCA9PT0gJycpIHJldHVybiBudWxsO1xyXG5cclxuICAgIGlmIChpc1Jlc29sdmVkQ29tcG9uZW50UGF0aChwYXRoKSkgcmV0dXJuIHBhdGg7XHJcblxyXG4gICAgY29uc3QgY29tcHMgPSAobm9kZUR1bXAgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLl9fY29tcHNfXztcclxuICAgIGlmICghQXJyYXkuaXNBcnJheShjb21wcykpIHJldHVybiBudWxsO1xyXG5cclxuICAgIGNvbnN0IGRvdCA9IHBhdGguaW5kZXhPZignLicpO1xyXG4gICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGRvdCA9PT0gLTEgPyBwYXRoIDogcGF0aC5zbGljZSgwLCBkb3QpO1xyXG4gICAgY29uc3QgcHJvcFN1ZmZpeCA9IGRvdCA9PT0gLTEgPyAnJyA6IHBhdGguc2xpY2UoZG90ICsgMSk7XHJcblxyXG4gICAgY29uc3QgaW5kZXggPSBmaW5kQ29tcG9uZW50SW5kZXgoY29tcHMsIGNvbXBvbmVudFR5cGUpO1xyXG4gICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgcmV0dXJuIHByb3BTdWZmaXggPyBgX19jb21wc19fLiR7aW5kZXh9LiR7cHJvcFN1ZmZpeH1gIDogYF9fY29tcHNfXy4ke2luZGV4fWA7XHJcbn1cclxuXHJcbi8qKiDlvp4gSVByb3BlcnR5IOaIluebtOaOpeWAvOWPluWHuuWtl+S4su+8iOiIhyBub2RlLXRyZWUtbm9ybWFsaXplIOS4gOiHtO+8iSAqL1xyXG5mdW5jdGlvbiBnZXRTdHIocHJvcDogdW5rbm93bik6IHN0cmluZyB7XHJcbiAgICBpZiAocHJvcCA9PSBudWxsKSByZXR1cm4gJyc7XHJcbiAgICBpZiAodHlwZW9mIHByb3AgPT09ICdzdHJpbmcnKSByZXR1cm4gcHJvcDtcclxuICAgIGlmICh0eXBlb2YgcHJvcCA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wICYmIHR5cGVvZiAocHJvcCBhcyB7IHZhbHVlOiB1bmtub3duIH0pLnZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIHJldHVybiAocHJvcCBhcyB7IHZhbHVlOiBzdHJpbmcgfSkudmFsdWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gU3RyaW5nKHByb3ApO1xyXG59XHJcblxyXG4vKipcclxuICog5L6d57WE5Lu26aGe5Z6L5b6e56+A6bueIGR1bXAg55qEIF9fY29tcHNfXyDkuK3lj5blvpfoqbLntYTku7bnmoQgVVVJROOAglxyXG4gKiDkvpsgcmVzb2x2ZS1jb21wb25lbnQg5L2/55So77yIcmVtb3ZlLWNvbXBvbmVudOOAgXNldC1wcm9wZXJ0eSDnrYnpnIDntYTku7YgVVVJRCDmmYLlj6/lhYjlkbzlj6vmraTmlrnms5XvvInjgIJcclxuICpcclxuICogQHBhcmFtIG5vZGVEdW1wIOevgOm7niBkdW1w77yI5ZCrIF9fY29tcHNfXyDpmaPliJfvvIzkvoboh6ogcHJlZmFiLnF1ZXJ5LW5vZGXvvIlcclxuICogQHBhcmFtIGNvbXBvbmVudFR5cGUg57WE5Lu26aGe5ZCN77yM5aaCIFwiY2MuU3ByaXRlXCLjgIFcIlBsYXllckNvbnRyb2xsZXJcIlxyXG4gKiBAcmV0dXJucyDntYTku7YgVVVJRCDlrZfkuLLvvIzmib7kuI3liLDmmYLlm57lgrMgbnVsbFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbXBvbmVudFV1aWQobm9kZUR1bXA6IG9iamVjdCwgY29tcG9uZW50VHlwZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBjb21wcyA9IChub2RlRHVtcCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuX19jb21wc19fO1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNvbXBzKSkgcmV0dXJuIG51bGw7XHJcbiAgICBjb25zdCB0eXBlVHJpbSA9IGNvbXBvbmVudFR5cGUudHJpbSgpO1xyXG4gICAgaWYgKHR5cGVUcmltID09PSAnJykgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgY29uc3QgaW5kZXggPSBmaW5kQ29tcG9uZW50SW5kZXgoY29tcHMsIHR5cGVUcmltKTtcclxuICAgIGlmIChpbmRleCA8IDApIHJldHVybiBudWxsO1xyXG5cclxuICAgIGNvbnN0IGMgPSBjb21wc1tpbmRleF07XHJcbiAgICBpZiAoYyA9PSBudWxsIHx8IHR5cGVvZiBjICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XHJcbiAgICBjb25zdCB2YWx1ZSA9IChjIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS52YWx1ZTtcclxuICAgIGlmICh2YWx1ZSA9PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcgfHwgISgndXVpZCcgaW4gdmFsdWUpKSByZXR1cm4gbnVsbDtcclxuICAgIGNvbnN0IHV1aWQgPSBnZXRTdHIoKHZhbHVlIGFzIHsgdXVpZDogdW5rbm93biB9KS51dWlkKTtcclxuICAgIHJldHVybiB1dWlkIHx8IG51bGw7XHJcbn1cclxuIl19