import {
  throwException,
  unwindWork,
  unwindInterruptedWork,
  createRootErrorUpdate,
  createClassErrorUpdate,
} from './ReactFiberUnwindWork';


// ReactFiberScheduler: ReactFiber 调度程序机 

let isWorking = false;
// The next work in process fiber that we`re currently working on
let nextUnitOfWork = null;
let nextRoot = null;
// The time at which we're currently rendering work.
// 下次渲染的工作时间
let nextRenderExpirationTime = 0;
let nextLatestAbsoluteTimeoutMs = -1;
let nextRenderDidError = null;

// The next fiber with an effect that we're currently committing.
let nextEffect = null;
let isCommitting = false;
let rootWithPendingPassiveEffects = null;
let passiveEffectCallbackHandle = null;
let passiveEffectCallback = null;


// 清空堆栈
function resetStack() {
  if(nextUnitOfWork === null) {
    // interrupted 中断工作
    let interruptedWork = nextUnitOfWork.return;
    while (interruptedWork !== null) {
      // 不受干扰的工作
      unwindInterruptedWork(interruptedWork);
      interruptedWork = interruptedWork.return;
    }
  }

  nextRoot = null;
  nextRenderExpirationTime = 0;
  nextLatestAbsoluteTimeoutMs = -1;
  nextRenderDidError = null;
  nextUnitOfWork = null;
}

// 提交所有主机事件    
function commitAllHostEffects() {
  while(nextEffect !== null) {
    // 记录 effect
    recordEffect();
    const effectTag = nextEffect.effectTag;
    if (effectTag & ContentReset) {
      commitResetTextContent(nextEffect);
    }

    if (effectTag & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        commitDetachRef(current);
      }
    }
    let primaryEffectTag = effectTag & (Placement | Update | Deletion);
    switch(primaryEffectTag) { 
      case Placement : {
        commitPlacement(nextEffect)
        // Clear the "placement" from effect tag so that we know that this is inserted, before
        // any life-cycles like componentDidMount gets called.
        nextEffect.effectTag &= ~Placement;
         // Update
         const current = nextEffect.alternate;
         commitWork(current, nextEffect);
         break;
      }
      case Update: {
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Deletion: {
        commitDeletion(nextEffect);
        break;
      }
    }
    nextEffect = nextEffect.nextEffect;
  }    
}

// 提交所有生命周期
function commitAllLifeCycles(finishedRoot, committedExpirationTime) {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag;

    if (effectTag & (Update | Callback)) {
      recordEffect();
      const current = nextEffect.alternate;
      commitLifeCycles(
        finishedRoot,
        current,
        nextEffect,
        committedExpirationTime,
      );
    }

    if (effectTag & Ref) {
      recordEffect();
      commitAttachRef(nextEffect);
    }

    if (enableHooks && effectTag & Passive) {
      rootWithPendingPassiveEffects = finishedRoot;
    }

    nextEffect = nextEffect.nextEffect;
  }
}

function commitPassiveEffects(root, firstEffect) {
  rootWithPendingPassiveEffects = null;
  passiveEffectCallbackHandle = null;
  passiveEffectCallback = null;

  // Set this to true to prevent re-entrancy
  const previousIsRendering = isRendering;
  isRendering = true;

  let effect = firstEffect;

  while(effect !== null) {
    if(effect.effectTag & Passive) {
      let didError = false;
      let error;
      try {
        commitPassiveHookEffects(effect);
      } catch (e) {
        didError = true;
        error = e;
      }
      if (didError) {
        captureCommitPhaseError(effect, error);
      }
      effect = effect.nextEffect;
    }
  }
}


function commitRoot(root, finishedWork) {
  isWorking = true;
  isCommitting = true;
  startCommitTimer();
  const committedExpirationTime = root.pendingCommitExpirationTime;
  root.pendingCommitExpirationTime = NoWork;  
}


function renderRoot(root, isYieldy) {
  flushPassiveEffects();
  isWorking = true;
  if (enableHooks) {
    ReactCurrentOwner.currentDispatcher = Dispatcher;
  } else {
    ReactCurrentOwner.currentDispatcher = DispatcherWithoutHooks;
  }
  const expirationTime = root.nextExpirationTimeToWorkOn;

  if(
    expirationTime !== nextRenderExpirationTime ||
    root !== nextRoot ||
    nextUnitOfWork === null
  ) {
    // Reset the stack and start working from the root.
    resetStack();
    nextRoot = root;
    nextRenderExpirationTime = expirationTime;
    nextUnitOfWork = createWorkInProgress(
      nextRoot.current,
      null,
      nextRenderExpirationTime,
    );
    root.pendingCommitExpirationTime = NoWork;
  }

  if(enableSchedulerTracing) {
    const interactions: Set<Interaction> = new Set();
    root.pendingInteractionMap.forEach(
      (scheduledInteractions, scheduledExpirationTime) => {
        if (scheduledExpirationTime >= expirationTime) {
          scheduledInteractions.forEach(interaction =>
            interactions.add(interaction),
          );
        }
      },
    );

    root.memoizedInteractions = interactions;
    if (interactions.size > 0) {
      const subscriber = __subscriberRef.current;
      if (subscriber !== null) {
        const threadID = computeThreadID(
          expirationTime,
          root.interactionThreadID,
        );
        try {
          subscriber.onWorkStarted(interactions, threadID);
        } catch (error) {
          // Work thrown by an interaction tracing subscriber should be rethrown,
          // But only once it's safe (to avoid leaveing the scheduler in an invalid state).
          // Store the error for now and we'll re-throw in finishRendering().
          if (!hasUnhandledError) {
            hasUnhandledError = true;
            unhandledError = error;
          }
        }
      }
    }
  }

  let prevInteractions: Set<Interaction> = (null: any);
  if (enableSchedulerTracing) {
    // We're about to start new traced work.
    // Restore pending interactions so cascading work triggered during the render phase will be accounted for.
    prevInteractions = __interactionsRef.current;
    __interactionsRef.current = root.memoizedInteractions;
  }
  let didFatal = false;

  startWorkLoopTimer(nextUnitOfWork);

}





// TODO: Everything below this is written as if it has been lifted to the renderers. I'll do this in a follow-up.
// TODO: 下面的所有内容都写得好像它已经被提升到了渲染器。我会在后续的时间里做这件事。

let firstScheduledRoot = null;
let lastScheduledRoot = null;
let callbackExpirationTime = null
let callbackID;
let isRendering = false;
// next 需要清理的 root
let nextFlushedRoot = null;
let nextFlushedExpirationTime = 0;
let lowestPriorityPendingInteractiveExpirationTime = 0;
let hasUnhandledError = false;
let unhandledError = false;

let isBatchingUpdates = false;
// 是否正在清理已更新 root
let isUnbatchingUpdates = false;
let isBatchingInteractiveUpdates = false;

let completedBatches = null;
let originalStartTimeMs = now();
let currentRendererTime = msToExpirationTime(
  originalStartTimeMs,
);
let currentSchedulerTime = currentRendererTime;


function scheduleCallbackWithExpirationTime(root, expirationTime) {
  if(callbackExpirationTime !== NoWork) {

  }
}


// 完成
function onComplete(root, finishedWork, expirationTime) {
  root.pendingCommitExpirationTime = expirationTime;
  root.finishedWork = finishedWork;
}
// 暂停
function onSuspend(root, finishedWork, suspendedExpirationTime, rootExpirationTime, msUntilTimeout) {
  root.expirationTime = rootExpirationTime;
  if(msUntilTimeout === 0 && !shouldYieldToRenderer()) {
    root.pendingCommitExpirationTime = suspendedExpirationTime;
    root.finishedWork = finishedWork;
  } else if(msUntilTimeout > 0) {
    root.timeoutHandle = scheduleTimeout(
      onTimeout.bind(null, root, finishedWork, suspendedExpirationTime),
      msUntilTimeout,
    );
  }
}


/** 
 * requestWork is called by the scheduler whenever a root receives an update.
 * It's up to the renderer to call renderRoot at some point in the future.
 * 当一个 root 在更新，由调度程序执行；
 * 将来某个时候调用renderRoot由渲染器决定。
 * 
*/
function requestWork(root, expirationTime) {
  addRootToSchedule(root, expirationTime);
  if(isRendering) {
    return;
  }
  if(isBatchingUpdates) {
    // Flush work at the end of the batch.
    // 在批量更新结束后进行清理
    if(isUnbatchingUpdates) {
      // ...unless we're inside unbatchedUpdates, in which case we should
      // flush it now.
      nextFlushedRoot = root;
      nextFlushedExpirationTime = Sync;
      performWorkOnRoot(root, Sync, false);
    }
    return;
  }

  if (expirationTime === Sync) {
    performSyncWork();
  } else {
    scheduleCallbackWithExpirationTime(root, expirationTime);
  }
}


function addRootToSchedule(root, expirationTime) {
  // Add root to the schedule
  // Check if this root is already part of the schedule.
  if(root.nextScheduledRoot === null) {
    // This root is not already scheduled. Add it.
    root.expirationTime = expirationTime;
    if (lastScheduledRoot === null) {
      firstScheduledRoot = lastScheduledRoot = root;
      root.nextScheduledRoot = root;
    } else {
      lastScheduledRoot.nextScheduledRoot = root;
      lastScheduledRoot = root;
      lastScheduledRoot.nextScheduledRoot = firstScheduledRoot;    }
  } else {
    // This root is already scheduled, but its priority may have increased.
    const remainingExpirationTime = root.expirationTime;
    if (expirationTime > remainingExpirationTime) {
      // Update the priority.      root.expirationTime = expirationTime;
      root.expirationTime = expirationTime;
    }
  }
}


function finishRendering() {
  nestedUpdateCount = 0;
  lastCommittedRootDuringThisBatch = null;

  if (completedBatches !== null) {
    const batches = completedBatches;
    completedBatches = null;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        batch._onComplete();
      } catch (error) {
        if (!hasUnhandledError) {
          hasUnhandledError = true;
          unhandledError = error;
        }
      }
    }
  }

  if (hasUnhandledError) {
    const error = unhandledError;
    unhandledError = null;
    hasUnhandledError = false;
    throw error;
  }
}


function completeRoot(root, finishedWork, expirationTime) {
  // Check if there's a batch that matches this expiration time.
  const firstBatch = root.firstBatch;
  if (firstBatch !== null && firstBatch._expirationTime >= expirationTime) {
    if (completedBatches === null) {
      completedBatches = [firstBatch];
    } else {
      completedBatches.push(firstBatch);
    }
    if (firstBatch._defer) {
      // This root is blocked from committing by a batch. Unschedule it until
      // we receive another update.
      root.finishedWork = finishedWork;
      root.expirationTime = NoWork;
      return;
    }
  }

  // Commit the root.
  root.finishedWork = null;
  // Check if this is a nested update (a sync update scheduled during the
  // commit phase).
  if (root === lastCommittedRootDuringThisBatch) {
    // If the next root is the same as the previous root, this is a nested
    // update. To prevent an infinite loop, increment the nested update count.
    nestedUpdateCount++;
  } else {
    // Reset whenever we switch roots.
    lastCommittedRootDuringThisBatch = root;
    nestedUpdateCount = 0;
  }
  commitRoot(root, finishedWork);
}

