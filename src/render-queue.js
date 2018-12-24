import options from './options';
import { defer } from './util';
import { renderComponent } from './vdom/component';

/**
 * 存储当前需要重新渲染的组件
 * Managed queue of dirty components to be re-rendered
 * @type {Array<import('./component').Component>}
 */
let items = [];

/**
 * Enqueue a rerender of a component
 * @param {import('./component').Component} component The component to rerender
 */
export function enqueueRender(component) {
	// 置_dirty为true 并置入items 如果 items是长度为1的数组的话 异步执行rerender函数
	if (!component._dirty && (component._dirty = true) && items.push(component)==1) {
		(options.debounceRendering || defer)(rerender);
	}
}

// 渲染dirty为true的组件
/** Rerender all enqueued dirty components */
export function rerender() {
	let p;
	while ( (p = items.pop()) ) {
		if (p._dirty) renderComponent(p);
	}
}
