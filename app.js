
const db=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_KEY);
const el=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

let schoolNo=localStorage.getItem("mez_school_no")||"";
let pin=localStorage.getItem("mez_pin")||"";
let studentName="";
let myVotes={},songs=[],sortMode="score",currentHasPin=false;

function msg(target,text,kind="notice"){target.innerHTML=text?`<div class="${kind}">${esc(text)}</div>`:""}
function validPin(v){return /^[0-9]{4,6}$/.test(v)}

async function getStatus(no){
  const {data,error}=await db.rpc("get_student_status",{p_school_no:no});
  if(error) throw error;
  return data && data.length ? data[0] : null;
}

async function loginStudent(no,p){
  const {data,error}=await db.rpc("student_login",{p_school_no:no,p_pin:p});
  if(error) throw error;
  return data && data.length ? data[0] : null;
}

async function loadMine(){
  const {data,error}=await db.rpc("get_student_votes",{p_school_no:schoolNo,p_pin:pin});
  if(error) throw error;
  myVotes={};
  for(const r of(data||[])) myVotes[r.song_id]=Number(r.vote);
}

async function loadResults(){
  const {data,error}=await db.rpc("get_song_results");
  if(error) throw error;
  songs=data||[];
  el("songCount").textContent=songs.length;
  render();
}

function rankTheme(rank){
  if(rank<=15) return {score:"score-green",label:"İLK 15"};
  if(rank<=20) return {score:"score-yellow",label:"15–20"};
  return {score:"score-red",label:""};
}

function render(){
  const arr=[...songs];
  if(sortMode==="score"){
    arr.sort((a,b)=>Number(b.score)-Number(a.score)||Number(a.original_order||999999)-Number(b.original_order||999999));
  }else{
    arr.sort((a,b)=>Number(a.original_order||999999)-Number(b.original_order||999999));
  }

  el("songList").innerHTML=arr.length ? arr.map((s,index)=>{
    const mine=myVotes[s.id]||0,rank=index+1,t=rankTheme(rank),score=Number(s.score)||0;
    return `<div class="row">
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
    const {error}=await db.rpc("cast_student_vote",{p_school_no:schoolNo,p_pin:pin,p_song_id:songId,p_vote:vote});
    if(error) throw error;
    if(vote===0) delete myVotes[songId]; else myVotes[songId]=vote;
    await loadResults();
  }catch(e){msg(el("globalMsg"),"Oy kaydedilemedi: "+e.message,"notice error")}
}

async function enterApp(){
  el("loginCard").classList.add("hidden");
  el("app").classList.remove("hidden");
  el("userBox").classList.remove("hidden");
  el("studentBadge").textContent=studentName || schoolNo;
  await loadMine();
  await loadResults();
}

el("continueBtn").onclick=async()=>{
  const no=el("schoolNoInput").value.trim();
  if(!no) return msg(el("loginMsg"),"Okul numaranı yaz.","notice error");
  try{
    const st=await getStatus(no);
    if(!st) return msg(el("loginMsg"),"Bu okul numarası sistemde kayıtlı değil.","notice error");
    schoolNo=no;
    studentName=st.full_name||"";
    currentHasPin=!!st.has_pin;
    el("studentName").textContent=studentName ? `Merhaba, ${studentName}` : "";
    el("pinArea").classList.remove("hidden");
    if(currentHasPin){
      el("pinHelp").textContent="Daha önce belirlediğin 4–6 haneli PIN'ini gir.";
      el("pinBtn").textContent="Giriş yap";
    }else{
      el("pinHelp").textContent="İlk girişin. Kendine sadece rakamlardan oluşan 4–6 haneli bir PIN belirle. Bu PIN'i sonraki girişlerinde kullanacaksın.";
      el("pinBtn").textContent="PIN oluştur ve giriş yap";
    }
    msg(el("loginMsg"),"");
  }catch(e){msg(el("loginMsg"),e.message,"notice error")}
};

el("pinBtn").onclick=async()=>{
  const p=el("pinInput").value.trim();
  if(!validPin(p)) return msg(el("loginMsg"),"PIN sadece rakamlardan oluşmalı ve 4–6 hane arasında olmalı.","notice error");
  try{
    if(!currentHasPin){
      const {error}=await db.rpc("set_student_pin",{p_school_no:schoolNo,p_pin:p});
      if(error) throw error;
    }
    const result=await loginStudent(schoolNo,p);
    if(!result) return msg(el("loginMsg"),"Okul numarası veya PIN yanlış.","notice error");
    pin=p;
    studentName=result.full_name||studentName;
    localStorage.setItem("mez_school_no",schoolNo);
    localStorage.setItem("mez_pin",pin);
    await enterApp();
  }catch(e){msg(el("loginMsg"),e.message,"notice error")}
};

el("logoutBtn").onclick=()=>{
  localStorage.removeItem("mez_school_no");
  localStorage.removeItem("mez_pin");
  location.reload();
};
el("refreshBtn").onclick=async()=>{await loadMine();await loadResults()};
el("sortScore").onclick=()=>{sortMode="score";render()};
el("sortOriginal").onclick=()=>{sortMode="original";render()};

(async()=>{
  if(schoolNo&&pin){
    try{
      const r=await loginStudent(schoolNo,pin);
      if(r){studentName=r.full_name||"";await enterApp()}
      else{localStorage.removeItem("mez_school_no");localStorage.removeItem("mez_pin")}
    }catch{}
  }
})();
