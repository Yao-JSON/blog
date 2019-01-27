# react hooks 实现

## Hooks 解决了什么问题

在 `React` 的设计哲学中，简单的来说可以用下面这条公式来表示：

```js
UI = f(data)
```

等号的左边时 UI 代表的最终画出来的界面；等号的右边是一个函数，也就是我们写的 React 相关的代码；data 就是数据，在 React 中，data 可以是 state 或者 props。<br />UI 就是把 data 作为参数传递给 f 运算出来的结果。这个公式的含义就是，如果要渲染界面，不要直接去操纵 DOM 元素，而是修改数据，由数据去驱动 React 来修改界面。<br />我们开发者要做的，就是设计出合理的数据模型，让我们的代码完全根据数据来描述界面应该画成什么样子，而不必纠结如何去操作浏览器中的 DOM 树结构。<br /><br /><br />总体的设计原则：
* 界面完全由数据驱动
* 一切皆组件
* 使用 props 进行组件之间通讯

与之带来的问题有哪些呢？

* 组件之间数据交流耦合度过高，许多组件之间需要共享的数据需要层层的传递；传统的解决方式呢！
  * 变量提升
  * 高阶函数透传
  * 引入第三方数据管理库，redux、mobx
  * 以上三种设计方式都是，都是将数据提升至父节点或者最高节点，然后数据层层传递
* ClassComponet 生命周期的学习成本，以及强关联的代码逻辑由于生命周期钩子函数的执行过程，需要将代码进行强行拆分；常见的：

```jsx
class SomeCompoent extends Component {
	
  componetDidMount() {
    const node = this.refs['myRef'];
    node.addEventListener('mouseDown', handlerMouseDown);
    node.addEventListener('mouseUp', handlerMouseUp)
  }
  
  ...
  
  componetWillunmount() {
    const node = this.refs['myRef'];
    node.removeEventListener('mouseDown', handlerMouseDown)
    node.removeEventListener('mouseUp', handlerMouseUp)
  }
}
```

可以说 Hooks 的出现上面的问题都会迎刃而解。引入 [《用 React Hooks 造轮子》](https://segmentfault.com/a/1190000017057144)


## Hooks API 类型

据官方声明，hooks 是完全向后兼容的，class componet 不会被移除，作为开发者可以慢慢迁移到最新的 API。

Hooks 主要分三种：
* State hooks  : 可以让 function componet 使用 state
* Effect hooks : 可以让 function componet 使用生命周期和 side effect
* Custom hooks: 根据 react 提供的 useState、useReducer、useEffect、useRef等自定义自己需要的 hooks

下面我们来了解一下 Hooks。

#### 首先接触到的是 State hooks

useState 是我们第一个接触到 React Hooks，其主要作用是让 Function Component 可以使用 state，接受一个参数做为 state 的初始值，返回当前的 state 和 dispatch。

```jsx
import { useState } from 'react';

function Example() {
  // Declare a new state variable, which we'll call "count"
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

其中 useState 可以多次声明；

```javascript
function FunctionalComponent () {
  const [state1, setState1] = useState(1)
  const [state2, setState2] = useState(2)
  const [state3, setState3] = useState(3)
  
  return <div>{state1}{...}</div>
}
```

与之对应的 hooks 还有 useReducer，如果是一个状态对应不同类型更新处理，则可以使用 useReducer。

#### 其次接触到的是 Effect hooks

useEffect 的使用是让 Function Componet 组件具备 life-cycles 声明周期函数；比如 componetDidMount、componetDidUpdate、shouldCompoentUpdate 以及 componetWiillunmount 都集中在这一个函数中执行，叫 useEffect。这个函数有点类似 Redux 的 subscribe，会在每次 props、state 触发 render 之后执行。(**在组件第一次 render和每次 update 后触发**)。<br /><br /><br />为什么叫 useEffect 呢？官方的解释：因为我们通常在生命周期内做很多操作都会产生一些 side-effect (副作用) 的操作，比如更新 DOM，fetch 数据等。

useEffect 是使用：

```jsx
import React, { useState, useEffect } from 'react';

function useMousemove() {
	const [client, setClient] = useState({x: 0, y: 0});
  
  useEffect(() => {
   
    const handlerMouseCallback = (e) => {
    	setClient({
      	x: e.clientX,
        y: e.clientY
      })
    };
    // 在组件首次 render 之后， 既在 didMount 时调用
  	document.addEventListener('mousemove', handlerMouseCallback, false);
    
    return () => {
      // 在组件卸载之后执行
    	document.removeEventListener('mousemove', handlerMouseCallback, false);
    }
  })
  
  return client;
}

```

其中 useEffect 只是在组件首次 render 之后即 didMount 之后调用的，以及在组件卸载之时即 unmount 之后调用，如果需要在 DOM 更新之后同步执行，可以使用 useLayoutEffect。

#### 最后接触到的是 custom hooks

根据官方提供的 useXXX API 结合自己的业务场景，可以使用自定义开发需要的 custom hooks，从而抽离业务开发数据，按需引入；实现业务数据与视图数据的充分解耦。

## Hooks 实现方式

在上面的基础之后，对于 hooks 的使用应该有了基本的了解，下面我们结合 hooks 源码对于 hooks 如何能保存无状态组件的原理进行剥离。

Hooks 源码在 **React**react-reconclier** 中的 ReactFiberHooks.js ，代码有 600 行，理解起来也是很方便的，源码地址：[点这里](https://github.com/facebook/react/blob/master/packages/react-reconciler/src/ReactFiberHooks.js)

Hooks 的基本类型：

```typescript
type Hooks = {
	memoizedState: any, // 指向当前渲染节点 Fiber
  baseState: any, // 初始化 initialState， 已经每次 dispatch 之后 newState
  baseUpdate: Update<any> | null,// 当前需要更新的 Update ，每次更新完之后，会赋值上一个 update，方便 react 在渲染错误的边缘，数据回溯
  queue: UpdateQueue<any> | null,// UpdateQueue 通过
  next: Hook | null, // link 到下一个 hooks，通过 next 串联每一 hooks
}
 
type Effect = {
  tag: HookEffectTag, // effectTag 标记当前 hook 作用在 life-cycles 的哪一个阶段
  create: () => mixed, // 初始化 callback
  destroy: (() => mixed) | null, // 卸载 callback
  deps: Array<mixed> | null,
  next: Effect, // 同上 
};
```

React Hooks 全局维护了一个 `workInProgressHook`  变量，每一次调取 Hooks API 都会首先调取 `createWorkInProgressHooks`  函数。

```jsx
function createWorkInProgressHook() {
  if (workInProgressHook === null) {
    // This is the first hook in the list
    if (firstWorkInProgressHook === null) {
      currentHook = firstCurrentHook;
      if (currentHook === null) {
        // This is a newly mounted hook
        workInProgressHook = createHook();
      } else {
        // Clone the current hook.
        workInProgressHook = cloneHook(currentHook);
      }
      firstWorkInProgressHook = workInProgressHook;
    } else {
      // There's already a work-in-progress. Reuse it.
      currentHook = firstCurrentHook;
      workInProgressHook = firstWorkInProgressHook;
    }
  } else {
    if (workInProgressHook.next === null) {
      let hook;
      if (currentHook === null) {
        // This is a newly mounted hook
        hook = createHook();
      } else {
        currentHook = currentHook.next;
        if (currentHook === null) {
          // This is a newly mounted hook
          hook = createHook();
        } else {
          // Clone the current hook.
          hook = cloneHook(currentHook);
        }
      }
      // Append to the end of the list
      workInProgressHook = workInProgressHook.next = hook;
    } else {
      // There's already a work-in-progress. Reuse it.
      workInProgressHook = workInProgressHook.next;
      currentHook = currentHook !== null ? currentHook.next : null;
    }
  }
  return workInProgressHook;
}

```

假设我们需要执行以下 hooks 代码：

```jsx
function FunctionComponet() {
	
  const [ state0, setState0 ] = useState(0);
  const [ state1, setState1 ] = useState(1);
  useEffect(() => {
  	document.addEventListener('mousemove', handlerMouseMove, false);
    ...
    ...
    ...
    return () => {
      ...
      ...
      ...
    	document.removeEventListener('mousemove', handlerMouseMove, false);
    }
  })
  
  const [ satte3, setState3 ] = useState(3);
  return [state0, state1, state3];
}
```


![image.png](https://cdn.nlark.com/yuque/0/2019/png/96328/1548233661527-d7398aee-29f2-4335-9a57-98502a5e14e0.png#align=left&display=inline&height=1436&linkTarget=_blank&name=image.png&originHeight=1436&originWidth=1604&size=295138&width=1604)

当我们了解 React Hooks 的简单原理，得到 Hooks 的串联不是一个数组，但是是一个链式的数据结构，从根节点 workInProgressHook 向下通过 next 进行串联。**这也就是为什么 Hooks 不能嵌套使用，不能在条件判断中使用，不能在循环中使用。否则会破坏链式结构。** 

#### 问题一：useState dispatch 函数如何与其使用的 Function Component 进行绑定

下面我们先看一段代码：

```javascript

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const useWindowSize = () => {
	let [size, setSize] = useState([window.innerWidth, window.innerHeight])
	useEffect(() => {
		let handleWindowResize = event => {
			setSize([window.innerWidth, window.innerHeight])
		}
		window.addEventListener('resize', handleWindowResize)
		return () => window.removeEventListener('resize', handleWindowResize)
	}, [])
	return size
}


const App = () => {
	const [ innerWidth, innerHeight ] = useWindowSize();
  return (
    <ul>
  		<li>innerWidth: {innerWidth}</li>
			<li>innerHeight: {innerHeight}</li>
    </ul>
  )
}

ReactDOM.render(<App/>, document.getElementById('root'))

```

useState 的作用是让 Function Component 具备 State 的能力，但是对于开发者来讲，只要在 Function Component 中引入了 hooks 函数，dispatch 之后就能够作用就能准确的作用在当前的组件上，不经意会有此疑问，带着这个疑问，阅读一下源码。

```javascript
function useState(initialState）{
  return useReducer(
    basicStateReducer,
    // useReducer has a special case to support lazy useState initializers
    (initialState: any),
  );
}

function useReducer(reducer, initialState, initialAction) {
  // 解析当前正在 rendering 的 Fiber
	let fiber = (currentlyRenderingFiber = resolveCurrentlyRenderingFiber());
  workInProgressHook = createWorkInProgressHook();
  // 此处省略部分源码
  ...
  ...
  ...
  // dispathAction 会绑定当前真在渲染的 Fiber， 重点在 dispatchAction 中
  const dispatch = dispatchAction.bind(null, currentlyRenderingFiber,queue,)
  return [workInProgressHook.memoizedState, dispatch];
}

function dispatchAction(fiber, queue, action) {
	const alternate = fiber.alternate;
  const update: Update<S, A> = {
    expirationTime,
    action,
    eagerReducer: null,
    eagerState: null,
    next: null,
  };
  ......
  ......
  ......
  scheduleWork(fiber, expirationTime);
}


```

