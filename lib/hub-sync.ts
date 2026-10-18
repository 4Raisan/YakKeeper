/** A late response must not restore an older signed-in user's private state. */
export function latestRequestGate(){
 let generation=0;
 return {next:()=>++generation,current:(request:number)=>request===generation,invalidate:()=>{generation++;}};
}
