export function requestOrigin(request:Request){
 const url=new URL(request.url);
 const host=request.headers.get('host')||url.host;
 const protocol=request.headers.get('x-forwarded-proto')?.split(',')[0].trim()||url.protocol.slice(0,-1);
 if(!['http','https'].includes(protocol))return null;
 try{const origin=new URL(`${protocol}://${host}`);return origin.host===host?origin.origin:null;}catch{return null;}
}
export function sameOrigin(request:Request){const expected=requestOrigin(request);return Boolean(expected&&request.headers.get('origin')===expected);}
