(() => {
  "use strict";
  const SUPABASE_URL="https://scwjlljurircxuufhqih.supabase.co";
  const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2psbGp1cmlyY3h1dWZocWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjUyMjcsImV4cCI6MjA5Njg0MTIyN30.WF0HRRb9mAkuOySjabTd8CZXVZRqF0MhMl0N2mafnns";

  function sessionId(){
    const key="sportsmistakes_analytics_session_id";
    let value=localStorage.getItem(key);
    if(!value){
      value=(crypto&&crypto.randomUUID)?crypto.randomUUID():`sm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key,value);
    }
    return value;
  }

  function mistakeId(explicitId){
    if(explicitId) return String(explicitId).slice(0,120);
    const p=new URLSearchParams(location.search);
    return p.get("id")||p.get("mistake_id")||p.get("mistake")||null;
  }

  async function send(event_type,options={}){
    const payload={
      event_type,
      path:`${location.pathname}${location.search}`.slice(0,500),
      mistake_id:mistakeId(options.mistakeId),
      session_id:sessionId(),
      share_platform:options.platform?String(options.platform).toLowerCase().slice(0,50):null,
      referrer:(document.referrer||"").slice(0,1000),
      user_agent:(navigator.userAgent||"").slice(0,1000)
    };
    try{
      await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`,{
        method:"POST",keepalive:true,
        headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,"Content-Type":"application/json",Prefer:"return=minimal"},
        body:JSON.stringify(payload)
      });
    }catch(error){console.warn("Analytics event not recorded",error);}
  }

  window.trackSportsMistakesShare=(platform,mistakeId=null)=>send("share",{platform:platform||"unknown",mistakeId});
  const pageview=()=>send("page_view");
  document.readyState==="loading"
    ? document.addEventListener("DOMContentLoaded",pageview,{once:true})
    : pageview();
})();