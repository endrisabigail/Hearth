import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Plaza } from "../engine/Plaza.js";

const PlazaCanvas = forwardRef(function PlazaCanvas(props, ref) {
  const { theme, avatarId, start, quests, growth, playersRef, playersVersion, settings, callbacks } = props;
  const boxRef = useRef(null);
  const plazaRef = useRef(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const proxy = new Proxy({}, { get: (_, k) => (...args) => cbRef.current?.[k]?.(...args) });
    let plaza;
    const canvas = document.createElement("canvas");
    canvas.className = "plaza__canvas";
    canvas.tabIndex = -1;
    canvas.setAttribute("aria-label", "Your plaza. Move with WASD or arrow keys, or click the ground.");
    boxRef.current.appendChild(canvas);
    try {
      plaza = new Plaza(canvas, {
        theme,
        avatarId,
        start,
        quality: settings.quality,
        reducedMotion: settings.reducedMotion,
        showNames: settings.showNames,
        callbacks: proxy,
      });
    } catch (err) {
      cbRef.current?.onError?.(err);
      canvas.remove();
      return;
    }
    plazaRef.current = plaza;
    plaza.setQuests(quests);
    plaza.setGrowth(growth);
    plaza.syncRemotes(playersRef.current);
    plaza.init().catch((err) => cbRef.current?.onError?.(err));
    return () => {
      plaza.dispose();
      canvas.remove();
      plazaRef.current = null;
    };
  }, [theme.id, avatarId]);

  useEffect(() => {
    plazaRef.current?.setQuests(quests);
  }, [quests]);

  useEffect(() => {
    plazaRef.current?.setGrowth(growth);
  }, [growth]);

  useEffect(() => {
    plazaRef.current?.syncRemotes(playersRef.current);
  }, [playersVersion]);

  useEffect(() => {
    plazaRef.current?.setShowNames(settings.showNames);
  }, [settings.showNames]);

  useEffect(() => {
    plazaRef.current?.setQuality(settings.quality);
  }, [settings.quality]);

  useImperativeHandle(ref, () => ({
    celebrate: (id) => plazaRef.current?.celebrate(id),
    travelTo: (id) => plazaRef.current?.travelToQuest(id, true),
    emote: (k) => plazaRef.current?.emote(k),
    alertFrom: (id) => plazaRef.current?.alertFrom(id),
    minimap: () => plazaRef.current?.minimap(),
    stats: () => plazaRef.current?.stats(),
  }));

  return <div ref={boxRef} className="plaza__box" />;
});

export default PlazaCanvas;
