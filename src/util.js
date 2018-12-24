/**
 * Copy all properties from `props` onto `obj`.
 * 属性浅拷贝
 * @param {object} obj Object onto which properties should be copied.
 * @param {object} props Object from which to copy properties.
 * @returns {object}
 * @private
 */
export function extend(obj, props) {
	for (let i in props) obj[i] = props[i];
	return obj;
}

/** 
 * 调用或者更新ref值 如果是function 调用传入value
 * 如果是对象的话 直接把value赋值给ref的current 属性
 * Invoke or update a ref, depending on whether it is a function or object ref.
 *  @param {object|function} [ref=null]
 *  @param {any} [value]
 */
export function applyRef(ref, value) {
	if (ref) {
		if (typeof ref=='function') ref(value);
		else ref.current = value;
	}
}

/**
 * 异步执行一个函数
 * Call a function asynchronously, as soon as possible. Makes
 * use of HTML Promise to schedule the callback if available,
 * otherwise falling back to `setTimeout` (mainly for IE<11).
 * @type {(callback: function) => void}
 */
export const defer = typeof Promise=='function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;
