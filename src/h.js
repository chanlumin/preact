import { VNode } from './vnode';
import options from './options';


const stack = [];

const EMPTY_CHILDREN = [];

/**
 * JSX/hyperscript reviver.
 * @see http://jasonformat.com/wtf-is-jsx
 * Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *
 * createElement实现
 * Note: this is exported as both `h()` and `createElement()` for compatibility
 * reasons.
 *
 * Creates a VNode (virtual DOM element). A tree of VNodes can be used as a
 * lightweight representation of the structure of a DOM tree. This structure can
 * be realized by recursively comparing it against the current _actual_ DOM
 * structure, and applying only the differences.
 * 创建VNodes,建立轻量级的DOM树, 和实际DOM进行递归diff
 * 
 *
 * `h()`/`createElement()` accepts an element name, a list of attributes/props,
 * and optionally children to append to the element.
 *
 * @example The following DOM tree
 *
 * `<div id="foo" name="bar">Hello!</div>`
 *
 * can be constructed using this function as:
 *
 * `h('div', { id: 'foo', name : 'bar' }, 'Hello!');`
 *
 * @param {string | function} nodeName An element name. Ex: `div`, `a`, `span`, etc.
 * @param {object | null} attributes Any attributes/props to set on the created element.
 * @param {VNode[]} [rest] Additional arguments are taken to be children to
 *  append. Can be infinitely nested Arrays.
 *
 * @public
 */
export function h(nodeName, attributes) {
	let children=EMPTY_CHILDREN, lastSimple, child, simple, i;
	// 获取attributes后面呢的参数
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}
	// 只有两个参数 并且attributes的children属性存在
	if (attributes && attributes.children!=null) {
		if (!stack.length) stack.push(attributes.children);
		delete attributes.children;
	}
	while (stack.length) {
		// children是数组的情况
		if ((child = stack.pop()) && child.pop!==undefined) {
			for (i=child.length; i--; ) stack.push(child[i]);
		}
		else {
			// 减少类型比较
			if (typeof child==='boolean') child = null;
			// node类型不是 函数的话 转为字符串
			if ((simple = typeof nodeName!=='function')) {
				if (child==null) child = '';
				else if (typeof child==='number') child = String(child);
				else if (typeof child!=='string') simple = false;
			}
			// 简单类型
			if (simple && lastSimple) {
				children[children.length-1] += child;
			}
			// children为空数组
			else if (children===EMPTY_CHILDREN) {
				children = [child];
			}
			// children非空数组
			else {
				children.push(child);
			}
			// 最近的一个简单类型child
			lastSimple = simple;
		}
	}
	// 创建VNode把处理好的children赋值给p
	let p = new VNode();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes==null ? undefined : attributes;
	p.key = attributes==null ? undefined : attributes.key;

	// if a "vnode hook" is defined, pass every created VNode to it
	// 扩展虚拟DOM
	if (options.vnode!==undefined) options.vnode(p);

	return p;
}
