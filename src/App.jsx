import { useState, useEffect, useRef } from "react";

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

function Scanner({ onScanned }) {
  const [status, setStatus] = useState("Iniciando cámara...");
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    let scanner = null;

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    async function startScanner() {
      try {
        await loadScript("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js");
        const Html5Qrcode = window.Html5Qrcode;
        scanner = new Html5Qrcode("qr-reader");
        html5QrRef.current = scanner;

        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setStatus("⚠️ No se encontró cámara");
          return;
        }

        // Preferir cámara trasera
        const back = devices.find(d =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("trasera")
        );
        const cameraId = back ? back.id : devices[devices.length - 1].id;

        await scanner.start(
          cameraId,
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            scanner.stop().then(() => {
              onScanned(decodedText);
            });
          },
          () => {}
        );
        setStatus("📷 Apuntá al código QR del alumno");
      } catch (e) {
        setStatus("⚠️ Error: " + e.message);
      }
    }

    startScanner();

    return () => {
      if (html5QrRef.current) {
