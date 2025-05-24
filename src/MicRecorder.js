
import React, { useState, useRef } from "react";

const MicRecorderComponent = () => {
  const [isRunning, setIsRunning] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("🎙 Stream tracks:", stream.getTracks());

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    const audioContext = new AudioContext();
    await audioContext.resume();  // Required for Chrome and modern browsers

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    analyser.fftSize = 2048;

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
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      audioChunksRef.current = [];

      const formData = new FormData();
      formData.append("file", new File([audioBlob], "recording.wav"));

      try {
        const res = await fetch("https://ac38-3-237-33-70.ngrok-free.app/voice-assist", {
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
  };

  const toggleRecording = () => {
    if (isRunning) {
      setIsRunning(false);
      mediaRecorderRef.current?.stop();
    } else {
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
