/*
  VidNova starter
  1) Create a Supabase project.
  2) Paste Project URL and anon/public key below.
  3) Run supabase_setup.sql in Supabase SQL Editor.
  4) Create a PUBLIC Storage bucket named "videos" (see README).
  Never put a service_role key in browser code.
*/
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";
const CONFIGURED = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const sb = CONFIGURED && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const demoVideos = [
  {id:"demo1",title:"Build Better Habits in 5 Minutes",description:"एक sample demo video card. अपना Supabase setup करने के बाद असली videos यहाँ दिखेंगे।",category:"education",video_type:"long",video_url:"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",thumbnail_url:"",created_at:new Date().toISOString(),views:1240,channel_name:"VidNova Studio",owner_id:"demo",duration:"0:06"},
  {id:"demo2",title:"A Calm Nature Moment 🌿",description:"Nature demo clip.",category:"lifestyle",video_type:"short",video_url:"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",thumbnail_url:"",created_at:new Date(Date.now()-86400000).toISOString(),views:834,channel_name:"Nature Frames",owner_id:"demo",duration:"0:06"},
  {id:"demo3",title:"Tech Ideas for Beginners",description:"Tech demo card.",category:"tech",video_type:"long",video_url:"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",thumbnail_url:"",created_at:new Date(Date.now()-172800000).toISOString(),views:2100,channel_name:"Learn Lab",owner_id:"demo",duration:"0:06"}
];
let currentUser = null, videos = [], activeCategory = "all", activeView = "home", searchTerm = "", activeVideo = null, toastTimer = null;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const niceNumber = n => Number(n || 0).toLocaleString("en-IN");
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600)}
function openModal(id){$("modalBackdrop").classList.remove("hidden");$(id).classList.remove("hidden")}
function closeModals(){$("modalBackdrop").classList.add("hidden");document.querySelectorAll(".modal").forEach(m=>m.classList.add("hidden"))}
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeModals));
$("modalBackdrop").addEventListener("click",closeModals);
function formatViews(n){n=Number(n||0);if(n>=1e6)return (n/1e6).toFixed(1)+"M views";if(n>=1e3)return (n/1e3).toFixed(1)+"K views";return n+" views"}
function ago(date){const diff=Math.max(0,Date.now()-new Date(date).getTime());const d=Math.floor(diff/86400000);if(d<1)return "आज";if(d===1)return "1 दिन पहले";if(d<30)return d+" दिन पहले";return Math.floor(d/30)+" महीने पहले"}
function avatarLetter(v){return (v.channel_name||v.email||"V").trim().charAt(0).toUpperCase()}
function filteredVideos(){
 let arr=[...videos];
 if(activeView==="myvideos")arr=arr.filter(v=>currentUser&&v.owner_id===currentUser.id);
 if(activeView==="shorts")arr=arr.filter(v=>v.video_type==="short");
 if(activeView==="subscriptions")arr=arr.filter(v=>v.is_subscribed_channel);
 if(activeView==="liked")arr=arr.filter(v=>v.is_liked);
 if(activeCategory!=="all")arr=arr.filter(v=>v.category===activeCategory);
 if(searchTerm)arr=arr.filter(v=>(v.title+" "+(v.description||"")+" "+(v.channel_name||"")).toLowerCase().includes(searchTerm.toLowerCase()));
 return arr;
}
function renderFeed(){
 const list=filteredVideos();
 $("feedTitle").textContent=activeView==="myvideos"?"Your videos":activeView==="subscriptions"?"Subscription videos":activeView==="liked"?"Liked videos":activeView==="shorts"?"Shorts":"Explore videos";
 $("videoCount").textContent=list.length+" videos";
 $("videoGrid").innerHTML=list.map(v=>`
 <article class="video-card" data-watch="${esc(v.id)}">
  <div class="thumbnail">${v.thumbnail_url?`<img src="${esc(v.thumbnail_url)}" alt="" loading="lazy" onerror="this.remove()">`:""}<div class="thumb-fallback">▶</div><div class="play-overlay"><span>▶</span></div><span class="duration">${v.video_type==="short"?"SHORTS":esc(v.duration||"VIDEO")}</span></div>
  <div class="video-meta"><div class="channel-avatar">${esc(avatarLetter(v))}</div><div class="video-details"><h3 class="video-title">${esc(v.title)}</h3><div class="channel-name">${esc(v.channel_name||"VidNova Creator")}</div><div class="video-stats">${formatViews(v.views)} · ${ago(v.created_at)}</div></div><button class="card-menu" data-menu="${esc(v.id)}" title="Options">⋮</button></div>
 </article>`).join("");
 $("emptyState").classList.toggle("hidden",list.length!==0);
}
async function loadVideos(){
 if(!sb){videos=demoVideos;renderFeed();$("setupAlert").classList.remove("hidden");return}
 const {data,error}=await sb.from("videos").select("id,title,description,category,video_type,video_url,thumbnail_url,created_at,views,owner_id,profiles(display_name)").order("created_at",{ascending:false}).limit(100);
 if(error){console.error(error);toast("वीडियो लोड नहीं हुए: "+error.message);videos=demoVideos}
 else {
   videos=(data||[]).map(v=>({...v,channel_name:v.profiles?.display_name||"VidNova Creator"}));
   await enrichInteractions();
 }
 renderFeed();
}
async function enrichInteractions(){
 if(!sb||!currentUser)return;
 const ids=videos.map(v=>v.id);if(!ids.length)return;
 const [likes,subs]=await Promise.all([
  sb.from("likes").select("video_id").eq("user_id",currentUser.id).in("video_id",ids),
  sb.from("subscriptions").select("channel_id").eq("user_id",currentUser.id)
 ]);
 const liked=new Set((likes.data||[]).map(x=>x.video_id)), subscribed=new Set((subs.data||[]).map(x=>x.channel_id));
 videos=videos.map(v=>({...v,is_liked:liked.has(v.id),is_subscribed_channel:subscribed.has(v.owner_id)}));
}
async function refreshUser(){
 if(!sb){currentUser=null;return}
 const {data}=await sb.auth.getSession();currentUser=data.session?.user||null;
 $("accountBtn").textContent=currentUser?(currentUser.email||"U").charAt(0).toUpperCase():"👤";
 $("mobileAccount").innerHTML=`<span>${currentUser?"●":"👤"}</span>You`;
 $("signOutBtn").classList.toggle("hidden",!currentUser);
}
async function requireLogin(){if(!sb){toast("पहले README के अनुसार Supabase configure करें");return false}if(!currentUser){openModal("authModal");toast("पहले sign in करें");return false}return true}
async function signIn(signUp=false){
 if(!sb){toast("पहले app.js में Supabase URL और anon key भरें");return}
 const email=$("authEmail").value.trim(),password=$("authPassword").value;
 if(!email||password.length<6){toast("Valid email और कम से कम 6-character password डालें");return}
 const result=signUp?await sb.auth.signUp({email,password}):await sb.auth.signInWithPassword({email,password});
 if(result.error){toast(result.error.message);return}
 if(signUp&&!result.data.session){toast("Sign-up हो गया। Email confirmation check करें।");return}
 currentUser=result.data.user||result.data.session?.user||null;
 if(currentUser){
  await sb.from("profiles").upsert({id:currentUser.id,display_name:(email.split("@")[0]).slice(0,30)},{onConflict:"id"});
  await refreshUser();closeModals();await loadVideos();toast(signUp?"Account बन गया!":"Sign in सफल")
 }
}
$("signInBtn").addEventListener("click",()=>signIn(false));$("signUpBtn").addEventListener("click",()=>signIn(true));
$("signOutBtn").addEventListener("click",async()=>{if(sb)await sb.auth.signOut();currentUser=null;await refreshUser();closeModals();await loadVideos();toast("Sign out हो गया")});
function showAccount(){if(!sb){toast("Supabase setup के बाद account features चलेंगे");return}openModal("authModal")}
$("accountBtn").addEventListener("click",showAccount);$("showAccount").addEventListener("click",showAccount);$("mobileAccount").addEventListener("click",showAccount);
$("notificationsBtn").addEventListener("click",()=>toast("Notifications ka section agle update mein connect hoga."));
function openUpload(){if(!sb){toast("Upload चालू करने के लिए README में Supabase setup करें");return}if(!currentUser){openModal("authModal");toast("Upload करने के लिए sign in करें");return}openModal("uploadModal")}
$("uploadOpen").addEventListener("click",openUpload);$("mobileUpload").addEventListener("click",openUpload);$("emptyUpload").addEventListener("click",openUpload);
$("uploadForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!await requireLogin())return;
 const file=$("videoFile").files[0],title=$("videoTitle").value.trim();
 if(!file||!title){toast("Title और video file जरूरी हैं");return}
 const maxBytes=100*1024*1024;
 if(file.size>maxBytes){toast("यह starter 100 MB तक की files के लिए सेट है। छोटे video से कोशिश करें।");return}
 if(!/^video\/(mp4|webm|quicktime)$/.test(file.type)){toast("MP4, WebM या MOV वीडियो चुनें");return}
 $("publishBtn").disabled=true;$("uploadProgress").classList.remove("hidden");$("uploadProgressBar").style.width="15%";$("uploadStatus").textContent="Upload शुरू हो रहा है...";
 const ext=(file.name.split(".").pop()||"mp4").toLowerCase().replace(/[^a-z0-9]/g,"")||"mp4";
 const path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;
 const {data:uploaded,error:uploadError}=await sb.storage.from("videos").upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError){$("publishBtn").disabled=false;$("uploadStatus").textContent="";toast("Upload error: "+uploadError.message);return}
 $("uploadProgressBar").style.width="75%";
 const {data:publicData}=sb.storage.from("videos").getPublicUrl(uploaded.path);
 const row={owner_id:currentUser.id,title,description:$("videoDescription").value.trim(),category:$("videoCategory").value,video_type:$("videoType").value,video_url:publicData.publicUrl,thumbnail_url:$("thumbnailUrl").value.trim()||null};
 const {error:dbError}=await sb.from("videos").insert(row);
 if(dbError){await sb.storage.from("videos").remove([uploaded.path]);$("publishBtn").disabled=false;$("uploadProgressBar").style.width="0";toast("Video record save नहीं हुआ: "+dbError.message);return}
 $("uploadProgressBar").style.width="100%";$("uploadStatus").textContent="Published!";
 $("uploadForm").reset();$("publishBtn").disabled=false;
 setTimeout(()=>{$("uploadProgress").classList.add("hidden");$("uploadProgressBar").style.width="0";$("uploadStatus").textContent="";closeModals()},500);
 activeView="home";activeCategory="all";setActiveNav();await loadVideos();toast("आपका वीडियो publish हो गया!")
});
async function openWatch(id){
 const v=videos.find(x=>String(x.id)===String(id));if(!v)return;
 activeVideo=v;
 if(sb&&!String(id).startsWith("demo")){sb.from("videos").update({views:(v.views||0)+1}).eq("id",v.id).then(()=>{});v.views=(v.views||0)+1}
 let liked=!!v.is_liked, subscribed=!!v.is_subscribed_channel;
 $("watchContent").innerHTML=`
 <video class="watch-player" src="${esc(v.video_url)}" controls playsinline preload="metadata"></video>
 <h2 class="watch-title" id="watchTitle">${esc(v.title)}</h2>
 <div class="video-stats">${formatViews(v.views)} · ${ago(v.created_at)} · ${esc(v.category||"video")}</div>
 <div class="watch-actions"><button id="likeBtn" class="${liked?"active":""}">♡ Like <span>${v.likes_count||""}</span></button><button id="subscribeBtn" class="${subscribed?"active":""}">＋ Subscribe</button><button id="shareBtn">↗ Share</button></div>
 <p class="watch-description">${esc(v.description||"इस वीडियो का description नहीं दिया गया।")}</p>
 <h3>Comments</h3><form class="comment-box" id="commentForm"><input id="commentInput" placeholder="एक comment लिखें..." maxlength="1000"><button class="primary-btn">Send</button></form>
 <div class="comment-list" id="commentList"><p class="muted">Comments लोड हो रहे हैं...</p></div>`;
 openModal("watchModal");
 $("shareBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.href.split("#")[0]+"#video="+encodeURIComponent(v.id));toast("App link copy हो गया")}catch{toast("Share: "+location.href)}});
 $("likeBtn").addEventListener("click",()=>toggleLike(v));
 $("subscribeBtn").addEventListener("click",()=>toggleSubscribe(v));
 $("commentForm").addEventListener("submit",postComment);
 await loadComments(v);
}
async function toggleLike(v){
 if(!await requireLogin())return;
 const existing=!!v.is_liked;
 if(existing){const {error}=await sb.from("likes").delete().eq("video_id",v.id).eq("user_id",currentUser.id);if(error){toast(error.message);return}v.is_liked=false}
 else{const {error}=await sb.from("likes").insert({video_id:v.id,user_id:currentUser.id});if(error&&error.code!=="23505"){toast(error.message);return}v.is_liked=true}
 $("likeBtn").classList.toggle("active",v.is_liked);$("likeBtn").innerHTML=`♡ Like <span>${v.is_liked?"✓":""}</span>`;renderFeed();
}
async function toggleSubscribe(v){
 if(!await requireLogin())return;if(v.owner_id===currentUser.id){toast("अपने ही channel को subscribe नहीं कर सकते");return}
 if(v.is_subscribed_channel){const {error}=await sb.from("subscriptions").delete().eq("channel_id",v.owner_id).eq("user_id",currentUser.id);if(error){toast(error.message);return}v.is_subscribed_channel=false}
 else{const {error}=await sb.from("subscriptions").insert({channel_id:v.owner_id,user_id:currentUser.id});if(error&&error.code!=="23505"){toast(error.message);return}v.is_subscribed_channel=true}
 $("subscribeBtn").classList.toggle("active",v.is_subscribed_channel);$("subscribeBtn").textContent=v.is_subscribed_channel?"✓ Subscribed":"＋ Subscribe";renderFeed();
}
async function loadComments(v){
 const list=$("commentList");if(!sb||String(v.id).startsWith("demo")){list.innerHTML='<p class="muted">Demo videos पर comments सेव नहीं होते। Supabase setup करके अपना वीडियो upload करें।</p>';return}
 const {data,error}=await sb.from("comments").select("id,body,created_at,profiles(display_name)").eq("video_id",v.id).order("created_at",{ascending:false}).limit(50);
 if(error){list.innerHTML='<p class="muted">Comments load नहीं हो सके।</p>';return}
 list.innerHTML=data.length?data.map(c=>`<div class="comment"><strong>${esc(c.profiles?.display_name||"Viewer")} · <span class="muted">${ago(c.created_at)}</span></strong><p>${esc(c.body)}</p></div>`).join(""):'<p class="muted">पहला comment आप करें।</p>';
}
async function postComment(e){
 e.preventDefault();if(!await requireLogin())return;
 const body=$("commentInput").value.trim();if(!body||!activeVideo)return;
 const {error}=await sb.from("comments").insert({video_id:activeVideo.id,user_id:currentUser.id,body});
 if(error){toast("Comment save नहीं हुआ: "+error.message);return}
 $("commentInput").value="";await loadComments(activeVideo);toast("Comment पोस्ट हो गया");
}
$("videoGrid").addEventListener("click",e=>{
 const menu=e.target.closest("[data-menu]");if(menu){e.stopPropagation();const v=videos.find(x=>String(x.id)===menu.dataset.menu);if(v&&currentUser&&v.owner_id===currentUser.id){if(confirm("क्या यह वीडियो delete करना है?"))deleteVideo(v)}else toast("वीडियो देखने के लिए thumbnail पर tap करें");return}
 const card=e.target.closest("[data-watch]");if(card)openWatch(card.dataset.watch)
});
async function deleteVideo(v){
 if(!sb||!currentUser||v.owner_id!==currentUser.id)return;
 const {error}=await sb.from("videos").delete().eq("id",v.id);
 if(error){toast(error.message);return}
 await loadVideos();toast("वीडियो हटाया गया")
}
$("searchForm").addEventListener("submit",e=>{e.preventDefault();searchTerm=$("searchInput").value.trim();renderFeed()});
$("searchInput").addEventListener("input",()=>{searchTerm=$("searchInput").value.trim();renderFeed()});
$("filterRow").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;activeCategory=b.dataset.filter;document.querySelectorAll(".filter-chip").forEach(x=>x.classList.toggle("selected",x===b));renderFeed()});
function setActiveNav(){
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===activeView));
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{activeView=b.dataset.view;setActiveNav();renderFeed();if(window.innerWidth<700)window.scrollTo({top:0,behavior:"smooth"})}));
$("logoHome").addEventListener("click",e=>{e.preventDefault();activeView="home";activeCategory="all";searchTerm="";$("searchInput").value="";document.querySelectorAll(".filter-chip").forEach(b=>b.classList.toggle("selected",b.dataset.filter==="all"));setActiveNav();renderFeed()});
$("menuBtn").addEventListener("click",()=>toast("मोबाइल navigation नीचे उपलब्ध है"));
async function start(){
 if(sb){await refreshUser();sb.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;refreshUser();loadVideos()})}
 await loadVideos();
 const match=location.hash.match(/video=([^&]+)/);if(match)setTimeout(()=>openWatch(decodeURIComponent(match[1])),500);
}
start();
