import assert from 'node:assert/strict'

/** Every performance entry point must resolve its actor from the private registry. */
export function performanceActor(registry,id){
 assert.notEqual(id,registry.owner.id,'Owner review account cannot be used for performance tests')
 const actor=registry.performance.find(a=>a.id===id)
 assert.ok(actor,'Performance actor must be explicitly registered')
 return actor
}
