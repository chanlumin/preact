import { ATTR_KEY } from '../constants';
import { isSameNodeType, isNamedNode } from './index';
import { buildComponentFromVNode } from './component';
import { createNode, setAccessor } from '../dom/index';
import { unmountComponent } from './component';
import options from '../options';
import { applyRef } from '../util';
import { removeNode } from '../dom/index';

/**
 * 
 * Queue of components that have been mounted and are awaiting componentDidMount
 * @type {Array<import('../component').Component>}
 */
export const mounts = [];

// 递归层次
/** Diff recursion count, used to track the end of the diff cycle. */
export let diffLevel = 0;

/** Global flag indicating if the diff is currently within an SVG */
// 当前元素师SVG
let isSvgMode = false;

// hydrating 可以理解为缓存
/** Global flag indicating if the diff is performing hydration */
let hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
// 执行ComponentDidMount和afterMount 回调函数钩子
export function flushMounts() {
	let c;
	while ((c = mounts.shift())) {
		if (options.afterMount) options.afterMount(c);
		if (c.componentDidMount) c.componentDidMount();
	}
}


/**
 * Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 * @param {import('../dom').PreactElement} dom A DOM node to mutate into the shape of a `vnode`
 * @param {import('../vnode').VNode} vnode A VNode (with descendants forming a tree) representing
 *  the desired DOM structure
 * @param {object} context The current context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @param {Element} parent ?
 * @param {boolean} componentRoot ?
 * @returns {import('../dom').PreactElement} The created/mutated element
 *  * diff(undefined, vnode, {}, false, parent, false);
 * @private
 */
export function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
	// 初始化节点
	if (!diffLevel++) {
		// 检查是否在diff SVG
		// when first starting the diff, check if we're diffing an SVG or within an SVG
		isSvgMode = parent!=null && parent.ownerSVGElement!==undefined;

		// hydration is indicated by the existing element to be diffed not having a prop cache
		// 是否缓存数据
		hydrating = dom!=null && !(ATTR_KEY in dom);
	}

	// 更新DOM返回新DOM
	let ret = idiff(dom, vnode, context, mountAll, componentRoot);

	// append the element if its a new parent
	if (parent && ret.parentNode!==parent) parent.appendChild(ret);

	// diffLevel being reduced to 0 means we're exiting the diff
	// 结束diff时候
	if (!--diffLevel) {
		hydrating = false;
		// 缓存标志设置为false
		// 执行ComponentDidMount钩子
		// invoke queued componentDidMount lifecycle methods
		if (!componentRoot) flushMounts();
	}

	return ret;
}


/**
 * Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing.
 * @param {import('../dom').PreactElement} dom A DOM node to mutate into the shape of a `vnode`
 * @param {import('../vnode').VNode} vnode A VNode (with descendants forming a tree) representing the desired DOM structure
 * @param {object} context The current context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @param {boolean} [componentRoot] ?
 * @private
 */
function idiff(dom, vnode, context, mountAll, componentRoot) {
	let out = dom,
		prevSvgMode = isSvgMode;

	// empty values (null, undefined, booleans) render as empty Text nodes
	if (vnode==null || typeof vnode==='boolean') vnode = '';


	// Fast case: Strings & Numbers create/update Text nodes.
	// 叶子节点
	if (typeof vnode==='string' || typeof vnode==='number') {

		// update if it's already a Text node:
		// IE6－8下，文本节点不能添加自定义属性=> dom._component总是为undefined
		if (dom && dom.splitText!==undefined && dom.parentNode && (!dom._component || componentRoot)) {
			/* istanbul ignore if */ /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
			if (dom.nodeValue!=vnode) {
				dom.nodeValue = vnode;
			}
		}
		else {
			// it wasn't a Text node: replace it with one and recycle the old Element
			out = document.createTextNode(vnode);
			if (dom) {
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
				// 回收老节点 存于内存中
				recollectNodeTree(dom, true);
			}
		}

		out[ATTR_KEY] = true;

		return out;
	}


	// If the VNode represents a Component, perform a component diff:
	//  如果vnodeName是一个组件的话
	let vnodeName = vnode.nodeName;
	if (typeof vnodeName==='function') {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}


	// Tracks entering and exiting SVG namespace when descending through the tree.
	isSvgMode = vnodeName==='svg' ? true : vnodeName==='foreignObject' ? false : isSvgMode;


	// If there's no existing element or it's the wrong type, create a new one:
	vnodeName = String(vnodeName);
	if (!dom || !isNamedNode(dom, vnodeName)) {
		// dom节点不存在 或者不是相同名字的节点
		out = createNode(vnodeName, isSvgMode);

		if (dom) {
			// move children into the replacement node
			// 转移真实DOM到虚拟DOM上
			while (dom.firstChild) out.appendChild(dom.firstChild);

			// if the previous Element was mounted into the DOM, replace it inline
			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

			// recycle the old element (skips non-Element node types)
			recollectNodeTree(dom, true);
		}
	}


	let fc = out.firstChild,
		// 取回之前创建的DOM的propert的元素属性
		props = out[ATTR_KEY],
		vchildren = vnode.children;

	// 将元素节点的property转为props
	if (props==null) {
		props = out[ATTR_KEY] = {};
		for (let a=out.attributes, i=a.length; i--; ) props[a[i].name] = a[i].value;
	}

	// Optimization: fast-path for elements containing a single TextNode:
	// 当前DOM是文本节点 虚拟DOM是string类型 直接赋值
	if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
		if (fc.nodeValue!=vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
	// otherwise, if there are existing or new children, diff them:
	// 更新孩子节点
	else if (vchildren && vchildren.length || fc!=null) {
		innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML!=null);
	}


	// Apply attributes/props from VNode to the DOM Element:
	// 更新真实DOM
	diffAttributes(out, vnode.attributes, props);


	// restore previous SVG mode: (in case we're exiting an SVG namespace)
	isSvgMode = prevSvgMode;

	return out;
}


/**
 * Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 * @param {import('../dom').PreactElement} dom Element whose children should be compared & mutated
 * @param {Array<import('../vnode').VNode>} vchildren Array of VNodes to compare to `dom.childNodes`
 * @param {object} context Implicitly descendant context object (from most
 *  recent `getChildContext()`)
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @param {boolean} isHydrating if `true`, consumes externally created elements
 *  similar to hydration
 */
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
	let originalChildren = dom.childNodes,
		children = [],
		keyed = {},
		keyedLen = 0,
		min = 0,
		len = originalChildren.length,
		childrenLen = 0,
		vlen = vchildren ? vchildren.length : 0,
		j, c, f, vchild, child;

	// Build up a map of keyed children and an Array of unkeyed children:
	if (len!==0) {
		for (let i=0; i<len; i++) {
			let child = originalChildren[i],
				props = child[ATTR_KEY],
				key = vlen && props ? child._component ? child._component.__key : props.key : null;
			if (key!=null) {
				keyedLen++;
				keyed[key] = child;
			}
			// 不包含key属性的组件 放到children数组中去。
			else if (props || (child.splitText!==undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen!==0) {
		for (let i=0; i<vlen; i++) {
			vchild = vchildren[i];
			child = null;

			// attempt to find a node based on key matching、
			// 从keyed数组中拿出真实DOM节点
			let key = vchild.key;
			if (key!=null) {
				if (keyedLen && keyed[key]!==undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			// 从children数组中拿出真实节点
			else if (min<childrenLen) {
				for (j=min; j<childrenLen; j++) {
					if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
						child = c;
						children[j] = undefined;
						if (j===childrenLen-1) childrenLen--;
						// 每一趟都会加min => 直到j=== childrenLen - 1 
						if (j===min) min++;
						break;
					}
				}
			}

			// morph the matched/found/created DOM child to match vchild (deep)
			// 更新属性
			child = idiff(child, vchild, context, mountAll);

			f = originalChildren[i];
			if (child && child!==dom && child!==f) {
				if (f==null) {
					dom.appendChild(child);
				}
				else if (child===f.nextSibling) {
					removeNode(f);
				}
				else {
					dom.insertBefore(child, f);
				}
			}
		}
	}


	// remove unused keyed children:
	if (keyedLen) {
		for (let i in keyed) if (keyed[i]!==undefined) recollectNodeTree(keyed[i], false);
	}

	// remove orphaned unkeyed children:
	while (min<=childrenLen) {
		if ((child = children[childrenLen--])!==undefined) recollectNodeTree(child, false);
	}
}



/**
 * Recursively recycle (or just unmount) a node and its descendants.
 * @param {import('../dom').PreactElement} node DOM node to start
 *  unmount/removal from
 * @param {boolean} [unmountOnly=false] If `true`, only triggers unmount
 *  lifecycle, skips removal
 */
export function recollectNodeTree(node, unmountOnly) {
	let component = node._component;
	if (component) {
		// if node is owned by a Component, unmount that component (ends up recursing back here)
		unmountComponent(component);
	}
	else {
		// If the node's VNode had a ref function, invoke it with null here.
		// (this is part of the React spec, and smart for unsetting references)
		if (node[ATTR_KEY]!=null) applyRef(node[ATTR_KEY].ref, null);
		// unmountOnly为true的话 只调用unmount函数钩子 否则 移除节点
		if (unmountOnly===false || node[ATTR_KEY]==null) {
			removeNode(node);
		}

		removeChildren(node);
	}
}


/**
 * Recollect/unmount all children.
 * 	回收孩子节点
 *	- we use .lastChild here because it causes less reflow than .firstChild
 *	- it's also cheaper than accessing the .childNodes Live NodeList
 */
export function removeChildren(node) {
	node = node.lastChild;
	while (node) {
		let next = node.previousSibling;
		recollectNodeTree(node, true);
		node = next;
	}
}


/**
 * Apply differences in attributes from a VNode to the given DOM Element.
 * @param {import('../dom').PreactElement} dom Element with attributes to diff `attrs` against
 * @param {object} attrs The desired end-state key-value attribute pairs
 * @param {object} old Current/previous attributes (from previous VNode or
 *  element's prop cache)
 */
function diffAttributes(dom, attrs, old) {
	let name;

	// remove attributes no longer present on the vnode by setting them to undefined
	for (name in old) {
		// 移除真实dom中对应的vnode中属性为空属性
		if (!(attrs && attrs[name]!=null) && old[name]!=null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// add new & update changed attributes
	// 添加更新属性
	for (name in attrs) {
		if (name!=='children' && name!=='innerHTML' && (!(name in old) || attrs[name]!==(name==='value' || name==='checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}
