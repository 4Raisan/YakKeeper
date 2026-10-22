import Image from "next/image";
import {useState} from "react";
export default function ProjectArt({title,category,index,banner}:{title:string;category:string;index:number;banner?:string}) {
  const [failed,setFailed]=useState(false);
  if (banner && !failed) return <div className="project-cover" aria-hidden="true"><img src={banner} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)} /></div>;
  const isYakKeeper=title.trim().toLowerCase()==="yakkeeper";
  const initials=title.split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase();
  return <div className={"project-art art-theme-"+index%3+(isYakKeeper?" yak-art":"")} aria-hidden="true">
    <div className="art-grid"/>
    <div className="art-top"><span>{category.toUpperCase()}</span><span>{String(index+1).padStart(2,"0")} / YK</span></div>
    {isYakKeeper ? <Image src="/brand/yak-mark.svg" alt="" fill sizes="(max-width:650px) 340px,250px" className="yak-project-logo"/> : <span className="art-monogram">{initials}</span>}
    <div className="art-bottom"><strong>{title}</strong><span>↗</span></div>
  </div>;
}
