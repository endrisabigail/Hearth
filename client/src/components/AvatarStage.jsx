import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Stage } from "../engine/Stage.js";
import { useSettings } from "../lib/settings.js";

const AvatarStage = forwardRef(function AvatarStage({ mode = "ring", avatarId, className = "" }, ref) {
  const boxRef = useRef(null);
  const stageRef = useRef(null);
  const { reducedMotion } = useSettings();

  useEffect(() => {
    let stage;
    const canvas = document.createElement("canvas");
    boxRef.current.appendChild(canvas);
    try {
      stage = new Stage(canvas, { mode, reducedMotion });
    } catch (err) {
      console.warn("3D stage unavailable", err);
      canvas.remove();
      return;
    }
    stage.pendingAvatar = avatarId;
    stageRef.current = stage;
    stage.init().catch((e) => console.warn(e));
    return () => {
      stage.dispose();
      canvas.remove();
      stageRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    if (mode === "single" && stageRef.current && avatarId && stageRef.current.pendingAvatar !== avatarId) stageRef.current.show(avatarId);
  }, [avatarId, mode]);

  useImperativeHandle(ref, () => ({ celebrate: () => stageRef.current?.celebrate() }), []);

  return (
    <div className={`stage ${className}`} ref={boxRef} />
  );
});

export default AvatarStage;
