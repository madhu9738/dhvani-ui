
import React, { useState, useRef, useEffect } from "react";
import createVAD, { VADMode, VADEvent } from "@ozymandiasthegreat/vad";

const MicRecorderComponent = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const vadRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
      setDevices(audioInputs);
      if (audioInputs.length > 0) setSelectedDeviceId(audioInputs[0].deviceId);
    });
  }, []);

  const startChunkLoop = async () => {
    const vad = new (await createVAD())(VADMode.AGGRESSIVE, 16000);
    vadRef.current = vad;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined },
    });
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (event) => {
      if (event.data.size === 0) return;
      const blob = event.data;
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const pcm = audioBuffer.getChannelData(0).slice(0, 480).map(s => Math.max(-1, Math.min(1, s)) * 32767);
      try {
        const result = vad.processFrame(Int16Array.from(pcm));
        if (result === VADEvent.VOICE) {
          console.log("🔊 Detected voice...");
        } else if (result === VADEvent.SILENCE) {
          console.log("🛑 Detected silence, sending chunk...");
          sendToBackend(blob);
        }
      } catch (err) {
        console.error("VAD processing error:", err);
      }
    };

    recorder.onstop = () => console.log("⏹ Recorder stopped.");
    recorder.start(1000);  // every second
  };

  const sendToBackend = async (blob) => {
    const formData = new FormData();
    formData.append("file", new File([blob], "recording.wav"));

    try {
      const res = await fetch("https://d26c-3-237-33-70.ngrok-free.app/voice-assist", {
        method: "POST",
        body: formData,
      });

      const replyBlob = await res.blob();
      const audioURL = URL.createObjectURL(replyBlob);
      const audio = new Audio(audioURL);
      audioRef.current = audio;

      audio.onended = () => {
        console.log("🔁 Done playing, waiting for next chunk...");
      };

      audio.play();
    } catch (err) {
      console.error("❌ Failed to send/receive:", err);
    }
  };

  const toggleRecording = () => {
    if (isRunning) {
      console.log("🛑 Stopping...");
      setIsRunning(false);
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
    } else {
      console.log("▶️ Starting chunk-based loop...");
      setIsRunning(true);
      startChunkLoop();
    }
  };

  return (
    <div>
      <label>Select Microphone: </label>
      <select
        value={selectedDeviceId}
        onChange={(e) => setSelectedDeviceId(e.target.value)}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || "Unnamed device"}
          </option>
        ))}
      </select>
      <br />
      <button onClick={toggleRecording}>
        {isRunning ? "⏹ Stop" : "🎙 Start"}
      </button>
    </div>
  );
};

export default MicRecorderComponent;
