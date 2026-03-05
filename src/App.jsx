import { useState, useRef, useEffect } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwqse0YxtXVG19fbxO2NB7HCv6E5iN5UvhS8UBXT3KwemNdR-V5hAL2xCogTtcHpOTY/exec";
const CLOUD_NAME = "djp34wxni";
const CLOUD_PRESET = "school_attendance";

function getCurrentShift() {
  return new Date().getHours() < 13 ? "Mañana" : "Tarde";
}

async function uploadPhoto(base64) {
  const blob = await (await fetch(base64)).blob();
  const fd = new FormData();
  fd.append("file", blob);
  fd.append("upload_preset", CLOUD_PRESET);
  fd.append("folder", "asistencia_escolar");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd }
  );
  const data = await res.json();
  return data.secure_url;
}

async function saveRecord(record) {
  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
}

// ── SCANNER usando ZXing (más potente en móviles) ──
function Scanner({ onScanned }) {
  const [status, setStatus] = useState("Iniciando cámara...");
  const [error, setError] = useState(null);
  const readerRef = useRef(null);

  useEffect(() => {
    let controls = null;

    async function startScanner() {
      try {
        const { BrowserMultiFormatReader, NotFoundException } = await import(
          "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.0/esm/index.js"
        );
        const codeReader = new BrowserMultiFormatReader();
        readerRef.current = codeReader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Preferir cámara trasera
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("trasera") ||
          d.label.toLowerCase().includes("environment")
        );
        const deviceId = backCamera ? backCamera.deviceId : devices[devices.length - 1]?.deviceId;

        setStatus("📷 Apuntá al código QR");

        controls = await codeReader.decodeFromVideoDevice(
          deviceId,
          "qr-video",
          (result, err) => {
            if (result) {
              onScanned(result.getText());
            }
          }
        );
      } catch (e) {
        setError("Error de cámara: " + e.message);
      }
    }

    startScanner();

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, [onScanned]);

  if (error) {
    return (
      <div style={S.card("#ff5252")}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ color: "#ff5252", textAlign: "center" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={S.scanWrap}>
      <div style={S.videoBox}>
        <video
          id="qr-video"
          style={S.video}
          muted
          playsInline
          autoPlay
        />
        <div style={S.overlay}>
          <div style={S.box}>
            {["tl","tr","bl","br"].map((p) => (
              <span key={p} style={S.corner(p)} />
            ))}
            <div style={S.line} />
          </div>
        </div>
      </div>
      <p style={S.hint}>{status}</p>
    </div>
  );
}

// ── CÁMARA FRONTAL ──
function Camera({ student, onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startFront();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function startFront() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", true);
      await videoRef.current.play();
      setReady(true);
    } catch (e) {
      alert("Error cámara frontal: " + e.message);
    }
  }

  function snap() {
    const c = canvasRef.current;
    c.width = videoRef.current.videoWidth;
    c.height = videoRef.current.videoHeight;
    c.getContext("2d").drawImage(videoRef.current, 0, 0);
    setPhoto(c.toDataURL("image/jpeg", 0.8));
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  return (
    <div style={S.camWrap}>
      <div style={S.studentTag}>
        <span style={S.sid}>#{student.id}</span>
        <span style={S.sname}>{student.name || "Alumno"}</span>
      </div>
      {!photo ? (
        <div style={S.videoBox}>
          <video
            ref={videoRef}
            style={{ ...S.video, transform: "scaleX(-1)" }}
            muted
            playsInline
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <button onClick={snap} disabled={!ready} style={S.snapBtn}>
            📸
          </button>
        </div>
      ) : (
        <>
          <img
            src={photo}
            style={{ ...S.video, borderRadius: 20, transform: "scaleX(-1)" }}
            alt="preview"
          />
          <div style={S.row}>
            <button onClick={() => { setPhoto(null); startFront(); }} style={S.btnRed}>
              🔄 Repetir
            </button>
            <button onClick={() => onCapture(photo)} style={S.btnGreen}>
              ✅ Confirmar
            </button>
          </div>
        </>
      )}
      <button onClick={onCancel} style={S.btnGhost}>Cancelar</button>
    </div>
  );
}

function Success({ record, onNext }) {
  return (
    <div style={S.card("#00e676")}>
      <div style={{ fontSize: 64 }}>✅</div>
      <h2 style={{ color: "#00e676", margin: 0 }}>¡Registrado!</h2>
      <div style={S.grid}>
        <span style={S.label}>Alumno</span><span style={S.val}>{record.name}</span>
        <span style={S.label}>ID</span><span style={S.val}>{record.id}</span>
        <span style={S.label}>Turno</span><span style={S.val}>{record.shift}</span>
        <span style={S.label}>Hora</span><span style={S.val}>{record.time}</span>
      </div>
      {record.photoUrl && (
        <img src={record.photoUrl} style={S.thumb} alt="foto" />
      )}
      <button onClick={onNext} style={S.btnPrimary}>
        Escanear siguiente →
      </button>
    </div>
  );
}

function Duplicate({ name, shift, onNext }) {
  return (
    <div style={S.card("#ff9800")}>
      <div style={{ fontSize: 64 }}>⚠️</div>
      <h2 style={{ color: "#ff9800", margin: 0 }}>Ya registrado</h2>
      <p style={{ color: "#8892a4", textAlign: "center" }}>
        <b style={{ color: "#e8eaf6" }}>{name}</b> ya fue registrado en el turno{" "}
        <b style={{ color: "#e8eaf6" }}>{shift}</b>.
      </p>
      <button onClick={onNext} style={S.btnPrimary}>Escanear otro →</button>
    </div>
  );
}

function Loading({ text }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:20, minHeight:300 }}>
      <div style={S.spinner} />
      <p style={{ color: "#8892a4" }}>{text}</p>
    </div>
  );
}

// ── APP PRINCIPAL ──
export default function App() {
  const [phase, setPhase] = useState("scan");
  const [student, setStudent] = useState(null);
  const [last, setLast] = useState(null);
  const [dupInfo, setDupInfo] = useState(null);
  const [loadTxt, setLoadTxt] = useState("");
  const [count, setCount] = useState(() => +localStorage.getItem("count") || 0);
  const [done, setDone] = useState(() =>
    JSON.parse(localStorage.getItem("done") || "[]")
  );
  const shift = getCurrentShift();

  function onScanned(qr) {
    const parts = qr.split("|");
    const id = parts[0].trim();
    const name = parts.slice(1).join(" ").trim();
    const key = `${id}_${shift}_${new Date().toLocaleDateString("es-AR")}`;
    if (done.includes(key)) {
      setDupInfo({ name: name || id, shift });
      setPhase("duplicate");
      return;
    }
    setStudent({ id, name });
    setPhase("capture");
  }

  async function onCapture(photo) {
    setLoadTxt("Subiendo foto...");
    setPhase("loading");
    try {
      const photoUrl = await uploadPhoto(photo);
      const now = new Date();
      const record = {
        id: student.id,
        name: student.name,
        date: now.toLocaleDateString("es-AR"),
        time: now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        shift,
        photoUrl,
      };
      setLoadTxt("Guardando en planilla...");
      await saveRecord(record);
      const key = `${record.id}_${shift}_${record.date}`;
      const newDone = [...done, key];
      setDone(newDone);
      localStorage.setItem("done", JSON.stringify(newDone));
      const c = count + 1;
      setCount(c);
      localStorage.setItem("count", c);
      setLast(record);
      setPhase("success");
    } catch (e) {
      alert("Error: " + e.message);
      setPhase("scan");
    }
  }

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize: 28 }}>🏫</span>
          <div>
            <h1 style={S.title}>Asistencia QR</h1>
            <span style={S.badge}>Turno {shift}</span>
          </div>
        </div>
        <div style={S.counter}>
          <span style={{ fontSize:22, fontWeight:900, color:"#00e5ff" }}>{count}</span>
          <span style={{ fontSize:10, color:"#8892a4" }}>HOY</span>
        </div>
      </header>
      <main style={S.main}>
        {phase === "scan"      && <Scanner onScanned={onScanned} />}
        {phase === "capture"   && <Camera student={student} onCapture={onCapture} onCancel={() => setPhase("scan")} />}
        {phase === "loading"   && <Loading text={loadTxt} />}
        {phase === "success"   && <Success record={last} onNext={() => setPhase("scan")} />}
        {phase === "duplicate" && <Duplicate name={dupInfo.name} shift={dupInfo.shift} onNext={() => setPhase("scan")} />}
      </main>
    </div>
  );
}

const C = {
  bg: "#0a0f1e", surface: "#111827",
  accent: "#00e5ff", green: "#00e676",
  text: "#e8eaf6", muted: "#8892a4",
  border: "rgba(0,229,255,0.15)"
};

const S = {
  app: { minHeight:"100vh", background:C.bg, fontFamily:"'Nunito','Segoe UI',sans-serif", color:C.text, display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" },
  header: { padding:"12px 16px", background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 },
  title: { margin:0, fontSize:18, fontWeight:800, color:C.accent },
  badge: { fontSize:11, background:"rgba(0,229,255,0.12)", color:C.accent, border:`1px solid ${C.border}`, borderRadius:20, padding:"2px 8px", fontWeight:700 },
  counter: { textAlign:"center", background:"rgba(0,229,255,0.12)", border:`1px solid ${C.border}`, borderRadius:12, padding:"6px 14px", display:"flex", flexDirection:"column" },
  main: { flex:1, padding:16, display:"flex", flexDirection:"column", gap:16 },
  scanWrap: { display:"flex", flexDirection:"column", alignItems:"center", gap:16 },
  videoBox: { position:"relative", width:"100%", aspectRatio:"4/3", borderRadius:20, overflow:"hidden", background:"#000", border:`2px solid ${C.border}` },
  video: { width:"100%", height:"100%", objectFit:"cover", display:"block" },
  overlay: { position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.35)" },
  box: { position:"relative", width:"60%", aspectRatio:"1" },
  corner: (p) => {
    const b = { position:"absolute", width:24, height:24, border:`3px solid ${C.accent}` };
    const m = {
      tl: { top:0, left:0, borderRight:"none", borderBottom:"none", borderRadius:"6px 0 0 0" },
      tr: { top:0, right:0, borderLeft:"none", borderBottom:"none", borderRadius:"0 6px 0 0" },
      bl: { bottom:0, left:0, borderRight:"none", borderTop:"none", borderRadius:"0 0 0 6px" },
      br: { bottom:0, right:0, borderLeft:"none", borderTop:"none", borderRadius:"0 0 6px 0" },
    };
    return { ...b, ...m[p] };
  },
  line: { position:"absolute", left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${C.accent},transparent)`, animation:"scanAnim 2s linear infinite", top:"50%", boxShadow:`0 0 8px ${C.accent}` },
  hint: { color:C.muted, fontSize:14, textAlign:"center", margin:0 },
  camWrap: { display:"flex", flexDirection:"column", gap:14 },
  studentTag: { background:"#1a2235", borderRadius:16, padding:16, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 },
  sid: { background:"rgba(0,229,255,0.12)", color:C.accent, borderRadius:8, padding:"4px 10px", fontSize:13, fontWeight:800, border:`1px solid ${C.border}` },
  sname: { fontSize:16, fontWeight:700 },
  snapBtn: { position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", width:64, height:64, borderRadius:"50%", background:C.accent, border:"none", fontSize:28, cursor:"pointer", boxShadow:`0 0 20px ${C.accent}` },
  row: { display:"flex", gap:10 },
  btnRed: { flex:1, padding:12, borderRadius:12, background:"rgba(255,82,82,0.15)", border:"1px solid #ff5252", color:"#ff5252", fontWeight:700, fontSize:14, cursor:"pointer" },
  btnGreen: { flex:1, padding:12, borderRadius:12, background:"rgba(0,230,118,0.15)", border:`1px solid ${C.green}`, color:C.green, fontWeight:700, fontSize:14, cursor:"pointer" },
  btnGhost: { padding:10, borderRadius:12, background:"transparent", border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer", width:"100%" },
  btnPrimary: { width:"100%", padding:14, borderRadius:14, background:C.accent, border:"none", color:"#000", fontWeight:900, fontSize:16, cursor:"pointer" },
  card: (color) => ({ background:"#1a2235", border:`1px solid ${color}33`, borderRadius:24, padding:24, display:"flex", flexDirection:"column", alignItems:"center", gap:16 }),
  grid: { display:"grid", gridTemplateColumns:"auto 1fr", gap:"8px 16px", width:"100%", background:"rgba(0,0,0,0.2)", borderRadius:12, padding:16 },
  label: { color:C.muted, fontSize:13 },
  val: { color:C.text, fontSize:13, fontWeight:700 },
  thumb: { width:100, height:100, borderRadius:"50%", objectFit:"cover", border:`3px solid ${C.green}`, transform:"scaleX(-1)" },
  spinner: { width:56, height:56, border:`4px solid ${C.border}`, borderTop:`4px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" },
};
