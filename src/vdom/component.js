import { SYNC_RENDER, NO_RENDER, FORCE_RENDER, ASYNC_RENDER, ATTR_KEY } from '../constants';
import options from '../options';
import { extend, applyRef } from '../util';
import { enqueueRender } from '../render-queue';
import { getNodeProps } from './index';
import { diff, mounts, diffLevel, flushMounts, recollectNodeTree, removeChildren } from './diff';
import { createComponent, recyclerComponents } from './component-recycler';
import { removeNode } from '../dom/index';

/**
 * Set a component's `props` and possibly re-render the component
 * 设置组件props 重新渲染组件
 * @param {import('../component').Component} component The Component to set props on
 * @param {object} props The new props
 * @param {number} renderMode Render options - specifies how to re-render the component
 * @param {object} context The new context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 */
export function setComponentProps(component, props, renderMode, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	component.__ref = props.ref;
	component.__key = props.key;
	delete props.ref;
	delete props.key;

	if (typeof component.constructor.getDerivedStateFromProps === 'undefined') {
		// 还没有插入到DOM 或者 正在render  调用componentWillMount钩子
		if (!component.base || mountAll) {
			if (component.componentWillMount) component.componentWillMount();
		}
		// 更新过程
		else if (component.componentWillReceiveProps) {
			component.componentWillReceiveProps(props, context);
		}
	}
	// 设置prevContext  prevProps  
	if (context && context!==component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (renderMode!==NO_RENDER) {
		if (renderMode===SYNC_RENDER || options.syncComponentUpdates!==false || !component.base) {
			// 同步渲染组件
			renderComponent(component, SYNC_RENDER, mountAll);
		}
		// 异步渲染组件
		else {
			enqueueRender(component);
		}
	}

	applyRef(component.__ref, component);
}



/**
 * Render a Component, triggering necessary lifecycle events and taking
 * 渲染组件 调用生命周期函数钩子
 * High-Order Components into account.
 * @param {import('../component').Component} component The component to render
 * @param {number} [renderMode] render mode, see constants.js for available options.
 * @param {boolean} [mountAll] Whether or not to immediately mount all components
 * @param {boolean} [isChild] ?
 * @private
 */
export function renderComponent(component, renderMode, mountAll, isChild) {
	if (component._disable) return;

	let props = component.props,
		state = component.state,
		context = component.context,
		previousProps = component.prevProps || props,
		previousState = component.prevState || state,
		previousContext = component.prevContext || context,
		// 虚拟DOM转为真实DOM
		isUpdate = component.base,
		nextBase = component.nextBase,
		initialBase = isUpdate || nextBase,
		// Component render方法生成的虚拟DOM的type函数再次实例出来的render方法
		initialChildComponent = component._component,
		skip = false,
		snapshot = previousContext,
		rendered, inst, cbase;

	// 存在gestDerivedStateFromProp => 合并从props传递过来的state
	if (component.constructor.getDerivedStateFromProps) {
		state = extend(extend({}, state), component.constructor.getDerivedStateFromProps(props, state));
		component.state = state;
	}

	// if updating 
	// 更新阶段调用shouldComponentUpdate
	// 和componentWillUpdate函数钩子
	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		// shouldComponentUpdate 更新阶段返回false 则跳出Update的生命周期
		if (renderMode!==FORCE_RENDER
			&& component.shouldComponentUpdate
			&& component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		}
		else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}
	//初始化Component上一个状态
	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		// 生成child的context
		if (component.getChildContext) {
			context = extend(extend({}, context), component.getChildContext());
		}

		if (isUpdate && component.getSnapshotBeforeUpdate) {
			snapshot = component.getSnapshotBeforeUpdate(previousProps, previousState);
		}

		let childComponent = rendered && rendered.nodeName,
			toUnmount, base;

		if (typeof childComponent==='function') {
			// set up high order component link

			let childProps = getNodeProps(rendered);
			inst = initialChildComponent;
			// 前后两次子组件的类型一致
			if (inst && inst.constructor===childComponent && childProps.key==inst.__key) {
				setComponentProps(inst, childProps, SYNC_RENDER, context, false);
			}
			else {
				// 替换组件
				toUnmount = inst;
				// 实例化另一个组件
				component._component = inst = createComponent(childComponent, childProps, context);
				// 刷新真实DOM
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				// 设置子组件的Props
				setComponentProps(inst, childProps, NO_RENDER, context, false);
				// 异步渲染子组件
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		}
		else {
			// render出来的是普通DOM
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || renderMode===SYNC_RENDER) {
				if (cbase) cbase._component = null;
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base!==initialBase && inst!==initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base!==baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
				t = component;
			while ((t=t._parentComponent)) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.push(component);
	}
	else if (!skip) {
		// Ensure that pending componentDidMount() hooks of child components
		// are called before the componentDidUpdate() hook in the parent.
		// Note: disabled as it causes duplicate hooks, see https://github.com/developit/preact/issues/750
		// flushMounts();

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, snapshot);
		}
		if (options.afterUpdate) options.afterUpdate(component);
	}

	while (component._renderCallbacks.length) component._renderCallbacks.pop().call(component);

	if (!diffLevel && !isChild) flushMounts();
}

//<App>
//    <Child></Child>
//</App>
// {
// 	base,   // 对应组件渲染的dom
// 	_component, // 指向Child组件
// }

// // Child组件有以下属性

// {
// 	base,    // 与App组件实例指向同一个dom
// 	_parentComponent,   // 指向App组件
// }

// // 对应的dom节点，即前文中的base对象

// { 
// 	_component    // 指向App组件，而不是Child组件
// }


/**
 * Apply the Component referenced by a VNode to the DOM.
 * @param {import('../dom').PreactElement} dom The DOM node to mutate
 * @param {import('../vnode').VNode} vnode A Component-referencing VNode
 * @param {object} context The current context
 * @param {boolean} mountAll Whether or not to immediately mount all components
 * @returns {import('../dom').PreactElement} The created/mutated element
 * @private
 */
export function buildComponentFromVNode(dom, vnode, context, mountAll) {
	// 获取真实DOM实例
	let c = dom && dom._component,
		originalComponent = c,
		oldDom = dom,
		// vnode和dom节点两个构造器是否相等。
		isDirectOwner = c && dom._componentConstructor===vnode.nodeName,
		isOwner = isDirectOwner,
		props = getNodeProps(vnode);
	// 向上回溯找到与vnode相同类型的组件 缓存到c
	while (c && !isOwner && (c=c._parentComponent)) {
		isOwner = c.constructor===vnode.nodeName;
	}
	// 找到同类型组件 并且不是在render(!mountAll) 的过程中
	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	}
	else {
		// 没找到类型相同组件实例 移除旧组件
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			dom = oldDom = null;
		}
		// 创建新组件
		c = createComponent(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
			oldDom = null;
		}
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		// 垃圾回收
		if (oldDom && dom!==oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}



/**
 * Remove a component from the DOM and recycle it.
 * @param {import('../component').Component} component The Component instance to unmount
 * @private
 */
export function unmountComponent(component) {
	// 执行beforeUnmount函数钩子和componentWillUnmount函数钩子
	if (options.beforeUnmount) options.beforeUnmount(component);

	let base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	// recursively tear down & recollect high-order component children:
	// 递归回收高阶组件
	let inner = component._component;
	if (inner) {
		unmountComponent(inner);
	}
	// 元素节点处理ref
	else if (base) {
		if (base[ATTR_KEY]!=null) applyRef(base[ATTR_KEY].ref, null);

		component.nextBase = base;

		removeNode(base);
		recyclerComponents.push(component);

		removeChildren(base);
	}
	// 处理自身的ref
	applyRef(component.__ref, null);
}
