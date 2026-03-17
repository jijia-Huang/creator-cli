"use strict";
/**
 * 組件 path 解析：型別 path（如 cc.Sprite.spriteFrame）轉成 Editor 用的 __comps__.N.xxx。
 * 供 set-property / reset-property 使用。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isResolvedComponentPath = isResolvedComponentPath;
exports.resolveComponentPath = resolveComponentPath;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LXBhdGguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvYnJpZGdlL2NvbXBvbmVudC1wYXRoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7O0FBR0gsMERBRUM7QUEwQ0Qsb0RBaUJDO0FBOURELG9EQUFvRDtBQUNwRCxTQUFnQix1QkFBdUIsQ0FBQyxJQUFZO0lBQ2hELE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxLQUFnQixFQUFFLGFBQXFCO0lBQy9ELE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN0QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3BDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUTtZQUFFLFNBQVM7UUFDakQsTUFBTSxDQUFDLEdBQUcsQ0FBNEIsQ0FBQztRQUN2QyxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3RCLE1BQU0sU0FBUyxHQUNYLEtBQUssSUFBSSxJQUFJO1lBQ2IsT0FBTyxLQUFLLEtBQUssUUFBUTtZQUN6QixNQUFNLElBQUksS0FBSztZQUNmLE9BQVEsS0FBMkIsQ0FBQyxJQUFJLEtBQUssUUFBUTtZQUNwRCxLQUEwQixDQUFDLElBQUksS0FBSyxRQUFRLENBQUM7UUFDbEQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsR0FBRyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLFFBQVEsQ0FBQztRQUNqRSxNQUFNLFNBQVMsR0FDWCxLQUFLLElBQUksSUFBSTtZQUNiLE9BQU8sS0FBSyxLQUFLLFFBQVE7WUFDekIsTUFBTSxJQUFJLEtBQUs7WUFDZixPQUFRLEtBQTJCLENBQUMsSUFBSSxLQUFLLFFBQVE7WUFDcEQsS0FBMEIsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDO1FBQ2xELElBQUksU0FBUyxJQUFJLFFBQVEsSUFBSSxTQUFTO1lBQUUsT0FBTyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDZCxDQUFDO0FBRUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQUMsUUFBZ0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDN0IsSUFBSSxJQUFJLEtBQUssRUFBRTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRTdCLElBQUksdUJBQXVCLENBQUMsSUFBSSxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFFL0MsTUFBTSxLQUFLLEdBQUksUUFBb0MsQ0FBQyxTQUFTLENBQUM7SUFDOUQsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFFdkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM5QixNQUFNLGFBQWEsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDN0QsTUFBTSxVQUFVLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRXpELE1BQU0sS0FBSyxHQUFHLGtCQUFrQixDQUFDLEtBQUssRUFBRSxhQUFhLENBQUMsQ0FBQztJQUN2RCxJQUFJLEtBQUssR0FBRyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFFM0IsT0FBTyxVQUFVLENBQUMsQ0FBQyxDQUFDLGFBQWEsS0FBSyxJQUFJLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxhQUFhLEtBQUssRUFBRSxDQUFDO0FBQ2xGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICog57WE5Lu2IHBhdGgg6Kej5p6Q77ya5Z6L5YilIHBhdGjvvIjlpoIgY2MuU3ByaXRlLnNwcml0ZUZyYW1l77yJ6L2J5oiQIEVkaXRvciDnlKjnmoQgX19jb21wc19fLk4ueHh444CCXHJcbiAqIOS+myBzZXQtcHJvcGVydHkgLyByZXNldC1wcm9wZXJ0eSDkvb/nlKjjgIJcclxuICovXHJcblxyXG4vKiog5Yik5pa3IHBhdGgg5piv5ZCm5bey5pivIF9fY29tcHNfXy5OIOaIliBfX2NvbXBzX18uTi54eHgg5qC85byPICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1Jlc29sdmVkQ29tcG9uZW50UGF0aChwYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAvXl9fY29tcHNfX1xcLlxcZCsvLnRlc3QocGF0aC50cmltKCkpO1xyXG59XHJcblxyXG4vKipcclxuICog5ZyoIG5vZGVEdW1wLl9fY29tcHNfXyDkuK3kvp3luo/mib4gdmFsdWUudHlwZSDmiJYgY2lkIOespuWQiCBjb21wb25lbnRUeXBlIOeahOmgheebrue0ouW8leOAglxyXG4gKiBAcGFyYW0gY29tcHMgX19jb21wc19fIOmZo+WIl1xyXG4gKiBAcGFyYW0gY29tcG9uZW50VHlwZSDlpoIgXCJjYy5TcHJpdGVcIlxyXG4gKi9cclxuZnVuY3Rpb24gZmluZENvbXBvbmVudEluZGV4KGNvbXBzOiB1bmtub3duW10sIGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IG51bWJlciB7XHJcbiAgICBjb25zdCB0eXBlVHJpbSA9IGNvbXBvbmVudFR5cGUudHJpbSgpO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21wcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IGMgPSBjb21wc1tpXTtcclxuICAgICAgICBpZiAoYyA9PSBudWxsIHx8IHR5cGVvZiBjICE9PSAnb2JqZWN0JykgY29udGludWU7XHJcbiAgICAgICAgY29uc3QgbyA9IGMgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcbiAgICAgICAgY29uc3QgdmFsdWUgPSBvLnZhbHVlO1xyXG4gICAgICAgIGNvbnN0IHR5cGVNYXRjaCA9XHJcbiAgICAgICAgICAgIHZhbHVlICE9IG51bGwgJiZcclxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxyXG4gICAgICAgICAgICAndHlwZScgaW4gdmFsdWUgJiZcclxuICAgICAgICAgICAgdHlwZW9mICh2YWx1ZSBhcyB7IHR5cGU6IHVua25vd24gfSkudHlwZSA9PT0gJ3N0cmluZycgJiZcclxuICAgICAgICAgICAgKHZhbHVlIGFzIHsgdHlwZTogc3RyaW5nIH0pLnR5cGUgPT09IHR5cGVUcmltO1xyXG4gICAgICAgIGNvbnN0IGNpZE1hdGNoID0gdHlwZW9mIG8uY2lkID09PSAnc3RyaW5nJyAmJiBvLmNpZCA9PT0gdHlwZVRyaW07XHJcbiAgICAgICAgY29uc3QgbmFtZU1hdGNoID1cclxuICAgICAgICAgICAgdmFsdWUgIT0gbnVsbCAmJlxyXG4gICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXHJcbiAgICAgICAgICAgICduYW1lJyBpbiB2YWx1ZSAmJlxyXG4gICAgICAgICAgICB0eXBlb2YgKHZhbHVlIGFzIHsgbmFtZTogdW5rbm93biB9KS5uYW1lID09PSAnc3RyaW5nJyAmJlxyXG4gICAgICAgICAgICAodmFsdWUgYXMgeyBuYW1lOiBzdHJpbmcgfSkubmFtZSA9PT0gdHlwZVRyaW07XHJcbiAgICAgICAgaWYgKHR5cGVNYXRjaCB8fCBjaWRNYXRjaCB8fCBuYW1lTWF0Y2gpIHJldHVybiBpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIC0xO1xyXG59XHJcblxyXG4vKipcclxuICog5bCH5Z6L5YilIHBhdGgg6Kej5p6Q54K6IF9fY29tcHNfXy5OIOaIliBfX2NvbXBzX18uTi54eHjjgIJcclxuICogLSB0eXBlUGF0aCDlt7LmmK8gX19jb21wc19fLk4g5oiWIF9fY29tcHNfXy5OLnh4eCDmmYLnm7TmjqXlm57lgrPjgIJcclxuICogLSB0eXBlUGF0aCDmoLzlvI/ngrogXCJDb21wb25lbnRUeXBlXCLvvIjlpoIgY2MuU3ByaXRl77yJ5oiWIFwiQ29tcG9uZW50VHlwZS5wcm9wUGF0aFwi77yI5aaCIGNjLlNwcml0ZS5zcHJpdGVGcmFtZe+8ieOAglxyXG4gKiAtIOWcqCBub2RlRHVtcC5fX2NvbXBzX18g5Lit5L6d5bqP5LulIHZhbHVlLnR5cGUg5oiWIGNpZCDnrKblkIggQ29tcG9uZW50VHlwZSDmib7ntKLlvJUgTu+8jOWbnuWCsyBcIl9fY29tcHNfXy5OXCIg5oiWIFwiX19jb21wc19fLk4ucHJvcFBhdGhcIuOAglxyXG4gKlxyXG4gKiBAcGFyYW0gbm9kZUR1bXAg56+A6bueIGR1bXDvvIjlkKsgX19jb21wc19fIOmZo+WIl++8iVxyXG4gKiBAcGFyYW0gdHlwZVBhdGgg5Z6L5YilIHBhdGgg5oiW5bey6Kej5p6Q55qEIF9fY29tcHNfXy5OLnh4eFxyXG4gKiBAcmV0dXJucyDop6PmnpDlvoznmoQgcGF0aO+8jOaJvuS4jeWIsOe1hOS7tuaZguWbnuWCsyBudWxsXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUNvbXBvbmVudFBhdGgobm9kZUR1bXA6IG9iamVjdCwgdHlwZVBhdGg6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3QgcGF0aCA9IHR5cGVQYXRoLnRyaW0oKTtcclxuICAgIGlmIChwYXRoID09PSAnJykgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgaWYgKGlzUmVzb2x2ZWRDb21wb25lbnRQYXRoKHBhdGgpKSByZXR1cm4gcGF0aDtcclxuXHJcbiAgICBjb25zdCBjb21wcyA9IChub2RlRHVtcCBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuX19jb21wc19fO1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNvbXBzKSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgY29uc3QgZG90ID0gcGF0aC5pbmRleE9mKCcuJyk7XHJcbiAgICBjb25zdCBjb21wb25lbnRUeXBlID0gZG90ID09PSAtMSA/IHBhdGggOiBwYXRoLnNsaWNlKDAsIGRvdCk7XHJcbiAgICBjb25zdCBwcm9wU3VmZml4ID0gZG90ID09PSAtMSA/ICcnIDogcGF0aC5zbGljZShkb3QgKyAxKTtcclxuXHJcbiAgICBjb25zdCBpbmRleCA9IGZpbmRDb21wb25lbnRJbmRleChjb21wcywgY29tcG9uZW50VHlwZSk7XHJcbiAgICBpZiAoaW5kZXggPCAwKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICByZXR1cm4gcHJvcFN1ZmZpeCA/IGBfX2NvbXBzX18uJHtpbmRleH0uJHtwcm9wU3VmZml4fWAgOiBgX19jb21wc19fLiR7aW5kZXh9YDtcclxufVxyXG4iXX0=