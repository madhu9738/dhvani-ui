
import React, { useState, useRef } from "react";

const MicRecorderComponent = () => {
  const [isRunning, setIsRunning] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  const startRecording = async () => {
    try {
      console.log("🔁 Starting recording setup...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("🎙 Stream tracks:", stream.getTracks());

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioContext = new AudioContext();
      await audioContext.resume();
      console.log("🔈 AudioContext resumed");

      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 5.0;
      console.log("📈 Gain node applied");

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(gainNode);
      gainNode.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      let silenceStart = Date.now();

      const detectSilence = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const val = data[i] - 128;
          sum += val * val;
        }
        const volume = Math.sqrt(sum / data.length);
        console.log("🔊 RMS Volume:", volume, "🎛 Raw data:", data.slice(0, 10));

        if (volume < 3) {
          if (Date.now() - silenceStart > 1000) {
            console.log("🛑 Silence detected, stopping recording...");
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop();
              stream.getTracks().forEach(track => track.stop());
            }
            return;
          }
        } else {
          silenceStart = Date.now();
        }

        if (isRunning) requestAnimationFrame(detectSilence);
      };

      mediaRecorder.ondataavailable = (event) => {
        console.log("📥 MediaRecorder data available:", event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("📤 MediaRecorder stopped, preparing to send...");
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        audioChunksRef.current = [];

        const formData = new FormData();
        formData.append("file", new File([audioBlob], "recording.wav"));

        try {
          console.log("🌐 Sending audio to backend...");
          const res = await fetch("https://d26c-3-237-33-70.ngrok-free.app/voice-assist", {
            method: "POST",
            body: formData,
          });

          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            const turn = data?.turn ?? "unknown";
            console.log("🕐 Turn check result:", turn);
            if (turn !== "finished") {
              setTimeout(() => startRecording(), 500);
              return;
            }
          }

          const replyBlob = await res.blob();
          const audioURL = URL.createObjectURL(replyBlob);
          const audio = new Audio(audioURL);
          audioRef.current = audio;

          audio.onended = () => {
            console.log("🔁 Audio playback ended");
            if (isRunning) startRecording();
          };

          audio.play();
        } catch (err) {
          console.error("❌ Error in sending/receiving:", err);
        }
      };

      mediaRecorder.start();
      detectSilence();
      console.log("🎙 Recording started...");
    } catch (error) {
      console.error("❌ Error during startRecording:", error);
    }
  };

  const toggleRecording = () => {
    if (isRunning) {
      console.log("🛑 Stopping recording manually...");
      setIsRunning(false);
      mediaRecorderRef.current?.stop();
    } else {
      console.log("▶️ Starting recording manually...");
      setIsRunning(true);
      startRecording();
    }
  };

  return (
    <div>
      <button onClick={toggleRecording}>
        {isRunning ? "⏹ Stop" : "🎙 Start"}
      </button>
    </div>
  );
};

export default MicRecorderComponent;
