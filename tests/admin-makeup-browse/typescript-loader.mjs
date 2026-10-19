// Test-only resolution of the application's extensionless TypeScript imports.
import fs from 'node:fs'
import {pathToFileURL,fileURLToPath} from 'node:url'
import path from 'node:path'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
export async function resolve(specifier,context,nextResolve){
 try{return await nextResolve(specifier,context)}catch(error){
  const file=specifier.startsWith('@/')?path.join(root,'src',specifier.slice(2)):specifier.startsWith('.')?fileURLToPath(new URL(specifier,context.parentURL)):null
  const match=file&&[file+'.ts',file+'.tsx'].find(candidate=>fs.existsSync(candidate))
  if(!match)throw error
  return{url:pathToFileURL(match).href,shortCircuit:true}
 }
}
