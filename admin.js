
const db=supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_KEY);
const el=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let students=[],songsCache=[];

function setMsg(t,ok=false){
  el("adminMsg").innerHTML=t?`<div class="notice ${ok?"success":"error"}">${esc(t)}</div>`:"";
}
async function isAdmin(){
  const{data,error}=await db.rpc("is_admin");
  return !error&&!!data;
}
async function show(){
  el("adminLogin").classList.add("hidden");
  el("panel").classList.remove("hidden");
  el("logoutBtn").classList.remove("hidden");
  await loadStudents();
}

el("loginBtn").onclick=async()=>{
  const{error}=await db.auth.signInWithPassword({
    email:el("email").value.trim(),
    password:el("password").value
  });
  if(error){
    el("loginMsg").innerHTML=`<div class="notice error">${esc(error.message)}</div>`;
    return;
  }
  if(!(await isAdmin())){
    await db.auth.signOut();
    el("loginMsg").innerHTML='<div class="notice error">Bu hesap yönetici değil.</div>';
    return;
  }
  await show();
};

el("logoutBtn").onclick=async()=>{
  await db.auth.signOut();
  location.reload();
};

async function loadStudents(){
  const [{data:voters,error:e1},{data:votes,error:e2},{data:songs,error:e3}] = await Promise.all([
    db.from("voters").select("id,full_name,school_no,pin,last_login_at,created_at").not("school_no","is",null).order("full_name"),
    db.from("votes").select("voter_id,song_id,vote"),
    db.from("songs").select("id,title,artist")
  ]);

  if(e1||e2||e3){
    setMsg((e1||e2||e3).message);
    return;
  }

  songsCache=songs||[];
  const vv=votes||[];

  students=(voters||[]).map(s=>{
    const sv=vv.filter(v=>v.voter_id===s.id);
    return {
      ...s,
      total:sv.length,
      up:sv.filter(v=>v.vote===1).length,
      down:sv.filter(v=>v.vote===-1).length,
      votes:sv
    };
  });

  renderStudents();
}

function renderStudents(){
  if(!students.length){
    el("studentsWrap").innerHTML='<div class="muted">Henüz öğrenci eklenmemiş.</div>';
    return;
  }

  el("studentsWrap").innerHTML=
    `<div class="student-list">${
      students.map(s=>`
        <button class="student-row" onclick="openStudent(${s.id})">
          <span class="student-name">${esc(s.full_name||"İsimsiz öğrenci")}</span>
          <span class="student-meta">${s.pin?"Giriş yaptı":"Henüz giriş yapmadı"} · ${s.total} oy</span>
        </button>`
      ).join("")
    }</div>`;
}

function formatTime(v){
  if(!v)return "Henüz giriş yapmadı";
  try{return new Date(v).toLocaleString("tr-TR")}catch{return v}
}

function openStudent(id){
  const s=students.find(x=>x.id===id);
  if(!s)return;

  el("detailName").textContent=s.full_name||"Öğrenci";

  const voteRows=s.votes.map(v=>{
    const song=songsCache.find(x=>x.id===v.song_id);
    return `<tr><td>${esc(song?.title||("Şarkı #"+v.song_id))}</td><td>${v.vote===1?"⬆️ Artı":"⬇️ Eksi"}</td></tr>`;
  }).join("");

  el("detailBody").innerHTML=`
    <div class="detail-grid">
      <div><span class="muted">Okul no</span><strong>${esc(s.school_no||"-")}</strong></div>
      <div><span class="muted">Giriş durumu</span><strong>${s.pin?"Giriş yaptı":"Henüz giriş yapmadı"}</strong></div>
      <div><span class="muted">PIN</span><strong class="pin-value">${esc(s.pin||"Belirlenmedi")}</strong></div>
      <div><span class="muted">Son giriş</span><strong>${esc(formatTime(s.last_login_at))}</strong></div>
      <div><span class="muted">Toplam oy</span><strong>${s.total}</strong></div>
      <div><span class="muted">Artı / Eksi</span><strong>⬆️ ${s.up} &nbsp; ⬇️ ${s.down}</strong></div>
    </div>

    <div class="controls detail-actions">
      <button onclick="resetPin(${s.id})">PIN'i sıfırla</button>
      <button onclick="deleteStudentVotes(${s.id})">Oylarını sil</button>
      <button class="danger" onclick="resetAccount(${s.id})">Hesabı sıfırla</button>
      <button class="danger" onclick="deleteStudent(${s.id})">Öğrenciyi sil</button>
    </div>

    <h3>Oy verdiği şarkılar</h3>
    ${voteRows
      ? `<div class="detail-table-wrap"><table><tr><th>Şarkı</th><th>Oy</th></tr>${voteRows}</table></div>`
      : '<div class="muted">Henüz oy kullanmamış.</div>'
    }
  `;

  el("studentDetail").classList.remove("hidden");
}
window.openStudent=openStudent;

el("closeDetailBtn").onclick=()=>el("studentDetail").classList.add("hidden");

async function resetPin(id){
  if(!confirm("Sadece PIN sıfırlansın mı? Oyları kalacak."))return;
  const{error}=await db.from("voters").update({pin:null}).eq("id",id);
  if(error)return setMsg(error.message);
  el("studentDetail").classList.add("hidden");
  await loadStudents();
  setMsg("PIN sıfırlandı. Oylar korundu.",true);
}
window.resetPin=resetPin;

async function deleteStudentVotes(id){
  if(!confirm("Bu öğrencinin bütün oyları silinsin mi? PIN'i kalacak."))return;
  const{error}=await db.from("votes").delete().eq("voter_id",id);
  if(error)return setMsg(error.message);
  el("studentDetail").classList.add("hidden");
  await loadStudents();
  setMsg("Öğrencinin oyları silindi.",true);
}
window.deleteStudentVotes=deleteStudentVotes;

async function resetAccount(id){
  if(!confirm("PIN ve bütün oylar silinsin mi? Öğrenci ilk kez giriş yapıyormuş gibi olacak."))return;

  let r=await db.from("votes").delete().eq("voter_id",id);
  if(r.error)return setMsg(r.error.message);

  r=await db.from("voters").update({pin:null,last_login_at:null}).eq("id",id);
  if(r.error)return setMsg(r.error.message);

  el("studentDetail").classList.add("hidden");
  await loadStudents();
  setMsg("Hesap tamamen sıfırlandı.",true);
}
window.resetAccount=resetAccount;

async function deleteStudent(id){
  if(!confirm("Öğrenci tamamen silinsin mi? Oyları da silinir."))return;
  const{error}=await db.from("voters").delete().eq("id",id);
  if(error)return setMsg(error.message);
  el("studentDetail").classList.add("hidden");
  await loadStudents();
  setMsg("Öğrenci silindi.",true);
}
window.deleteStudent=deleteStudent;

async function addStudents(rows){
  if(!rows.length)return;
  const {error}=await db.from("voters").insert(rows);
  if(error)return setMsg("Öğrenci eklenemedi: "+error.message);
  setMsg(`${rows.length} öğrenci eklendi.`,true);
  await loadStudents();
}

el("addStudentBtn").onclick=async()=>{
  const full_name=el("studentNameInput").value.trim();
  const school_no=el("studentNoInput").value.trim();

  if(!full_name||!school_no){
    setMsg("Ad soyad ve okul numarası gerekli.");
    return;
  }

  await addStudents([{full_name,school_no,code:"STU-"+school_no}]);

  el("studentNameInput").value="";
  el("studentNoInput").value="";
};

el("addBulkStudentsBtn").onclick=async()=>{
  const rows=el("bulkStudents").value
    .split(/\r?\n/)
    .map(x=>x.trim())
    .filter(Boolean)
    .map(line=>{
      const p=line.split("|");
      return {
        school_no:(p[0]||"").trim(),
        full_name:(p.slice(1).join("|")||"").trim()
      };
    })
    .filter(x=>x.school_no&&x.full_name)
    .map(x=>({...x,code:"STU-"+x.school_no}));

  await addStudents(rows);
  el("bulkStudents").value="";
};

el("refreshStudentsBtn").onclick=loadStudents;

el("resetVotesBtn").onclick=async()=>{
  if(!confirm("Bütün öğrencilerin bütün oyları silinsin mi?"))return;

  const{error}=await db.from("votes").delete().gte("id",0);

  if(error)return setMsg(error.message);

  setMsg("Bütün oylar sıfırlandı.",true);
  await loadStudents();
};

/* ---------------- CSV / SPOTIFY ---------------- */

function parseCSV(text){
  const rows=[];
  let row=[],cell="",q=false;

  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];

    if(c==='"'){
      if(q&&n==='"'){
        cell+='"';
        i++;
      }else{
        q=!q;
      }
    }else if(c===','&&!q){
      row.push(cell);
      cell="";
    }else if((c==='\n'||c==='\r')&&!q){
      if(c==='\r'&&n==='\n')i++;
      row.push(cell);
      cell="";
      if(row.some(v=>v.length))rows.push(row);
      row=[];
    }else{
      cell+=c;
    }
  }

  row.push(cell);
  if(row.some(v=>v.length))rows.push(row);

  return rows;
}

function normalizeHeader(s){
  return String(s||"")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\uFEFF/g,"");
}

function pick(headers,patterns){
  const h=headers.map(normalizeHeader);

  for(const p of patterns){
    const np=normalizeHeader(p);
    let i=h.findIndex(x=>x===np);
    if(i>=0)return i;
  }

  for(const p of patterns){
    const np=normalizeHeader(p);
    let i=h.findIndex(x=>x.includes(np));
    if(i>=0)return i;
  }

  return -1;
}

function spotifyUriToUrl(v){
  const value=String(v||"").trim();

  if(value.startsWith("spotify:track:")){
    return "https://open.spotify.com/track/"+value.split(":").pop();
  }

  return value;
}

el("replaceSongsBtn").onclick=async()=>{
  const f=el("csvFile").files[0];

  if(!f){
    setMsg("Önce CSV seç.");
    return;
  }

  if(!confirm("Eski şarkılar ve bütün oylar silinecek; öğrenciler ve PIN'ler kalacak. Devam?")){
    return;
  }

  try{
    const rows=parseCSV(await f.text());

    if(rows.length<2)throw new Error("CSV boş.");

    const h=rows[0];

    const it=pick(h,[
      "title",
      "track name",
      "song",
      "name",
      "video title",
      "parça adı",
      "sarki adi",
      "şarkı adı"
    ]);

    const ia=pick(h,[
      "artist",
      "artist name",
      "artist name(s)",
      "channel",
      "uploader",
      "sanatçı adı",
      "sanatci adi"
    ]);

    const im=pick(h,[
      "thumbnail",
      "image",
      "cover",
      "album image url",
      "albüm resim url'si",
      "albüm resim url",
      "album cover",
      "cover url"
    ]);

    const iu=pick(h,[
      "url",
      "link",
      "video url",
      "track url",
      "track uri",
      "spotify uri",
      "parça uri",
      "parca uri"
    ]);

    if(it<0){
      throw new Error(
        "Şarkı adı sütunu bulunamadı. Desteklenen örnekler: Parça Adı, Track Name, Title."
      );
    }

    const songs=rows.slice(1)
      .map((r,i)=>({
        title:(r[it]||"").trim(),
        artist:ia>=0?(r[ia]||"").trim():"",
        thumbnail:im>=0?(r[im]||"").trim():"",
        youtube_url:iu>=0?spotifyUriToUrl(r[iu]):"",
        original_order:i+1
      }))
      .filter(s=>s.title);

    if(!songs.length){
      throw new Error("CSV'den hiç şarkı okunamadı.");
    }

    let res=await db.from("songs").delete().gte("id",0);

    if(res.error)throw res.error;

    for(let i=0;i<songs.length;i+=200){
      const chunk=songs.slice(i,i+200);
      const {error}=await db.from("songs").insert(chunk);
      if(error)throw error;
    }

    setMsg(`${songs.length} şarkı başarıyla yüklendi.`,true);
    await loadStudents();

  }catch(e){
    setMsg("Liste değiştirilemedi: "+e.message);
  }
};

(async()=>{
  const{data}=await db.auth.getSession();
  if(data.session&&await isAdmin())await show();
})();
