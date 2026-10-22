"use client";
import {useEffect,useState} from "react";
import {Moon,Sun} from "lucide-react";

export default function ThemeToggle() {
  const [theme,setTheme] = useState("dark");
  useEffect(()=>{
    const sync=()=>setTheme(document.documentElement.dataset.theme || "dark");
    sync();
    const media=matchMedia("(prefers-color-scheme: dark)");
    const systemChange=()=>{
      try {if(localStorage.getItem("yakkeeper-theme")) return;} catch {}
      document.documentElement.dataset.theme=media.matches ? "dark" : "light";
      sync();
    };
    const storageChange=(event:StorageEvent)=>{
      if(event.key!=="yakkeeper-theme") return;
      document.documentElement.dataset.theme=event.newValue==="light" || event.newValue==="dark" ? event.newValue : media.matches ? "dark" : "light";
      sync();
    };
    media.addEventListener("change",systemChange);
    window.addEventListener("storage",storageChange);
    return ()=>{media.removeEventListener("change",systemChange);window.removeEventListener("storage",storageChange);};
  },[]);
  const label=`Switch to ${theme==="dark" ? "light" : "dark"} theme`;
  return <button type="button" className="theme-toggle icon-button" aria-label={label} title={label} onClick={()=>{
    const next=theme==="dark" ? "light" : "dark";
    document.documentElement.dataset.theme=next;
    setTheme(next);
    try {localStorage.setItem("yakkeeper-theme",next);} catch {}
  }}>{theme==="dark" ? <Sun size={19}/> : <Moon size={19}/>}</button>;
}
