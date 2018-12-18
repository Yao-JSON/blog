/** 
 * Hooks 目前还在草案阶段
 * 是 React v16.7.0-alpha 中加入的新特性。它可以让你在 class 以外使用 state 和其他 React 特性
 * 在学习之前，需要注意的：
*/

/** 
 * 解决的问题：
 * 跨组件复用 stateful logic(包含状态的逻辑)十分困难
 * React 没有提供一种可复用的行为"attach"到组件上的方式(比如 redux 的 connect 方法)。如果你已经使用了一段时间的 React，
 * 你可能对 render props 和高阶组件有一定的了解，它们的出现就是为了解决逻辑的复用的问题。但是这些模式都是要求你重新构造你的组件，
 * 这可能会非常麻烦。在很多典型的 React 组件中，你可以在 React DevTool 里看到我们的组件被层层叠叠的 `providers`、`consumers`、
 * `高阶组件`、`render props`和其他抽象层包裹。当然你可以通过筛选功能把它们全部都过滤掉
*/