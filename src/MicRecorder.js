
import React, { useState, useRef, useEffect } from "react";
import createVAD, { VADMode, VADEvent } from "@ozymandiasthegreat/vad";

const MicRecorderComponent = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
      setDevices(audioInputs);
      if (audioInputs.length > 0) setSelectedDeviceId(audioInputs[0].deviceId);
    });
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined },
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(480, 1, 1);

      const VAD = await createVAD();
      const vad = new VAD(VADMode.AGGRESSIVE, 16000);

      source.connect(processor);
      processor.connect(audioContext.destination);

      let silenceStart = Date.now();

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
        }

        try {
          const result = vad.processFrame(pcmData);
          if (result === VADEvent.VOICE) {
            silenceStart = Date.now();
          } else if (result === VADEvent.SILENCE) {
            if (Date.now() - silenceStart > 1000) {
              console.log("🛑 VAD detected silence, stopping recording...");
              processor.disconnect();
              source.disconnect();
              processor.onaudioprocess = null;
              if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                stream.getTracks().forEach(track => track.stop());
              }
            }
          }
        } catch (err) {
          console.error("VAD processing error:", err);
        }
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
          const res = await fetch("https://d26c-3-237-33-70.ngrok-free.app/voice-assist", {
            method: "POST",
            body: formData,
          });

          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            const turn = data?.turn ?? "unknown";
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
    } catch (error) {
      console.error("❌ Error during startRecording:", error);
    }
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
