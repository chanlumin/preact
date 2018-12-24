// render modes

/** Do not re-render a component */
// 不渲染
export const NO_RENDER = 0;
// 同步 重新渲染组件及其对应子组件
/** Synchronously re-render a component and its children */
export const SYNC_RENDER = 1;
// 同步 强制渲染组件 即使在其生命周期钩子函数中试图阻止组件的渲染
/** Synchronously re-render a component, even if its lifecycle methods attempt to prevent it. */
export const FORCE_RENDER = 2;
// 异步更新 组件
/** Queue asynchronous re-render of a component and it's children */
export const ASYNC_RENDER = 3;


// 节点中添加的属性
export const ATTR_KEY = '__preactattr_';

/** DOM properties that should NOT have "px" added when numeric */
// 样式value不需要添加px的DOM属性
// acit exs exg exn exp ex rph ows mnc ntw inec ineh zoo ord+'xxx' => 不区分大小写 
export const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

