import {callTask10,Task10Error,type Task10RpcClient} from '@/lib/task10-policy'
import {LessonSourceTransitionError} from '@/lib/lesson-source-transition'

// Admin adapters retain the existing Wallet writer's precise errors. A known
// conflict must let the operator choose again, rather than stay in unknown-result recovery.
export function callMakeupWorkspace<T>(client:Task10RpcClient,name:string,args?:Record<string,unknown>) {
 return callTask10<T>({rpc:async (rpcName,rpcArgs)=>{
  const result=await client.rpc(rpcName,rpcArgs)
  const code=result.error&&/(?:LESSON_SOURCE|LESSON_WALLET)_[A-Z_]+/.exec(result.error.message)?.[0]
  if(code){
   const status=/_(FAILED|RETRY)$/.test(code)?503:/UNAUTHORIZED|FORBIDDEN/.test(code)?403:code.endsWith('_NOT_FOUND')?404:/INVALID_REQUEST/.test(code)?400:/EVIDENCE|INVALID/.test(code)?422:409
   throw new Task10Error(code,new LessonSourceTransitionError(code,status).message,status)
  }
  return result
 }},name,args)
}
