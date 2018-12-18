/** 
 *  ReactBaseClasses 主要提供两个类 Component、PureComponent 
*/


/** 
 * base class helpers for the updating state of a componet
 *  
 * 其中 updater 没有什么暖用，在 React-dom 中会将每个组件的初始化后获取到的 instance，
 * 调取 adoptClassInstance 去替换每个组件 instance.updater = classComponentUpdater
 * https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberClassComponent.js#L503
*/

const emptyObject = {};
import ReactNoopUpdateQueue from './ReactNoopUpdateQueue';

function Component(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later
  // 如果一个组件有字符串 refs，我们稍后将分配一个对象
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}

Component.prototype.isReactComponent = {};

/** 
 * @param {object | function} partialState 下一个部分状态或函数，以产生与当前状态合并的下一个部分状态。
 * @param {function} 状态更新完后的回调
 * 
*/
Component.prototype.setState = function (partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
}
/** 
 * forceUpdate
 * @param 
 * 强制更新：这个是需要我们确定在 DOM 中调用
 * This will not invoke `shouldComponentUpdate`, but it will invoke
 * `componentWillUpdate` and `componentDidUpdate`.
*/
Component.prototype.forceUpdate = function(callback) {
  this.updater.enqueueForceUpdate(this, callback, 'forceUpdate');
}


function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}


const pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());
pureComponentPrototype.constructor = PureComponent;
// Avoid an extra prototype jump for these methods.
Object.assign(pureComponentPrototype, Component.prototype);


// isPureReactComponent 
pureComponentPrototype.isPureReactComponent = true;


/** 
 * PureComponent 比 Component 多一个属性 `isPureReactComponent`
 * 在 `checkShouldComponentUpdate` 中会根据 `isPureReactComponet` 
 * 潜比较(`shallowEqual(oldProps, newProps) || shallowEqual(oldState, newState)`)
 * 
*/

export {Component, PureComponent};