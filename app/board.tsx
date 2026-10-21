"use client";
import Image from "next/image";
export default function Board({copyrightYear}:{copyrightYear:number}) {return <div className="app"><header><a className="brand" href="/"><Image src="/brand/yakkeeper.webp" alt="" width={44} height={44}/>YakKeeper.</a></header><main><section className="board-heading"><h1>Build together.</h1><p>Where projects meet their next contributors.</p></section></main><footer>YakKeeper © {copyrightYear}</footer></div>;}
