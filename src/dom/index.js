import { IS_NON_DIMENSIONAL } from '../constants';
import { applyRef } from '../util';
import options from '../options';

/**
 * A DOM event listener
 * @typedef {(e: Event) => void} EventListner
 */

/**
 * A mapping of event types to event listeners
 * @typedef {Object.<string, EventListener>} EventListenerMap
 */

/**
 * Properties Preact adds to elements it creates
 * @typedef PreactElementExtensions
 * @property {string} [normalizedNodeName] A normalized node name to use in diffing
 * @property {EventListenerMap} [_listeners] A map of event listeners added by components to this DOM node
 * @property {import('../component').Component} [_component] The component that rendered this DOM node
 * @property {function} [_componentConstructor] The constructor of the component that rendered this DOM node
 */

/**
 * A DOM element that has been extended with Preact properties
 * @typedef {Element & ElementCSSInlineStyle & PreactElementExtensions} PreactElement
 */

/**
 * Create an element with the given nodeName.
 * 创建节点 SVG: document.createElementNS
 * @param {string} nodeName The DOM node to create
 * @param {boolean} [isSvg=false] If `true`, creates an element within the SVG
 *  namespace.
 * @returns {PreactElement} The created DOM node
 */
export function createNode(nodeName, isSvg) {
	/** @type {PreactElement} */
	let node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	node.normalizedNodeName = nodeName;
	return node;
}


/**
 * Remove a child node from its parent if attached.
 * 删除当前节点
 * @param {Node} node The node to remove
 */
export function removeNode(node) {
	let parentNode = node.parentNode;
	if (parentNode) parentNode.removeChild(node);
}


/**
 * Set a named attribute on the given Node, with special behavior for some names
 * and event handlers. If `value` is `null`, the attribute/handler will be
 * removed.
 * @param {PreactElement} node An element to mutate
 * @param {string} name The name/key to set, such as an event or attribute name
 * @param {*} old The last value that was set for this name/node pair
 * @param {*} value An attribute value, such as a function to be used as an
 *  event handler
 * @param {boolean} isSvg Are we currently diffing inside an svg?
 * @private
 */
export function setAccessor(node, name, old, value, isSvg) {
	if (name==='className') name = 'class';


	if (name==='key') {
		// ignore
	}
	// ref引用
	else if (name==='ref') {
		applyRef(old, null);
		// 把node赋值给refName.current
		// 或者refName(node) 可以通过函数返回node指点 let refName = (ref)=> ref 
		applyRef(value, node);
	}
	// 设置node的className
	else if (name==='class' && !isSvg) {
		node.className = value || '';
	}
	else if (name==='style') {
		// 通过cssText设置style
		if (!value || typeof value==='string' || typeof old==='string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value==='object') {
			if (typeof old!=='string') {
				// 旧的style不在新的style对象中 去除style样式
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			// 设置新的属性
			for (let i in value) {
				node.style[i] = typeof value[i]==='number' && IS_NON_DIMENSIONAL.test(i)===false ? (value[i]+'px') : value[i];
			}
		}
	}
	// 设置dangerouslySetInnerHTML 直接赋值innerHTML
	else if (name==='dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	}
	// 处理事件监听
	else if (name[0]=='o' && name[1]=='n') {
		// true为捕获 false为冒泡
		// onClick和onClickCapture onClickCapture 此处的对比是个简单的方法
		let useCapture = name !== (name=name.replace(/Capture$/, ''));
		// 也可以用 name.indexOf('Capture')
		name = name.toLowerCase().substring(2);
		// 传入value的话就添加 否则就移除
		if (value) {
			if (!old) node.addEventListener(name, eventProxy, useCapture);
		}
		// 异步监听?
		else {
			node.removeEventListener(name, eventProxy, useCapture);
		}
		// 把监听事件存储在node._listeners对象中
		(node._listeners || (node._listeners = {}))[name] = value;
	}
	// 处理node自由属性赋值
	else if (name!=='list' && name!=='type' && !isSvg && name in node) {
		// Attempt to set a DOM property to the given value.
		// IE & FF throw for certain property-value combinations.
		try {
			node[name] = value==null ? '' : value;
		} catch (e) { }
		// 传入的value是null或者false的话 移除name属性
		if ((value==null || value===false) && name!='spellcheck') node.removeAttribute(name);
	}
	else {
		// 其他name属性
		let ns = isSvg && (name !== (name = name.replace(/^xlink:?/, '')));
		// spellcheck is treated differently than all other boolean values and
		// should not be removed when the value is `false`. See:
		// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-spellcheck
		if (value==null || value===false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());
			else node.removeAttribute(name);
		}
		else if (typeof value!=='function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);
			else node.setAttribute(name, value);
		}
	}
}


/**
 * Proxy an event to hooked event handlers
 * @param {Event} e The event object from the browser
 * @private
 */
function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}
