/**
 * @typedef {import('./component').Component} Component
 * @typedef {import('./vnode').VNode} VNode
 */

/**
 * 用于扩展Preact功能 用来兼容官方React
 * Global options
 * @public
 * @typedef Options
 * @property {boolean} [syncComponentUpdates] If `true`, `prop` changes trigger synchronous component updates. Defaults to true.
 * @property {(vnode: VNode) => void} [vnode] Processes all created VNodes.
 * @property {(component: Component) => void} [afterMount] Hook invoked after a component is mounted.
 * @property {(component: Component) => void} [afterUpdate] Hook invoked after the DOM is updated with a component's latest render.
 * @property {(component: Component) => void} [beforeUnmount] Hook invoked immediately before a component is unmounted.
 * @property {(rerender: function) => void} [debounceRendering] Hook invoked whenever a rerender is requested. Can be used to debounce rerenders.
 * @property {(event: Event) => Event | void} [event] Hook invoked before any Preact event listeners. The return value (if any) replaces the native browser event given to event listeners
 */

/** @type {Options}  */
const options = {
  // syncComponentUpdates 同步更新组件状态
  // VNode Processes  扩展VNode属性
  // afterMount 组件被插入DOM时的函数钩子 提供给框架或者内部工具使用
  // afterUpdate 组件在DOM更新渲染时的函数钩子
  // beforeUnmount 在组件被注销的之前 调用的函数钩子
  // debounceRendering 去抖渲染
  // Preact 事件派发函数钩子 返回值替代原生事件派发给事件监听器
};

export default options;
