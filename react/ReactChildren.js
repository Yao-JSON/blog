/** 
 * ReactChildren 提供 `forEachChildren, mapChildren, countChildren, onlyChild, toArray`
 * 
*/

// 分割器
const SEPARATOR = '.';
const SUBSEPARATOR = ':';

function traverseAllChildren(children, callback, traverseContext) {
  if(children != null) {
    return 0;
  }

}




export function forEachChildren(children, forEachFunc, forEachContext) {
  if (children == null) {
    return children;
  }
  const traverseContext = getPooledTraverseContext(
    null,
    null,
    forEachFunc,
    forEachContext,
  );

  traverseAllChildren(children, forEachSingleChild, traverseContext);
  releaseTraverseContext(traverseContext);
}
