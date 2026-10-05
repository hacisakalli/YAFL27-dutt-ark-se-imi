const db=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_KEY);
let code=localStorage.getItem("mezuniyet_voter_code")||"",myVotes={},songs=[],sortMode="score";
const el=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function msg(target,text,kind="notice"){target.innerHTML=text?`<div class="${kind}">${esc(text)}</div>`:""}
async function valid(c){const{data,error}=await db.rpc("validate_voter_code",{p_code:c});if(error)throw error;return!!data}
async function loadMine(){const{data,error}=await db.rpc("get_my_votes",{p_code:code});if(error)throw error;myVotes={};for(const r of(data||[]))myVotes[r.song_id]=Number(r.vote)}
async function loadResults(){const{data,error}=await db.rpc("get_song_results");if(error)throw error;songs=data||[];el("songCount").textContent=songs.length;render()}

function rankTheme(rank){
  if(rank<=15) return {score:"score-green", label:"İLK 15"};
  if(rank<=20) return {score:"score-yellow", label:"15–20"};
  return {score:"score-red", label:""};
}

function render(){
  const arr=[...songs];
  if(sortMode==="score"){
    arr.sort((a,b)=>Number(b.score)-Number(a.score)||Number(a.original_order||999999)-Number(b.original_order||999999));
  }else{
    arr.sort((a,b)=>Number(a.original_order||999999)-Number(b.original_order||999999));
  }

  el("songList").innerHTML=arr.length ? arr.map((s,index)=>{
    const mine=myVotes[s.id]||0;
    const rank=index+1;
    const t=rankTheme(rank);
    const score=Number(s.score)||0;

    return `
      <div class="row">
        <div class="rank-number">${rank}</div>

        <a class="cover-link" href="${esc(s.youtube_url||"#")}" target="_blank" rel="noopener">
          <img class="cover" src="${esc(s.thumbnail||"")}" alt="" onerror="this.style.visibility='hidden'">
        </a>

        <div class="song-main">
          <div class="song-title">${esc(s.title)}</div>
          <div class="artist">${esc(s.artist||"")}</div>
          <div class="stats">⬆️ ${s.upvotes} &nbsp; ⬇️ ${s.downvotes}</div>
          ${mine===1?'<div class="small my-vote">Senin oyun: ⬆️</div>':mine===-1?'<div class="small my-vote">Senin oyun: ⬇️</div>':""}

          <div class="vote-area">
            <button class="good ${mine===1?"selected":""}" onclick="setVote(${s.id},${mine===1?0:1})">⬆️</button>
            <button class="bad ${mine===-1?"selected":""}" onclick="setVote(${s.id},${mine===-1?0:-1})">⬇️</button>
          </div>
        </div>

        <div class="score-card ${t.score}">
          <div class="score-label">PUAN</div>
          <div class="score-value">${score>=0?"+":""}${score}</div>
          ${t.label?`<div class="score-rank-label">${t.label}</div>`:""}
        </div>
      </div>`;
  }).join("") : '<div class="notice">Henüz şarkı yüklenmemiş.</div>';
}

async function setVote(songId,vote){
  try{
    const{error}=await db.rpc("cast_vote",{p_code:code,p_song_id:songId,p_vote:vote});
    if(error)throw error;
    if(vote===0)delete myVotes[songId];else myVotes[songId]=vote;
    await loadResults()
  }catch(e){
    msg(el("globalMsg"),"Oy kaydedilemedi: "+e.message,"notice error")
  }
}

async function enter(){
  el("loginCard").classList.add("hidden");
  el("app").classList.remove("hidden");
  el("userBox").classList.remove("hidden");
  el("codeBadge").textContent=code;
  await loadMine();
  await loadResults()
}

el("loginBtn").onclick=async()=>{
  const c=el("codeInput").value.trim();
  if(!c)return msg(el("loginMsg"),"Kodunu yaz.","notice error");
  try{
    if(!(await valid(c)))return msg(el("loginMsg"),"Bu kod geçersiz.","notice error");
    code=c;
    localStorage.setItem("mezuniyet_voter_code",code);
    await enter()
  }catch(e){msg(el("loginMsg"),e.message,"notice error")}
};
el("logoutBtn").onclick=()=>{localStorage.removeItem("mezuniyet_voter_code");location.reload()};
el("refreshBtn").onclick=async()=>{await loadMine();await loadResults()};
el("sortScore").onclick=()=>{sortMode="score";render()};
el("sortOriginal").onclick=()=>{sortMode="original";render()};
(async()=>{if(code){try{if(await valid(code))await enter();else localStorage.removeItem("mezuniyet_voter_code")}catch{}}})();
